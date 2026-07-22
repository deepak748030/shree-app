const mongoose = require('mongoose');

const gameScoreSchema = new mongoose.Schema({
    deviceId: { type: String, required: true, index: true, trim: true },
    mobile: { type: String, default: '', trim: true, index: true },
    name: { type: String, default: 'Guest', trim: true, maxlength: 100 },
    city: { type: String, default: '', trim: true, maxlength: 100 },
    profileImage: { type: String, default: '', trim: true },
    gameId: { type: String, required: true, index: true, trim: true },
    bestScore: { type: Number, default: 0, min: 0 },
    lastScore: { type: Number, default: 0, min: 0 },
    playCount: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

gameScoreSchema.index({ gameId: 1, deviceId: 1 }, { unique: true });
gameScoreSchema.index({ gameId: 1, bestScore: -1 });

module.exports = mongoose.model('GameScore', gameScoreSchema);