// Single source of truth for "which day is it?" across the whole platform.
//
// Every daily counter, leaderboard window and analytics bucket is keyed by a
// YYYY-MM-DD string. Before this helper each route computed that string with
// the *server's* local timezone, which drifts between India (IST), Vercel
// (UTC) and a developer laptop. That produced mismatched "today" numbers in
// the app and the dashboard. All code must use these helpers.

const IST_OFFSET_MINUTES = 330; // UTC + 5:30, no DST
const DAY_MS = 24 * 60 * 60 * 1000;

function pad(n) {
    return String(n).padStart(2, '0');
}

/** Format a Date as YYYY-MM-DD using IST. */
function toDateString(date = new Date()) {
    const ist = new Date(date.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
    return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}`;
}

/** Today's IST date string (YYYY-MM-DD). */
function today() {
    return toDateString(new Date());
}

/** Date string `days` days before today (IST). Negative values go forward. */
function daysAgo(days) {
    return toDateString(new Date(Date.now() - days * DAY_MS));
}

/**
 * Inclusive list of the last `count` IST date strings, oldest first.
 * daysWindow(7) -> [6 days ago, ..., today]
 */
function daysWindow(count) {
    const out = [];
    for (let i = count - 1; i >= 0; i--) out.push(daysAgo(i));
    return out;
}

/** A human label like "24 Oct" for charts. */
function shortLabel(dateString) {
    const [y, m, d] = String(dateString).split('-').map(Number);
    if (!y || !m || !d) return dateString;
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        timeZone: 'UTC',
    });
}

/** Start (UTC instant) of the IST day that contains `date`. */
function startOfISTDay(date = new Date()) {
    const shifted = new Date(date.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
    shifted.setUTCHours(0, 0, 0, 0);
    return new Date(shifted.getTime() - IST_OFFSET_MINUTES * 60 * 1000);
}

/** `n` days before now as a Date (used for createdAt filters). */
function dateMinusDays(days) {
    return new Date(Date.now() - days * DAY_MS);
}

/** IST midnight `days` before today, as a Date. */
function startOfISTDayMinusDays(days) {
    return startOfISTDay(new Date(Date.now() - days * DAY_MS));
}

module.exports = {
    IST_OFFSET_MINUTES,
    DAY_MS,
    toDateString,
    today,
    daysAgo,
    daysWindow,
    shortLabel,
    startOfISTDay,
    dateMinusDays,
    startOfISTDayMinusDays,
};
