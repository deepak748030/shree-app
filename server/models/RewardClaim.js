const mongoose = require('mongoose');

const rewardClaimSchema = new mongoose.Schema({
    deviceId: { type: String, required: true, index: true, trim: true },
    // Mobile is the stable user identity. deviceId can change when app data is
    // cleared/reinstalled, so this prevents the same account claiming again.
    mobile: { type: String, trim: true, index: true },
    rewardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reward', required: true, index: true },
}, { timestamps: true });

rewardClaimSchema.index({ deviceId: 1, rewardId: 1 }, { unique: true });
rewardClaimSchema.index({ mobile: 1, rewardId: 1 }, { unique: true, sparse: true });
rewardClaimSchema.index({ createdAt: -1 });

module.exports = mongoose.model('RewardClaim', rewardClaimSchema);
