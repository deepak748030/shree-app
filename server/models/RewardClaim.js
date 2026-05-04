const mongoose = require('mongoose');

const rewardClaimSchema = new mongoose.Schema({
    deviceId: { type: String, required: true, index: true, trim: true },
    rewardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reward', required: true, index: true },
}, { timestamps: true });

rewardClaimSchema.index({ deviceId: 1, rewardId: 1 }, { unique: true });

module.exports = mongoose.model('RewardClaim', rewardClaimSchema);
