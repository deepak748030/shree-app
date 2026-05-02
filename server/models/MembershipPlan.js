const mongoose = require('mongoose');

const membershipPlanSchema = new mongoose.Schema({
    name_hi: { type: String, required: true, trim: true, maxlength: 100 },
    name_en: { type: String, required: true, trim: true, maxlength: 100 },
    description_hi: { type: String, default: '', trim: true, maxlength: 500 },
    description_en: { type: String, default: '', trim: true, maxlength: 500 },
    price: { type: Number, required: true, min: 1 }, // in INR (rupees)
    durationMonths: { type: Number, required: true, min: 1 }, // 0 = lifetime not allowed; use big number for lifetime
    isLifetime: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isBestValue: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

membershipPlanSchema.index({ isActive: 1, sortOrder: 1 });

module.exports = mongoose.model('MembershipPlan', membershipPlanSchema);
