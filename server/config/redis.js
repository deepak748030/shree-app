// Upstash Redis (REST) wrapper — safe for serverless (no persistent TCP).
// Fails open: if env vars are missing or Redis errors, callers get null/false
// and the route falls back to the database.
const { Redis } = require('@upstash/redis');

let client = null;
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

if (url && token) {
    try {
        client = new Redis({ url, token });
        console.log('[redis] Upstash client initialised');
    } catch (err) {
        console.error('[redis] init failed:', err.message);
        client = null;
    }
} else {
    console.warn('[redis] UPSTASH_REDIS_REST_URL/TOKEN not set — caching disabled');
}

const isEnabled = () => !!client;

async function cacheGet(key) {
    if (!client) return null;
    try {
        return await client.get(key);
    } catch (err) {
        console.error('[redis] get error', key, err.message);
        return null;
    }
}

async function cacheSet(key, value, ttlSeconds = 300) {
    if (!client) return false;
    try {
        await client.set(key, value, { ex: ttlSeconds });
        return true;
    } catch (err) {
        console.error('[redis] set error', key, err.message);
        return false;
    }
}

async function cacheDel(...keys) {
    if (!client || keys.length === 0) return false;
    try {
        await client.del(...keys);
        return true;
    } catch (err) {
        console.error('[redis] del error', err.message);
        return false;
    }
}

// Delete every key matching a pattern (e.g. "dq:recent:*"). Uses SCAN so it's
// safe to call against larger keyspaces.
async function cacheDelPattern(pattern) {
    if (!client) return false;
    try {
        let cursor = 0;
        do {
            const res = await client.scan(cursor, { match: pattern, count: 100 });
            cursor = Number(res[0]) || 0;
            const keys = res[1] || [];
            if (keys.length) await client.del(...keys);
        } while (cursor !== 0);
        return true;
    } catch (err) {
        console.error('[redis] del-pattern error', pattern, err.message);
        return false;
    }
}

// Express middleware that caches a JSON GET response under `keyFn(req)` for
// `ttl` seconds. Skips caching on non-2xx responses.
function cacheRoute(keyFn, ttl = 300) {
    return async (req, res, next) => {
        if (!client) return next();
        let key;
        try { key = keyFn(req); } catch { return next(); }
        if (!key) return next();

        const cached = await cacheGet(key);
        if (cached) {
            res.set('X-Cache', 'HIT');
            return res.json(cached);
        }

        res.set('X-Cache', 'MISS');
        const originalJson = res.json.bind(res);
        res.json = (body) => {
            if (res.statusCode >= 200 && res.statusCode < 300 && body && body.success !== false) {
                cacheSet(key, body, ttl).catch(() => {});
            }
            return originalJson(body);
        };
        next();
    };
}

module.exports = { isEnabled, cacheGet, cacheSet, cacheDel, cacheDelPattern, cacheRoute };
