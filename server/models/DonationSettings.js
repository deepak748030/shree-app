const mongoose = require('mongoose');

const donationSettingsSchema = new mongoose.Schema({
    upiId: {
        type: String,
        default: '',
        trim: true,
    },
    accountNumber: {
        type: String,
        default: '',
        trim: true,
    },
    ifscCode: {
        type: String,
        default: '',
        trim: true,
    },
    accountHolderName: {
        type: String,
        default: '',
        trim: true,
    },
    bankName: {
        type: String,
        default: '',
        trim: true,
    },
    scannerImage: {
        type: String,
        default: '',
    },
    scannerPublicId: {
        type: String,
        default: '',
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    note_hi: {
        type: String,
        default: '',
    },
    note_en: {
        type: String,
        default: '',
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('DonationSettings', donationSettingsSchema);
