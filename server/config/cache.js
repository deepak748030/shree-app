// Two-tier cache: always-on in-process LRU + optional Upstash Redis.
//
// Design goals
//  * Never make a request wait on Redis for a cache hit that memory already has.
//  * Never serve stale admin data after a write: every write calls
//    `cache.bump(namespace)`, which changes the namespace *version*. Cache keys
//    embed the version, so a bump instantly orphans every entry (memory and
//    Redis) without scanning or deleting keys.
//  * Collapse concurrent identical loads ("single flight") so 50 dashboard tabs
//    hitting a cold analytics endpoint cause exactly one aggregation.
//  * Fail open: if Redis is missing or broken the API still works, just without
//    the shared layer.
//
// Usage:
//   const { cached, bump, stats } = require('../config/cache');
//   const data = await cached('analytics', 'overview:7d', 15, loadAnalytics);
//   bump('analytics'); // after any write that changes the numbers

const { cacheGet, cacheSet, isEnabled } = require('./redis');

const MAX_ENTRIES = Number(process.env.CACHE_MAX_ENTRIES || 1000);
const VERSION_TTL = 60 * 60 * 24 * 7; // a week; versions are tiny strings
const VERSION_REFRESH_MS = Number(process.env.CACHE_VERSION_REFRESH_MS || 2000);
const DEFAULT_TTL = Number(process.env.CACHE_TTL_SECONDS || 30);

/** Minimal LRU: Map preserves insertion order, delete+set moves to the end. */
class LRU {
    constructor(max) {
        this.max = Math.max(50, max);
        this.map = new Map();
    }

    get(key) {
        const entry = this.map.get(key);
        if (!entry) return undefined;
        if (entry.expires <= Date.now()) {
            this.map.delete(key);
            return undefined;
        }
        // refresh recency
        this.map.delete(key);
        this.map.set(key, entry);
        return entry.value;
    }

    set(key, value, ttlSeconds) {
        if (this.map.has(key)) this.map.delete(key);
        this.map.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
        while (this.map.size > this.max) {
            const oldest = this.map.keys().next().value;
            this.map.delete(oldest);
        }
    }

    delete(key) {
        this.map.delete(key);
    }

    clear() {
        this.map.clear();
    }

    get size() {
        return this.map.size;
    }
}

const memory = new LRU(MAX_ENTRIES);

// namespace -> { version, checkedAt }
const versions = new Map();
const inflight = new Map();

const counters = {
    hits: 0,
    misses: 0,
    sharedHits: 0,
    loads: 0,
    errors: 0,
    coalesced: 0,
};

function localVersion(ns) {
    const entry = versions.get(ns);
    return entry ? entry.version : 0;
}

/**
 * Version of a namespace. Redis is consulted at most once per
 * VERSION_REFRESH_MS per namespace, so multi-instance deployments still see
 * writes from other instances within ~2s while single-instance traffic never
 * pays the network cost.
 */
async function getVersion(ns) {
    const entry = versions.get(ns);
    const now = Date.now();
    if (!entry) {
        versions.set(ns, { version: 0, checkedAt: 0 });
        return 0;
    }
    if (!isEnabled() || now - entry.checkedAt < VERSION_REFRESH_MS) {
        return entry.version;
    }
    entry.checkedAt = now;
    try {
        const remote = await cacheGet(`cache:ver:${ns}`);
        const parsed = Number(remote) || 0;
        if (parsed > entry.version) entry.version = parsed;
    } catch {
        // fail open
    }
    return entry.version;
}

/** Invalidate every cached value in a namespace. O(1). */
function bump(ns) {
    const entry = versions.get(ns) || { version: 0, checkedAt: 0 };
    entry.version += 1;
    entry.checkedAt = Date.now();
    versions.set(ns, entry);
    // Mirror to Redis so other instances invalidate too. Fire-and-forget.
    if (isEnabled()) {
        cacheSet(`cache:ver:${ns}`, String(entry.version), VERSION_TTL).catch(() => {});
    }
    return entry.version;
}

/** Bump several namespaces at once (a typical write touches 2-3 of them). */
function bumpAll(namespaces = []) {
    for (const ns of namespaces) bump(ns);
}

function keyFor(ns, version, key) {
    return `${ns}:v${version}:${key}`;
}

/**
 * Read-through cache helper with stampede protection.
 *
 * @param {string} ns         namespace, e.g. 'analytics'
 * @param {string} key        opaque key inside the namespace
 * @param {number} ttlSeconds fresh-for duration
 * @param {() => Promise<any>} loader
 * @returns {Promise<{ value: any, source: 'memory'|'shared'|'fresh' }>}
 */
async function cachedResult(ns, key, ttlSeconds, loader) {
    const version = await getVersion(ns);
    const fullKey = keyFor(ns, version, key);

    const mem = memory.get(fullKey);
    if (mem !== undefined) {
        counters.hits += 1;
        return { value: mem, source: 'memory' };
    }

    if (isEnabled()) {
        const shared = await cacheGet(fullKey);
        if (shared && typeof shared === 'object' && shared.__v === 1) {
            counters.sharedHits += 1;
            memory.set(fullKey, shared.data, Math.max(1, ttlSeconds));
            return { value: shared.data, source: 'shared' };
        }
    }

    counters.misses += 1;

    if (inflight.has(fullKey)) {
        counters.coalesced += 1;
        return { value: await inflight.get(fullKey), source: 'fresh' };
    }

    const promise = runLoader(ns, fullKey, ttlSeconds, loader);
    inflight.set(fullKey, promise);
    try {
        return { value: await promise, source: 'fresh' };
    } finally {
        inflight.delete(fullKey);
    }
}

async function runLoader(ns, fullKey, ttlSeconds, loader) {
    counters.loads += 1;
    const value = await loader();
    const ttl = Number(ttlSeconds) > 0 ? Number(ttlSeconds) : DEFAULT_TTL;
    memory.set(fullKey, value, ttl);
    if (isEnabled()) {
        cacheSet(fullKey, { __v: 1, data: value }, ttl).catch(() => {});
    }
    return value;
}

/** Convenience wrapper returning just the value. */
async function cached(ns, key, ttlSeconds, loader) {
    const { value } = await cachedResult(ns, key, ttlSeconds, loader);
    return value;
}

/** Clear the in-process layer (tests / admin "refresh cache" action). */
function clearLocal() {
    memory.clear();
    inflight.clear();
}

function stats() {
    return {
        entries: memory.size,
        maxEntries: memory.max,
        redis: isEnabled(),
        namespaces: Object.fromEntries([...versions].map(([k, v]) => [k, v.version])),
        ...counters,
        hitRate:
            counters.hits + counters.sharedHits + counters.misses === 0
                ? 0
                : Number(
                      (
                          ((counters.hits + counters.sharedHits) /
                              (counters.hits + counters.sharedHits + counters.misses)) *
                          100
                      ).toFixed(1)
                  ),
    };
}

module.exports = {
    cached,
    cachedResult,
    bump,
    bumpAll,
    clearLocal,
    stats,
    getVersion,
    DEFAULT_TTL,
};
