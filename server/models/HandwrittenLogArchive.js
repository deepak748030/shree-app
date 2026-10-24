const mongoose = require('mongoose');

// Cold storage for handwritten-Naam per-day counts that fall out of the hot
// window on the user document. Same promise as DailyLogArchive: history is
// copied before it is trimmed, so nothing is ever silently lost.

const handwrittenLogArchiveSchema = new mongoose.Schema({
    deviceId: { type: String, required: true, trim: true },
    mobile: { type: String, default: '', trim: true },
    date: { type: String, required: true }, // YYYY-MM-DD (IST)
    count: { type: Number, default: 0 },
    mantra: { type: String, default: '', trim: true },
    archivedAt: { type: Date, default: Date.now },
    reason: { type: String, default: 'retention' },
});

handwrittenLogArchiveSchema.index({ deviceId: 1, date: 1 }, { unique: true });
handwrittenLogArchiveSchema.index({ date: -1 });

module.exports = mongoose.model('HandwrittenLogArchive', handwrittenLogArchiveSchema);
