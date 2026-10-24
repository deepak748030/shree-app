// Operational endpoints: deep health, latency profile, cache control.
//
//   GET  /api/system/health    -> liveness + DB ping + cache/hub summary (no auth)
//   GET  /api/system/metrics   -> per-route p50/p95 (admin)
//   POST /api/system/cache/flush -> drop caches after a bulk data fix (admin)

const express = require('express');
const mongoose = require('mongoose');
const cache = require('../config/cache');
const realtime = require('../config/realtime');
const { getMetrics, resetMetrics } = require('../middleware/perf');
const { verifyAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/health', async (req, res) => {
    const dbState = mongoose.connection.readyState; // 1 = connected
    const dbOk = dbState === 1;
    const payload = {
        success: dbOk,
        response: {
            status: dbOk ? 'ok' : 'degraded',
            uptimeSeconds: Math.round(process.uptime()),
            database: {
                connected: dbOk,
                state: dbState,
                name: mongoose.connection.name || null,
            },
            cache: cache.stats(),
            realtime: realtime.hubStats(),
            serverTime: new Date().toISOString(),
        },
    };
    res.status(dbOk ? 200 : 503).json(payload);
});

router.get('/metrics', verifyAdmin, (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, response: getMetrics() });
});

router.post('/metrics/reset', verifyAdmin, (req, res) => {
    resetMetrics();
    res.json({ success: true, message: 'Latency samples cleared' });
});

router.post('/cache/flush', verifyAdmin, (req, res) => {
    const namespaces = String(req.body?.namespaces || '')
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean);

    if (namespaces.length === 0) {
        cache.clearLocal();
        realtime.publish('system', 'cache-flushed', { scope: 'all' });
        return res.json({ success: true, message: 'Local cache cleared' });
    }

    const versions = {};
    for (const ns of namespaces) versions[ns] = cache.bump(ns);
    realtime.publish('system', 'cache-flushed', { scope: namespaces }, {});
    res.json({ success: true, message: 'Namespaces invalidated', response: { versions } });
});

module.exports = router;
