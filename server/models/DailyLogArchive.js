const mongoose = require('mongoose');

// Cold storage for per-day Naam Jap logs that fall out of the hot window.
//
// The user document keeps a rolling window of daily logs so it stays small and
// fast to read/write. Previously, logs older than that window were silently
// deleted — real user history was being lost. Now every trimmed log is copied
// here first (upsert + unique index, so replaying a trim is idempotent) and
// only then removed from the hot document. Nothing is ever dropped silently.

const dailyLogArchiveSchema = new mongoose.Schema({
    deviceId: { type: String, required: true, trim: true },
    mobile: { type: String, default: '', trim: true },
    name: { type: String, default: '', trim: true },
    city: { type: String, default: '', trim: true },
    date: { type: String, required: true }, // YYYY-MM-DD (IST)
    count: { type: Number, default: 0 },
    malas: { type: Number, default: 0 },
    archivedAt: { type: Date, default: Date.now },
    reason: { type: String, default: 'retention' },
}, { timestamps: false });

dailyLogArchiveSchema.index({ deviceId: 1, date: 1 }, { unique: true });
dailyLogArchiveSchema.index({ date: -1 });
dailyLogArchiveSchema.index({ mobile: 1 });

module.exports = mongoose.model('DailyLogArchive', dailyLogArchiveSchema);
