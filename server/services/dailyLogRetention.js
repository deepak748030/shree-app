// Loss-free retention for per-device daily Naam Jap logs.
//
// Contract:
//   1. Copy every log older than the hot window into DailyLogArchive
//      (idempotent upserts, so a crash halfway through is safe to retry).
//   2. Only after the copy succeeds, pull those dates from the hot document.
//   3. A failure in step 1 leaves the hot document untouched — the data is
//      never deleted without a durable copy.
//
// The hot window is configurable (default 400 days). Lifetime totals
// (`totalCount` / `totalMalas`) are never touched by retention.

const DailyLogArchive = require('../models/DailyLogArchive');
const NaamJapUser = require('../models/NaamJapUser');
const ist = require('../utils/ist');

const RETAIN_DAYS = Number(process.env.DAILY_LOG_RETAIN_DAYS || 400);

function cutoffDate() {
    return ist.daysAgo(RETAIN_DAYS);
}

/**
 * Archive + prune a single user's old logs.
 * @returns {Promise<{ archived: number, retained: number }>}
 */
async function enforceRetention(user) {
    if (!user) return { archived: 0, retained: 0 };
    const logs = Array.isArray(user.dailyLogs) ? user.dailyLogs : [];
    const cutoff = cutoffDate();
    const stale = logs.filter((log) => log.date < cutoff);
    const retained = logs.length - stale.length;
    if (stale.length === 0) return { archived: 0, retained };

    // Step 1 — durable copy first.
    await DailyLogArchive.bulkWrite(
        stale.map((log) => ({
            updateOne: {
                filter: { deviceId: user.deviceId, date: log.date },
                update: {
                    $set: {
                        deviceId: user.deviceId,
                        mobile: user.mobile || '',
                        name: user.name || '',
                        city: user.city || '',
                        date: log.date,
                        count: log.count || 0,
                        malas: log.malas || 0,
                        archivedAt: new Date(),
                        reason: 'retention',
                    },
                },
                upsert: true,
            },
        })),
        { ordered: false }
    );

    // Step 2 — only now remove them from the hot document.
    await NaamJapUser.updateOne(
        { _id: user._id },
        { $pull: { dailyLogs: { date: { $lt: cutoff } } } }
    );

    return { archived: stale.length, retained };
}

/** Cheap check used on write paths so we do not run bulk work every sync. */
function needsRetention(user) {
    if (!user || !Array.isArray(user.dailyLogs) || user.dailyLogs.length === 0) return false;
    const cutoff = cutoffDate();
    // Hot documents are appended in date order; checking the oldest entry is
    // enough to decide whether a prune is due.
    let oldest = user.dailyLogs[0].date;
    for (const log of user.dailyLogs) if (log.date < oldest) oldest = log.date;
    return oldest < cutoff;
}

module.exports = { enforceRetention, needsRetention, RETAIN_DAYS, cutoffDate };
