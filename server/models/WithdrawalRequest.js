const mongoose = require('mongoose');

const withdrawalRequestSchema = new mongoose.Schema({
    deviceId: { type: String, required: true, index: true, trim: true },
    mobile: { type: String, default: '', trim: true, index: true },
    userName: { type: String, default: '' },
    amount: { type: Number, required: true, min: 1 }, // INR
    upiId: { type: String, required: true, trim: true, maxlength: 100 },
    status: { type: String, enum: ['pending', 'approved', 'paid', 'rejected'], default: 'pending', index: true },
    adminNote: { type: String, default: '', maxlength: 500 },
    processedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
}, { timestamps: true });

withdrawalRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);