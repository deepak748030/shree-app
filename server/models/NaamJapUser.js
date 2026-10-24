const mongoose = require('mongoose');

const dailyLogSchema = new mongoose.Schema({
    date: { type: String, required: true }, // YYYY-MM-DD
    count: { type: Number, default: 0 },
    malas: { type: Number, default: 0 },
}, { _id: false });

const naamJapUserSchema = new mongoose.Schema({
    deviceId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true,
    },
    mobile: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
    },
    city: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
    },
    profileImage: {
        type: String,
        default: '',
        trim: true,
    },
    totalCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    totalMalas: {
        type: Number,
        default: 0,
        min: 0,
    },
    dailyLogs: {
        type: [dailyLogSchema],
        default: [],
    },
    pushToken: {
        type: String,
        default: null,
    },
    lastSyncAt: {
        type: Date,
        default: Date.now,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
});

// Indexes are added, never replaced: `ensureIndexes` only ever *creates*.
// Covered by the dashboard + leaderboard hot paths:
naamJapUserSchema.index({ isActive: 1, totalMalas: -1 });
naamJapUserSchema.index({ isActive: 1, totalCount: -1 });
naamJapUserSchema.index({ totalMalas: -1 });
// Daily-window aggregations filter on the array element before unwinding.
naamJapUserSchema.index({ isActive: 1, 'dailyLogs.date': 1 });
naamJapUserSchema.index({ 'dailyLogs.date': 1 });
// New-user counts and admin sorting.
naamJapUserSchema.index({ createdAt: -1 });
naamJapUserSchema.index({ isActive: 1, createdAt: -1 });
// Admin search (prefix-friendly).
naamJapUserSchema.index({ name: 1 });
naamJapUserSchema.index({ city: 1 });

module.exports = mongoose.model('NaamJapUser', naamJapUserSchema);
