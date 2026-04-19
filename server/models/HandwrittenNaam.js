const mongoose = require('mongoose');

const dailyLogSchema = new mongoose.Schema({
    date: { type: String, required: true }, // YYYY-MM-DD (IST)
    count: { type: Number, default: 0 },
}, { _id: false });

const handwrittenNaamSchema = new mongoose.Schema({
    deviceId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true,
    },
    selectedMantra: {
        type: String,
        default: 'Om Namah Shivay',
        trim: true,
        maxlength: 200,
    },
    lifetimeCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    dailyLogs: {
        type: [dailyLogSchema],
        default: [],
    },
    lastSyncAt: {
        type: Date,
        default: Date.now,
    },
}, { timestamps: true });

module.exports = mongoose.model('HandwrittenNaam', handwrittenNaamSchema);
