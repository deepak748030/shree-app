const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema({
    count: { type: Number, required: true, min: 1 }, // e.g. 50, 100
    rewardAmount: { type: Number, default: 0, min: 0 }, // bonus credited to wallet
    title_hi: { type: String, default: '' },
    title_en: { type: String, default: '' },
    description_hi: { type: String, default: '' },
    description_en: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
}, { _id: false });

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

    // Configurable share message (use {code} placeholder)
    shareMessage_hi: {
        type: String,
        default: '🙏 श्री जी ऐप डाउनलोड करें!\n\nमेरा रेफरल कोड लगाएं: {code}\n\nनाम जप काउंटर और बहुत कुछ।\n\nजय श्री राधे! 🙏\n\nhttps://play.google.com/store/apps/details?id=com.shreejii.app'
    },
    shareMessage_en: {
        type: String,
        default: '🙏 Download Shree Ji App!\n\nUse my referral code: {code}\n\nNaam Jap Counter and much more.\n\nJai Shri Radhe! 🙏\n\nhttps://play.google.com/store/apps/details?id=com.shreejii.app'
    },

    // Milestone rewards (e.g. 50 referrals -> ₹500 bonus)
    milestones: { type: [milestoneSchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('ReferralSettings', referralSettingsSchema);
