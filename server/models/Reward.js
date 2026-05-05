const mongoose = require('mongoose');

const rewardSchema = new mongoose.Schema({
    title_hi: { type: String, required: true, trim: true, maxlength: 100 },
    title_en: { type: String, required: true, trim: true, maxlength: 100 },
    description_hi: { type: String, default: '', trim: true, maxlength: 500 },
    description_en: { type: String, default: '', trim: true, maxlength: 500 },
    // All set targets (>0) must be reached (AND). At least one must be > 0.
    japTarget: { type: Number, default: 0, min: 0 },
    stepsTarget: { type: Number, default: 0, min: 0 },
    handwrittenTarget: { type: Number, default: 0, min: 0 },
    // Reward amount in INR (rupees)
    rewardAmount: { type: Number, required: true, min: 0 },
    // 'lifetime' = compares against user's totalCount + totalSteps
    // 'daily'    = compares against today's count + today's steps
    type: { type: String, enum: ['lifetime', 'daily'], default: 'lifetime' },
    icon: { type: String, default: 'trophy', trim: true, maxlength: 50 },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

rewardSchema.index({ isActive: 1, sortOrder: 1 });

module.exports = mongoose.model('Reward', rewardSchema);