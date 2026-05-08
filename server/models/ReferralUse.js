const mongoose = require('mongoose');

const referralUseSchema = new mongoose.Schema({
    referralCode: { type: String, required: true, index: true, uppercase: true, trim: true },
    referrerDeviceId: { type: String, required: true, index: true, trim: true },
    referrerMobile: { type: String, default: '', trim: true },
    refereeDeviceId: { type: String, required: true, unique: true, index: true, trim: true },
    refereeMobile: { type: String, default: '', trim: true },
    refereeName: { type: String, default: '', trim: true },
    status: { type: String, enum: ['pending', 'credited', 'rejected'], default: 'pending', index: true },
    bonusCredited: { type: Number, default: 0 },
    refereeBonusCredited: { type: Number, default: 0 },
    creditedAt: { type: Date, default: null },
    note: { type: String, default: '' },
}, { timestamps: true });

referralUseSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ReferralUse', referralUseSchema);
