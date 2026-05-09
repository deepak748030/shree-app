// Migrate all per-device data from oldDeviceId -> newDeviceId.
// Used when an existing user (identified by mobile) logs in from a freshly
// installed/cleared app, so their device id changes.
const HandwrittenNaam = require('../models/HandwrittenNaam');
const StepTracker = require('../models/StepTracker');
const Wallet = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const Subscription = require('../models/Subscription');
const RewardClaim = require('../models/RewardClaim');
const Referral = require('../models/Referral');
const ReferralUse = require('../models/ReferralUse');

// Move a single-document (unique deviceId) collection. If a stale doc exists
// at the new id (created by the freshly-cleared app before login), delete it
// so the old (real) doc can take its place.
async function moveUnique(Model, field, oldId, newId, mergeFn = null) {
    try {
        const oldDoc = await Model.findOne({ [field]: oldId });
        if (!oldDoc) return;
        const newDoc = await Model.findOne({ [field]: newId, _id: { $ne: oldDoc._id } });
        if (newDoc && mergeFn) {
            await mergeFn(oldDoc, newDoc);
            await Model.deleteOne({ _id: oldDoc._id });
            return;
        }
        if (newDoc) await Model.deleteOne({ _id: newDoc._id });
        oldDoc[field] = newId;
        await oldDoc.save();
    } catch (err) {
        console.error(`migrateDeviceId moveUnique(${Model.modelName}.${field})`, err.message);
    }
}

function mergeDailyLogs(oldLogs = [], newLogs = [], valueFields = []) {
    const byDate = new Map();
    for (const log of [...oldLogs, ...newLogs]) {
        if (!log?.date) continue;
        const existing = byDate.get(log.date) || { date: log.date };
        for (const field of valueFields) {
            existing[field] = Math.max(Number(existing[field]) || 0, Number(log[field]) || 0);
        }
        if ('goal' in log) existing.goal = Number(log.goal) || existing.goal || 5000;
        byDate.set(log.date, existing);
    }
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date)).slice(-90);
}

async function moveMany(Model, field, oldId, newId) {
    try {
        await Model.updateMany({ [field]: oldId }, { $set: { [field]: newId } });
    } catch (err) {
        console.error(`migrateDeviceId moveMany(${Model.modelName}.${field})`, err.message);
    }
}

async function migrateDeviceId(oldDeviceId, newDeviceId) {
    if (!oldDeviceId || !newDeviceId || oldDeviceId === newDeviceId) return;

    await Promise.all([
        // unique-deviceId docs
        moveUnique(HandwrittenNaam, 'deviceId', oldDeviceId, newDeviceId),
        moveUnique(StepTracker, 'deviceId', oldDeviceId, newDeviceId),
        moveUnique(Wallet, 'deviceId', oldDeviceId, newDeviceId),
        moveUnique(Referral, 'ownerDeviceId', oldDeviceId, newDeviceId),
        moveUnique(ReferralUse, 'refereeDeviceId', oldDeviceId, newDeviceId),
        // many-rows-per-device collections
        moveMany(WalletTransaction, 'deviceId', oldDeviceId, newDeviceId),
        moveMany(WithdrawalRequest, 'deviceId', oldDeviceId, newDeviceId),
        moveMany(Subscription, 'deviceId', oldDeviceId, newDeviceId),
        moveMany(RewardClaim, 'deviceId', oldDeviceId, newDeviceId),
        moveMany(ReferralUse, 'referrerDeviceId', oldDeviceId, newDeviceId),
        moveMany(Referral, 'ownerDeviceId', oldDeviceId, newDeviceId), // safety, in case dup
    ]);
}

module.exports = { migrateDeviceId };
