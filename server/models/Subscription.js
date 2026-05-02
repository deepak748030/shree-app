const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    deviceId: { type: String, required: true, index: true, trim: true },
    mobile: { type: String, default: '', trim: true, index: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'MembershipPlan', required: true },
    planSnapshot: {
        name_hi: String,
        name_en: String,
        price: Number,
        durationMonths: Number,
        isLifetime: Boolean,
    },
    razorpayOrderId: { type: String, required: true, index: true },
    razorpayPaymentId: { type: String, default: '' },
    razorpaySignature: { type: String, default: '' },
    amount: { type: Number, required: true }, // in paise
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: ['created', 'paid', 'failed', 'refunded'], default: 'created', index: true },
    startsAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
}, { timestamps: true });

subscriptionSchema.index({ deviceId: 1, status: 1, expiresAt: -1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
