require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
require('./config/redis');

const { requestPerf } = require('./middleware/perf');
const cache = require('./config/cache');
const realtime = require('./config/realtime');

// Route imports
const adminRoutes = require('./routes/adminRoutes');
const dailyQuoteRoutes = require('./routes/dailyQuoteRoutes');
const naamJapRoutes = require('./routes/naamJapRoutes');
const homeContentRoutes = require('./routes/homeContentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const presetImageRoutes = require('./routes/presetImageRoutes');
const stepTrackerRoutes = require('./routes/stepTrackerRoutes');
const appVersionRoutes = require('./routes/appVersionRoutes');
const donationRoutes = require('./routes/donationRoutes');
const handwrittenNaamRoutes = require('./routes/handwrittenNaamRoutes');
const handwrittenAdminRoutes = require('./routes/handwrittenAdminRoutes');
const membershipRoutes = require('./routes/membershipRoutes');
const rewardRoutes = require('./routes/rewardRoutes');
const referralRoutes = require('./routes/referralRoutes');
const gameRoutes = require('./routes/gameRoutes');
const realtimeRoutes = require('./routes/realtimeRoutes');
const systemRoutes = require('./routes/systemRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// Behind Vercel/nginx/Cloudflare we want the real client IP for rate limiting.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// CORS: `*` by default so Expo web, previews and native clients all work.
// Set CORS_ORIGINS to a comma separated allowlist to lock it down in production.
const allowedOrigins = String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

app.use(
    cors({
        origin: allowedOrigins.length
            ? (origin, callback) => {
                  // Allow same-origin/no-origin requests (curl, native apps).
                  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
                  return callback(null, false);
              }
            : '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'If-None-Match', 'Last-Event-ID'],
        exposedHeaders: ['X-Request-Id', 'X-Response-Time', 'Server-Timing', 'X-Cache', 'ETag', 'Retry-After'],
        maxAge: 86400,
    })
);

// gzip/brotli-friendly compression. `threshold` keeps tiny JSON payloads
// uncompressed (compressing them costs more CPU than it saves).
app.use(compression({ threshold: 1024, level: 6 }));

app.use(express.json({ limit: '4.5mb' }));
app.use(express.urlencoded({ limit: '4.5mb', extended: true }));

// Request ids, Server-Timing and slow-request logging for every route.
app.use(requestPerf());

// Strong ETags let browsers revalidate cheaply; combined with the cache layer
// most dashboard requests never touch MongoDB at all.
app.set('etag', 'strong');

// Liveness does not depend on the database, so infrastructure can verify
// the process even if MongoDB is temporarily unavailable.
app.get('/api/health', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({
        success: true,
        message: 'Shree Jii API Server is running',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
    });
});

// Realtime + system endpoints are mounted before the database gate: an SSE
// stream must stay open even while the DB is reconnecting, and /health/metrics
// must answer when MongoDB is down.
app.use('/api/realtime', realtimeRoutes);
app.use('/api/system', systemRoutes);

// Database connection middleware for serverless
const dbMiddleware = async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (error) {
        console.error('Database connection failed:', error.message);
        res.status(503).json({
            success: false,
            message: 'Unable to connect to database. Please try again.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
};

// One table for both mounting and route-existence checks. Keeping them in a
// single place means a typo'd URL can never be mistaken for an outage.
const mounts = [
    ['/admin', adminRoutes],
    ['/daily-quotes', dailyQuoteRoutes],
    ['/naam-jap', naamJapRoutes],
    ['/home-content', homeContentRoutes],
    ['/notifications', notificationRoutes],
    ['/preset-images', presetImageRoutes],
    ['/step-tracker', stepTrackerRoutes],
    ['/app-version', appVersionRoutes],
    ['/donation', donationRoutes],
    ['/handwritten-naam', handwrittenAdminRoutes],
    ['/handwritten-naam', handwrittenNaamRoutes],
    ['/membership', membershipRoutes],
    ['/rewards', rewardRoutes],
    ['/referrals', referralRoutes],
    ['/games', gameRoutes],
];

// `req.path` is already relative to the /api mount here.
const isKnownApiPath = (path) =>
    mounts.some(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));

const apiRouter = express.Router();

// Unknown endpoints are answered *before* the database gate: a wrong URL should
// be a fast 404 whether or not MongoDB is reachable.
apiRouter.use((req, res, next) => {
    if (!isKnownApiPath(req.path)) return next();
    return dbMiddleware(req, res, next);
});

for (const [prefix, router] of mounts) {
    apiRouter.use(prefix, router);
}

app.use('/api', apiRouter);

// Root route
app.get('/', (req, res) => {
    res.json({ success: true, message: 'Shree Jii API Server' });
});

// Unknown API routes should be JSON, not the SPA fallback.
app.use('/api', (req, res) => {
    res.status(404).json({ success: false, message: `Unknown endpoint: ${req.method} ${req.originalUrl}` });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(`[${req.id || '-'}] Unhandled error:`, err.stack || err.message);
    if (res.headersSent) return next(err);
    res.status(err.status || 500).json({
        success: false,
        message: err.expose ? err.message : 'Something went wrong!',
        requestId: req.id,
    });
});

// Only start server if not in serverless environment
let server = null;
if (process.env.NODE_ENV !== 'production' || process.env.START_SERVER === '1') {
    server = app.listen(PORT, HOST, () => {
        console.log(`Shree Jii Server running on http://${HOST}:${PORT}`);
        console.log(`  realtime : GET /api/realtime/stream`);
        console.log(`  metrics  : GET /api/system/metrics`);
        console.log(`  cache    : ${cache.stats().redis ? 'memory + redis' : 'memory only'}`);
    });

    // Keep-alive slightly above the typical load-balancer idle timeout so
    // sockets are reused instead of re-established for every request.
    server.keepAliveTimeout = Number(process.env.KEEP_ALIVE_TIMEOUT_MS || 65000);
    server.headersTimeout = server.keepAliveTimeout + 5000;

    const shutdown = async (signal) => {
        console.log(`\n[${signal}] shutting down…`);
        try {
            realtime.publish('system', 'shutdown', { signal });
        } catch {
            /* ignore */
        }
        server.close(() => {
            mongoose.connection.close(false).finally(() => process.exit(0));
        });
        // Hard stop if something refuses to close.
        setTimeout(() => process.exit(0), 10000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = app;
