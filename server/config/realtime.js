// Realtime event hub (Server-Sent Events) with topic fan-out.
//
// Why SSE and not WebSocket: the dashboard is a browser on Vercel, where
// long-lived WebSocket servers are an extra moving part. SSE rides on plain
// HTTP/2, reconnects natively, survives proxies, and needs zero client deps.
//
// Guarantees
//  * One event log per process with monotonically increasing ids, so a client
//    that reconnects can replay what it missed (`?since=`).
//  * Throttled publishing: Naam Jap syncs fire several times per second across
//    all users. Publishing every single one would melt both server and browser,
//    so identical (topic, type) events are coalesced inside a window while the
//    trailing event is always delivered.
//  * Cache coupling: `publish(topic, type, payload, { invalidate })` bumps the
//    cache namespaces *before* notifying clients, so any client that reacts by
//    refetching is guaranteed to see the new value (no read-your-write races).
//  * Fail-safe: publishing never throws; a broken socket can never fail a write.

const { bump } = require('./cache');
const { today } = require('../utils/ist');

const MAX_LOG = Number(process.env.REALTIME_LOG_SIZE || 250);
const HEARTBEAT_MS = Number(process.env.REALTIME_HEARTBEAT_MS || 25000);
const THROTTLE_MS = Number(process.env.REALTIME_THROTTLE_MS || 1500);
const MAX_CLIENTS = Number(process.env.REALTIME_MAX_CLIENTS || 5000);

/** topic -> Set<{ res, id }> */
const clients = new Map();
/** rolling event log for replay on reconnect */
const log = [];
let seq = 0;
const lastEmit = new Map(); // `${topic}:${type}` -> timestamp
const pendingTrailing = new Map(); // same key -> payload to emit later

const stats = {
    published: 0,
    delivered: 0,
    dropped: 0,
    coalesced: 0,
    connections: 0,
    peakClients: 0,
};

function addClient(res, topics = ['*']) {
    if (clients.size >= MAX_CLIENTS) {
        stats.dropped += 1;
        return null;
    }
    const id = ++seq;
    const client = { id, res, topics: new Set(topics), connectedAt: Date.now() };
    res.__rtClient = client;
    for (const topic of topics) {
        if (!clients.has(topic)) clients.set(topic, new Set());
        clients.get(topic).add(client);
    }
    stats.connections += 1;
    if (clients.size > 0) {
        const total = [...clients.values()].reduce((n, set) => n + set.size, 0);
        stats.peakClients = Math.max(stats.peakClients, total);
    }
    return client;
}

function removeClient(client) {
    if (!client) return;
    for (const topic of client.topics) {
        const set = clients.get(topic);
        if (!set) continue;
        set.delete(client);
        if (set.size === 0) clients.delete(topic);
    }
}

function writeEvent(res, event) {
    try {
        const lines = [];
        if (event.id) lines.push(`id: ${event.id}`);
        // Always use the default SSE event name; the concrete type travels in
        // the JSON body. This lets a plain `es.onmessage` client receive every
        // topic without registering a listener per event name.
        lines.push('event: message');
        lines.push(`data: ${JSON.stringify(event)}`);
        res.write(`${lines.join('\n')}\n\n`);
        return true;
    } catch {
        return false;
    }
}

function record(event) {
    log.push(event);
    if (log.length > MAX_LOG) log.splice(0, log.length - MAX_LOG);
}

function deliver(event) {
    const targets = new Set();
    const wildcard = clients.get('*');
    if (wildcard) for (const c of wildcard) targets.add(c);
    const topicSet = clients.get(event.topic);
    if (topicSet) for (const c of topicSet) targets.add(c);

    let sent = 0;
    for (const client of targets) {
        if (writeEvent(client.res, event)) sent += 1;
    }
    stats.delivered += sent;
    return sent;
}

/**
 * Publish an event immediately.
 * @param {string} topic    e.g. 'users', 'analytics', 'quotes'
 * @param {string} type     e.g. 'sync', 'created', 'updated'
 * @param {object} payload  small JSON payload (ids, deltas, counts)
 * @param {object} [opts]
 * @param {string[]} [opts.invalidate] cache namespaces to bump first
 */
function publish(topic, type, payload = {}, opts = {}) {
    try {
        if (opts.invalidate && opts.invalidate.length) {
            for (const ns of opts.invalidate) bump(ns);
        }
        const event = {
            id: ++seq,
            topic,
            type,
            at: new Date().toISOString(),
            day: today(),
            data: payload,
        };
        record(event);
        stats.published += 1;
        deliver(event);
        return event;
    } catch (err) {
        console.error('[realtime] publish failed:', err.message);
        return null;
    }
}

/**
 * Publish at most once per THROTTLE_MS per (topic, type), always delivering the
 * trailing update. Used on hot paths like Naam Jap sync so the dashboard still
 * feels live without a storm of refetches.
 */
function publishThrottled(topic, type, payload = {}, opts = {}) {
    const key = `${topic}:${type}`;
    const now = Date.now();
    const last = lastEmit.get(key) || 0;
    const elapsed = now - last;

    if (elapsed >= THROTTLE_MS) {
        lastEmit.set(key, now);
        return publish(topic, type, payload, opts);
    }

    stats.coalesced += 1;
    pendingTrailing.set(key, { payload, opts });
    if (!pendingTrailing.get(`__timer:${key}`)) {
        const timer = setTimeout(() => {
            pendingTrailing.delete(`__timer:${key}`);
            const next = pendingTrailing.get(key);
            pendingTrailing.delete(key);
            if (next) {
                lastEmit.set(key, Date.now());
                publish(topic, type, next.payload, next.opts);
            }
        }, THROTTLE_MS - elapsed);
        if (typeof timer.unref === 'function') timer.unref();
        pendingTrailing.set(`__timer:${key}`, timer);
    }
    return null;
}

/** Events after a given id (for `?since=` reconnect replay / native polling). */
function eventsSince(sinceId, topics = null) {
    const since = Number(sinceId) || 0;
    return log.filter(
        (e) => e.id > since && (!topics || topics.length === 0 || topics.includes(e.topic) || topics.includes('*'))
    );
}

function currentSeq() {
    return seq;
}

/** Attach heartbeat + cleanup to an Express SSE response. */
function attachStream(req, res, topics) {
    res.status(200);
    res.set({
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // disable nginx buffering
    });
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const client = addClient(res, topics);
    if (!client) {
        res.end();
        return null;
    }

    // Tell the browser how long to wait before reconnecting.
    res.write('retry: 3000\n\n');
    writeEvent(res, {
        id: seq,
        topic: 'system',
        type: 'ready',
        at: new Date().toISOString(),
        data: { topics: [...client.topics], lastEventId: seq, heartbeatMs: HEARTBEAT_MS },
    });

    const heartbeat = setInterval(() => {
        try {
            res.write(`: ping ${Date.now()}\n\n`);
            writeEvent(res, { id: ++seq, topic: 'system', type: 'heartbeat', at: new Date().toISOString(), data: {} });
        } catch {
            cleanup();
        }
    }, HEARTBEAT_MS);
    if (typeof heartbeat.unref === 'function') heartbeat.unref();

    let closed = false;
    function cleanup() {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        removeClient(client);
        try {
            res.end();
        } catch {
            /* already gone */
        }
    }

    req.on('close', cleanup);
    req.on('error', cleanup);
    res.on('error', cleanup);
    return client;
}

function hubStats() {
    const byTopic = {};
    for (const [topic, set] of clients) byTopic[topic] = set.size;
    return {
        ...stats,
        lastEventId: seq,
        clients: [...new Set([...clients.values()].flatMap((s) => [...s]))].length,
        byTopic,
        logSize: log.length,
    };
}

// Keep a heartbeat-friendly timer reference so tests can shut the process down.
const housekeeping = setInterval(() => {
    for (const [key] of pendingTrailing) {
        if (key.startsWith('__timer:')) continue;
    }
}, 60000);
if (typeof housekeeping.unref === 'function') housekeeping.unref();

module.exports = {
    publish,
    publishThrottled,
    attachStream,
    eventsSince,
    currentSeq,
    hubStats,
};
