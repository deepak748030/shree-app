const mongoose = require('mongoose');

const referralSettingsSchema = new mongoose.Schema({
    isEnabled: { type: Boolean, default: true },
    referrerBonus: { type: Number, default: 10, min: 0 },
    refereeBonus: { type: Number, default: 0, min: 0 },
    eligibility: {
        type: String,
        enum: ['members_only', 'non_members_only', 'both'],
        default: 'both',
    },
    title_hi: { type: String, default: 'दोस्तों को आमंत्रित करें' },
    title_en: { type: String, default: 'Invite Friends' },
    description_hi: { type: String, default: 'अपना रेफरल कोड साझा करें और इनाम पाएं।' },
    description_en: { type: String, default: 'Share your referral code and earn rewards.' },
    howItWorks_hi: { type: String, default: 'अपना कोड दोस्त को दें। जब वे ऐप में कोड लगाएंगे, आपको इनाम मिलेगा।' },
    howItWorks_en: { type: String, default: 'Share your code with a friend. When they apply it in the app, you get a reward.' },
}, { timestamps: true });

module.exports = mongoose.model('ReferralSettings', referralSettingsSchema);
