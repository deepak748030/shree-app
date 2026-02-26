const mongoose = require('mongoose');

const appVersionSchema = new mongoose.Schema({
    platform: {
        type: String,
        enum: ['android', 'ios'],
        required: true,
        unique: true,
    },
    requiredVersion: {
        type: String,
        required: true,
    },
    playStoreUrl: {
        type: String,
        default: '',
    },
    appStoreUrl: {
        type: String,
        default: '',
    },
    updateMessage_hi: {
        type: String,
        default: 'कृपया ऐप को अपडेट करें।',
    },
    updateMessage_en: {
        type: String,
        default: 'Please update the app to continue.',
    },
    isForceUpdate: {
        type: Boolean,
        default: true,
    },
}, { timestamps: true });

module.exports = mongoose.model('AppVersion', appVersionSchema);
