const mongoose = require('mongoose');

// Connection handling tuned for serverless + long-lived containers.
//
//  * `serverSelectionTimeoutMS` keeps a dead database from stalling requests
//    for the driver's default 30s. Five seconds is plenty on a LAN/Atlas.
//  * A failed attempt arms a short cooldown so a burst of traffic does not
//    hammer a database that is already known to be down.
//  * `bufferCommands: false` means queries fail fast instead of queueing
//    forever when the connection drops.
//  * `maxPoolSize` sized for our workload: the API is mostly reads, and every
//    hot path is served from the cache.

const SELECTION_TIMEOUT_MS = Number(process.env.DB_TIMEOUT_MS || 5000);
const RETRY_COOLDOWN_MS = Number(process.env.DB_RETRY_COOLDOWN_MS || 3000);

let cached = global.mongoose;
if (!cached) {
    cached = global.mongoose = { conn: null, promise: null, failedAt: 0, failures: 0 };
}

mongoose.set('strictQuery', true);

async function connectDB() {
    if (cached.conn && mongoose.connection.readyState === 1) {
        return cached.conn;
    }

    // Circuit breaker: after a failure, fail fast for a cooldown that doubles
    // with each consecutive failure (3s → 6s → 12s → … max 30s). A burst of
    // traffic while the database is down therefore costs one slow attempt per
    // window instead of one per request.
    const cooldown = Math.min(
        30_000,
        RETRY_COOLDOWN_MS * 2 ** Math.max(0, (cached.failures || 1) - 1)
    );
    if (!cached.promise && cached.failedAt && Date.now() - cached.failedAt < cooldown) {
        throw new Error('Database unavailable (retry cooldown)');
    }

    if (!cached.promise) {
        const opts = {
            bufferCommands: false,
            serverSelectionTimeoutMS: SELECTION_TIMEOUT_MS,
            connectTimeoutMS: SELECTION_TIMEOUT_MS,
            socketTimeoutMS: 45000,
            maxPoolSize: Number(process.env.DB_MAX_POOL || 10),
            minPoolSize: 0,
            maxIdleTimeMS: 60000,
            heartbeatFrequencyMS: 10000,
        };

        cached.promise = mongoose
            .connect(process.env.MONGODB_URI, opts)
            .then((instance) => {
                cached.failedAt = 0;
                cached.failures = 0;
                console.log(`[db] connected to ${instance.connection.name}`);
                return instance;
            })
            .catch((err) => {
                cached.failedAt = Date.now();
                cached.failures = (cached.failures || 0) + 1;
                throw err;
            });
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        cached.conn = null;
        throw e;
    }

    return cached.conn;
}

function dbStatus() {
    return {
        connected: mongoose.connection.readyState === 1,
        state: mongoose.connection.readyState,
        name: mongoose.connection.name || null,
        failedAt: cached.failedAt || null,
        consecutiveFailures: cached.failures || 0,
    };
}

module.exports = connectDB;
module.exports.dbStatus = dbStatus;
