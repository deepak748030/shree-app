const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
    referralCode: { type: String, required: true, unique: true, index: true, uppercase: true, trim: true },
    ownerDeviceId: { type: String, required: true, unique: true, index: true, trim: true },
    ownerMobile: { type: String, default: '', trim: true },
    ownerName: { type: String, default: '', trim: true },
    usageCount: { type: Number, default: 0 },
    totalEarned: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Referral', referralSchema);
