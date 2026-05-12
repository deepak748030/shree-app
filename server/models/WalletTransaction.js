const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema({
    deviceId: { type: String, required: true, index: true, trim: true },
    mobile: { type: String, default: '', trim: true },
    type: { type: String, enum: ['credit_reward', 'credit_referral', 'credit_referral_referee', 'credit_referral_milestone', 'debit_withdrawal', 'debit_withdrawal_reverted'], required: true },
    amount: { type: Number, required: true }, // INR (positive number; type indicates direction)
    rewardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reward', default: null },
    rewardTitle: { type: String, default: '' },
    withdrawalId: { type: mongoose.Schema.Types.ObjectId, ref: 'WithdrawalRequest', default: null },
    referralUseId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReferralUse', default: null },
    note: { type: String, default: '' },
}, { timestamps: true });

walletTransactionSchema.index({ deviceId: 1, createdAt: -1 });

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);