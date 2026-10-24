// Request instrumentation: correlation ids, Server-Timing, slow-query logging
// and a lightweight in-process latency profile used by /api/system/metrics.
//
// Everything here is designed to be free on the happy path: a couple of Date
// calls, a Map lookup and two response headers.

const SLOW_MS = Number(process.env.SLOW_REQUEST_MS || 400);
const SAMPLE_LIMIT = 500; // rolling latency samples per route
const ROUTE_LIMIT = 200;

const routes = new Map(); // "METHOD /normalised/path" -> { count, errors, totalMs, samples: [] }

function routeKey(req) {
    // Use the matched Express route pattern when available so ids/params do not
    // explode the metric cardinality.
    const path = (req.route && req.route.path) || req.baseUrl + (req.path === '/' ? '' : req.path);
    return `${req.method} ${req.baseUrl || ''}${path === '/' ? '' : path}`.replace(/\/\//g, '/');
}

function recordMetric(key, durationMs, status) {
    let entry = routes.get(key);
    if (!entry) {
        if (routes.size >= ROUTE_LIMIT) return; // bounded memory
        entry = { count: 0, errors: 0, totalMs: 0, samples: [] };
        routes.set(key, entry);
    }
    entry.count += 1;
    entry.totalMs += durationMs;
    if (status >= 500) entry.errors += 1;
    entry.samples.push(durationMs);
    if (entry.samples.length > SAMPLE_LIMIT) entry.samples.shift();
}

function quantile(sorted, q) {
    if (!sorted.length) return 0;
    const pos = Math.min(sorted.length - 1, Math.floor(q * sorted.length));
    return Math.round(sorted[pos] * 100) / 100;
}

function requestPerf(options = {}) {
    const { sampleRate = 1, logSlow = true } = options;
    return function perf(req, res, next) {
        const startedAt = process.hrtime.bigint();
        const id =
            req.headers['x-request-id'] ||
            `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

        req.id = id;
        req.startedAt = Date.now();
        res.setHeader('X-Request-Id', id);

        // Admin payloads must never sit in a shared CDN cache.
        if (req.path.startsWith('/api/')) {
            res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
        }

        // Headers must be set *before* the response is flushed, so we hook
        // writeHead (Node calls it for implicit headers too). The finish/close
        // handler below is only for metrics and logging.
        let timingApplied = false;
        const applyTimingHeader = () => {
            if (timingApplied || res.headersSent) return;
            timingApplied = true;
            try {
                const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
                const rounded = Math.round(durationMs * 10) / 10;
                const existing = res.getHeader('Server-Timing');
                const timing = `app;dur=${rounded}`;
                res.setHeader('Server-Timing', existing ? `${existing}, ${timing}` : timing);
                res.setHeader('X-Response-Time', `${rounded}ms`);
            } catch {
                /* nothing we can do */
            }
        };
        const originalWriteHead = res.writeHead.bind(res);
        res.writeHead = (...args) => {
            applyTimingHeader();
            return originalWriteHead(...args);
        };

        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
            const rounded = Math.round(durationMs * 10) / 10;

            // SSE streams stay open for minutes by design: they are neither
            // slow requests nor useful latency samples.
            const isStream = String(req.originalUrl || req.url || '').startsWith('/api/realtime/stream');

            if (!isStream && Math.random() < sampleRate) {
                recordMetric(routeKey(req), rounded, res.statusCode);
            }

            if (!isStream && logSlow && durationMs >= SLOW_MS) {
                console.warn(
                    `[slow] ${req.method} ${req.originalUrl} ${rounded}ms status=${res.statusCode} rid=${id}`
                );
            }
        };

        res.on('finish', finish);
        res.on('close', finish);
        next();
    };
}

function getMetrics() {
    const output = [];
    let totalCount = 0;
    let totalMs = 0;
    for (const [key, entry] of routes) {
        const sorted = [...entry.samples].sort((a, b) => a - b);
        totalCount += entry.count;
        totalMs += entry.totalMs;
        output.push({
            route: key,
            count: entry.count,
            errors: entry.errors,
            avgMs: Math.round((entry.totalMs / entry.count) * 100) / 100,
            p50Ms: quantile(sorted, 0.5),
            p95Ms: quantile(sorted, 0.95),
            maxMs: sorted.length ? Math.round(sorted[sorted.length - 1] * 100) / 100 : 0,
        });
    }
    output.sort((a, b) => b.count - a.count);
    return {
        uptimeSeconds: Math.round(process.uptime()),
        memory: {
            rssMb: Math.round((process.memoryUsage().rss / 1024 / 1024) * 10) / 10,
            heapUsedMb: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 10) / 10,
        },
        totals: {
            requests: totalCount,
            avgMs: totalCount ? Math.round((totalMs / totalCount) * 100) / 100 : 0,
        },
        slowest: output.slice(0, 25),
    };
}

function resetMetrics() {
    routes.clear();
}

module.exports = { requestPerf, getMetrics, resetMetrics };
