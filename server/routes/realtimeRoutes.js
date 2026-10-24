// Realtime endpoints used by both the admin dashboard and the mobile app.
//
//   GET /api/realtime/stream?topics=users,analytics   -> SSE (live push)
//   GET /api/realtime/poll?since=123&topics=users     -> missed events (fallback)
//   GET /api/realtime/version                         -> cheap change detection
//   GET /api/realtime/status                          -> hub + cache diagnostics
//
// Public topics do not require a token so the Expo app can listen for content
// updates. Anything administrative needs a valid admin JWT (header or ?token=).

const express = require('express');
const realtime = require('../config/realtime');
const cache = require('../config/cache');
const { optionalAdmin, verifyAdmin } = require('../middleware/auth');

const router = express.Router();

const PUBLIC_TOPICS = new Set(['system', 'content', 'quotes', 'leaderboard', 'stats', 'versions']);
const ADMIN_TOPICS = new Set([
    'analytics',
    'analyticsBiz',
    'users',
    'rewards',
    'withdrawals',
    'referrals',
    'subscriptions',
    'notifications',
    'settings',
    'admin',
]);
const ALL_TOPICS = new Set([...PUBLIC_TOPICS, ...ADMIN_TOPICS, '*']);

const NAMESPACES = [
    'analytics',
    'analyticsBiz',
    'users',
    'leaderboard',
    'stats',
    'quotes',
    'content',
    'plans',
    'subscriptions',
    'rewards',
    'withdrawals',
    'referrals',
    'settings',
    'versions',
];

// A stream with no explicit topic list gets the public set: it keeps anonymous
// clients (mobile app, marketing site) working without leaking admin activity
// through a wildcard subscription.
const DEFAULT_TOPICS = [...PUBLIC_TOPICS];

function parseTopics(raw) {
    if (!raw) return DEFAULT_TOPICS;
    const list = String(raw)
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t && ALL_TOPICS.has(t));
    return list.length ? list : DEFAULT_TOPICS;
}

function needsAdmin(topics) {
    if (topics.includes('*')) return true;
    return topics.some((t) => ADMIN_TOPICS.has(t));
}

router.get('/stream', optionalAdmin, (req, res) => {
    const topics = parseTopics(req.query.topics);
    if (needsAdmin(topics) && !req.admin) {
        return res.status(401).json({ success: false, message: 'Admin token required for these topics' });
    }

    // Disable any proxy buffering and keep the socket open.
    req.socket.setTimeout(0);
    req.socket.setNoDelay(true);
    req.socket.setKeepAlive(true, 15000);

    const client = realtime.attachStream(req, res, topics);
    if (!client) {
        return; // connection refused, response already ended
    }

    // Replay anything the client missed while it was away (Last-Event-ID is set
    // automatically by the browser EventSource on reconnect).
    const since = req.headers['last-event-id'] || req.query.since;
    if (since) {
        const missed = realtime.eventsSince(since, topics);
        for (const event of missed.slice(-50)) {
            try {
                res.write(`id: ${event.id}\nevent: message\ndata: ${JSON.stringify(event)}\n\n`);
            } catch {
                break;
            }
        }
    }
});

router.get('/poll', optionalAdmin, (req, res) => {
    const topics = parseTopics(req.query.topics);
    if (needsAdmin(topics) && !req.admin) {
        return res.status(401).json({ success: false, message: 'Admin token required for these topics' });
    }
    const events = realtime.eventsSince(req.query.since, topics);
    res.set('Cache-Control', 'no-store');
    res.json({
        success: true,
        response: {
            events: events.slice(-100),
            lastEventId: realtime.currentSeq(),
            serverTime: new Date().toISOString(),
        },
    });
});

router.get('/version', async (req, res) => {
    const requested = String(req.query.namespaces || '')
        .split(',')
        .map((n) => n.trim())
        .filter((n) => NAMESPACES.includes(n));
    const namespaces = requested.length ? requested : NAMESPACES;
    const versions = {};
    for (const ns of namespaces) {
        versions[ns] = await cache.getVersion(ns);
    }
    res.set('Cache-Control', 'no-store');
    res.json({
        success: true,
        response: {
            versions,
            lastEventId: realtime.currentSeq(),
            serverTime: new Date().toISOString(),
            today: require('../utils/ist').today(),
        },
    });
});

router.get('/status', verifyAdmin, (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({
        success: true,
        response: {
            hub: realtime.hubStats(),
            cache: cache.stats(),
            serverTime: new Date().toISOString(),
        },
    });
});

module.exports = router;
