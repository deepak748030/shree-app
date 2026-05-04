const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
    deviceId: { type: String, required: true, unique: true, index: true, trim: true },
    mobile: { type: String, default: '', trim: true, index: true },
    balance: { type: Number, default: 0, min: 0 },        // INR
    totalEarned: { type: Number, default: 0, min: 0 },    // INR
    totalWithdrawn: { type: Number, default: 0, min: 0 }, // INR
}, { timestamps: true });

module.exports = mongoose.model('Wallet', walletSchema);