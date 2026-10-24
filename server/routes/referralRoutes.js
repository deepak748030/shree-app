const express = require('express');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const ReferralSettings = require('../models/ReferralSettings');
const Referral = require('../models/Referral');
const ReferralUse = require('../models/ReferralUse');
const Wallet = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');
const Subscription = require('../models/Subscription');
const NaamJapUser = require('../models/NaamJapUser');
const { cacheRoute, cacheDel } = require('../config/redis');
const { announce } = require('../config/announce');
const REF_SETTINGS_KEY = 'ref:settings';

const router = express.Router();

// Auth middleware
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ success: false, message: 'No token' });
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const admin = await Admin.findById(decoded.id);
        if (!admin) return res.status(401).json({ success: false, message: 'Admin not found' });
        req.admin = admin;
        next();
    } catch {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

async function isMember(deviceId) {
    const now = new Date();
    const sub = await Subscription.findOne({
        deviceId,
        status: 'paid',
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    });
    return !!sub;
}

async function getSettings() {
    let s = await ReferralSettings.findOne();
    if (!s) s = await ReferralSettings.create({});
    return s;
}

function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return `SHREE-${s}`;
}

async function getOrCreateReferral(deviceId, mobile, name) {
    let ref = await Referral.findOne({ ownerDeviceId: deviceId });
    if (ref) {
        // refresh mobile/name if blank
        const updates = {};
        if (mobile && !ref.ownerMobile) updates.ownerMobile = mobile;
        if (name && !ref.ownerName) updates.ownerName = name;
        if (Object.keys(updates).length) {
            ref = await Referral.findByIdAndUpdate(ref._id, updates, { new: true });
        }
        return ref;
    }
    // generate unique code
    for (let attempt = 0; attempt < 8; attempt++) {
        const code = generateCode();
        const exists = await Referral.findOne({ referralCode: code });
        if (!exists) {
            try {
                return await Referral.create({
                    referralCode: code,
                    ownerDeviceId: deviceId,
                    ownerMobile: mobile || '',
                    ownerName: name || '',
                });
            } catch (e) {
                if (e.code === 11000) continue;
                throw e;
            }
        }
    }
    throw new Error('Failed to generate unique referral code');
}

// =============== PUBLIC ===============

// GET /api/referrals/settings — public-facing settings (read-only display info)
router.get('/settings', cacheRoute(() => REF_SETTINGS_KEY, 600), async (_req, res) => {
    try {
        const s = await getSettings();
        res.json({
            success: true,
            response: {
                isEnabled: s.isEnabled,
                referrerBonus: s.referrerBonus,
                refereeBonus: s.refereeBonus,
                eligibility: s.eligibility,
                title_hi: s.title_hi,
                title_en: s.title_en,
                description_hi: s.description_hi,
                description_en: s.description_en,
                howItWorks_hi: s.howItWorks_hi,
                howItWorks_en: s.howItWorks_en,
                shareMessage_hi: s.shareMessage_hi,
                shareMessage_en: s.shareMessage_en,
                milestones: (s.milestones || []).filter(m => m.isActive).sort((a, b) => a.count - b.count),
            },
        });
    } catch (err) {
        console.error('Referral settings fetch error:', err);
        res.status(500).json({ success: false, message: 'Failed' });
    }
});
router.get('/my-code/:deviceId', async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store');
        const { deviceId } = req.params;
        if (!deviceId) return res.status(400).json({ success: false, message: 'deviceId required' });

        const user = await NaamJapUser.findOne({ deviceId }).lean();
        const ref = await getOrCreateReferral(deviceId, user?.mobile || '', user?.name || '');

        // Has the user already applied? Check by deviceId OR mobile so a user
        // who switched devices still cannot apply twice.
        const orClauses = [{ refereeDeviceId: deviceId }];
        if (user?.mobile) orClauses.push({ refereeMobile: user.mobile });
        const appliedUse = await ReferralUse.findOne({ $or: orClauses }).lean();

        res.json({
            success: true,
            response: {
                referralCode: ref.referralCode,
                usageCount: ref.usageCount,
                totalEarned: ref.totalEarned,
                hasAppliedCode: !!appliedUse,
                appliedCode: appliedUse?.referralCode || null,
                claimedMilestones: ref.claimedMilestones || [],
            },
        });
    } catch (err) {
        console.error('My code error:', err);
        res.status(500).json({ success: false, message: 'Failed' });
    }
});

// POST /api/referrals/apply — { deviceId, mobile, name, referralCode }
router.post('/apply', async (req, res) => {
    try {
        const { deviceId, mobile, name } = req.body;
        let { referralCode } = req.body;
        if (!deviceId || !referralCode) {
            return res.status(400).json({ success: false, message: 'deviceId and referralCode required' });
        }
        referralCode = String(referralCode).trim().toUpperCase();

        const settings = await getSettings();
        if (!settings.isEnabled) {
            return res.status(400).json({ success: false, message: 'Referral program is disabled' });
        }

        // Normalize mobile
        const normalizedMobile = mobile ? String(mobile).trim().replace(/[^0-9]/g, '') : '';

        // Already applied? Block by deviceId OR mobile, regardless of status
        // (so users can't bypass by switching devices or by being re-rejected)
        const orClauses = [{ refereeDeviceId: deviceId }];
        if (normalizedMobile) orClauses.push({ refereeMobile: normalizedMobile });
        const existing = await ReferralUse.findOne({ $or: orClauses });
        if (existing) {
            const sameDevice = existing.refereeDeviceId === deviceId;
            return res.status(400).json({
                success: false,
                message: sameDevice
                    ? 'You have already applied a referral code on this device'
                    : 'This mobile number has already applied a referral code',
            });
        }

        // Block if this device already has a NaamJapUser registered before
        // referral code was attempted — referral codes are only for fresh users.
        // (If a user already exists with this deviceId AND has prior activity,
        // we still allow apply only if no ReferralUse exists, which is checked above.)

        // Find referral owner
        const referral = await Referral.findOne({ referralCode });
        if (!referral) return res.status(404).json({ success: false, message: 'Invalid referral code' });
        if (referral.ownerDeviceId === deviceId) {
            return res.status(400).json({ success: false, message: 'You cannot apply your own referral code' });
        }

        // Eligibility check (based on referrer)
        const referrerIsMember = await isMember(referral.ownerDeviceId);
        let eligible = true;
        let rejectReason = '';
        if (settings.eligibility === 'members_only' && !referrerIsMember) {
            eligible = false;
            rejectReason = 'Referrer is not a member';
        } else if (settings.eligibility === 'non_members_only' && referrerIsMember) {
            eligible = false;
            rejectReason = 'Referrer is a member (program for non-members only)';
        }

        const use = await ReferralUse.create({
            referralCode,
            referrerDeviceId: referral.ownerDeviceId,
            referrerMobile: referral.ownerMobile,
            refereeDeviceId: deviceId,
            refereeMobile: normalizedMobile,
            refereeName: name || '',
            status: eligible ? 'credited' : 'rejected',
            note: eligible ? '' : rejectReason,
        });

        if (!eligible) {
            return res.json({
                success: true,
                response: {
                    credited: false,
                    message: 'Referral code applied but not eligible for bonus',
                    reason: rejectReason,
                },
            });
        }

        // Credit referrer wallet
        const referrerBonus = Number(settings.referrerBonus) || 0;
        const refereeBonus = Number(settings.refereeBonus) || 0;

        if (referrerBonus > 0) {
            await Wallet.findOneAndUpdate(
                { deviceId: referral.ownerDeviceId },
                {
                    $inc: { balance: referrerBonus, totalEarned: referrerBonus },
                    $setOnInsert: { deviceId: referral.ownerDeviceId, totalWithdrawn: 0, mobile: referral.ownerMobile || '' },
                },
                { upsert: true, new: true }
            );
            await WalletTransaction.create({
                deviceId: referral.ownerDeviceId,
                mobile: referral.ownerMobile || '',
                type: 'credit_referral',
                amount: referrerBonus,
                referralUseId: use._id,
                note: `Referral bonus from ${mobile || deviceId}`,
            });
            await Referral.findByIdAndUpdate(referral._id, { $inc: { usageCount: 1, totalEarned: referrerBonus } });
        } else {
            await Referral.findByIdAndUpdate(referral._id, { $inc: { usageCount: 1 } });
        }

        if (refereeBonus > 0) {
            await Wallet.findOneAndUpdate(
                { deviceId },
                {
                    $inc: { balance: refereeBonus, totalEarned: refereeBonus },
                    $setOnInsert: { deviceId, totalWithdrawn: 0, mobile: mobile || '' },
                },
                { upsert: true, new: true }
            );
            await WalletTransaction.create({
                deviceId,
                mobile: mobile || '',
                type: 'credit_referral_referee',
                amount: refereeBonus,
                referralUseId: use._id,
                note: `Welcome bonus for using referral code ${referralCode}`,
            });
        }

        // ===== Milestone bonuses =====
        // After increment, check if referrer hit any milestone they haven't yet claimed.
        let milestoneCredited = 0;
        const milestoneAwards = [];
        const refreshed = await Referral.findById(referral._id);
        if (refreshed) {
            const claimed = new Set((refreshed.claimedMilestones || []).map(Number));
            const eligibleMilestones = (settings.milestones || [])
                .filter(m => m.isActive && Number(m.count) > 0 && refreshed.usageCount >= Number(m.count) && !claimed.has(Number(m.count)))
                .sort((a, b) => a.count - b.count);

            for (const m of eligibleMilestones) {
                const amt = Number(m.rewardAmount) || 0;
                if (amt > 0) {
                    await Wallet.findOneAndUpdate(
                        { deviceId: referral.ownerDeviceId },
                        {
                            $inc: { balance: amt, totalEarned: amt },
                            $setOnInsert: { deviceId: referral.ownerDeviceId, totalWithdrawn: 0, mobile: referral.ownerMobile || '' },
                        },
                        { upsert: true, new: true }
                    );
                    await WalletTransaction.create({
                        deviceId: referral.ownerDeviceId,
                        mobile: referral.ownerMobile || '',
                        type: 'credit_referral_milestone',
                        amount: amt,
                        referralUseId: use._id,
                        note: `Referral milestone reached: ${m.count} referrals`,
                    });
                    milestoneCredited += amt;
                }
                milestoneAwards.push({ count: m.count, rewardAmount: amt });
                await Referral.findByIdAndUpdate(referral._id, {
                    $addToSet: { claimedMilestones: Number(m.count) },
                    $inc: amt > 0 ? { totalEarned: amt } : {},
                });
            }
        }

        await ReferralUse.findByIdAndUpdate(use._id, {
            bonusCredited: referrerBonus,
            refereeBonusCredited: refereeBonus,
            creditedAt: new Date(),
        });

        res.json({
            success: true,
            response: {
                credited: true,
                referrerBonus,
                refereeBonus,
                milestoneCredited,
                milestoneAwards,
                message: refereeBonus > 0 ? `₹${refereeBonus} credited to your wallet` : 'Referral code applied successfully',
            },
        });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ success: false, message: 'You have already applied a referral code' });
        }
        console.error('Apply referral error:', err);
        res.status(500).json({ success: false, message: 'Failed to apply referral code' });
    }
});

// GET /api/referrals/my-referrals/:deviceId
router.get('/my-referrals/:deviceId', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const items = await ReferralUse.find({ referrerDeviceId: deviceId })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();
        res.json({ success: true, response: items });
    } catch (err) {
        console.error('My referrals error:', err);
        res.status(500).json({ success: false, message: 'Failed' });
    }
});

// =============== ADMIN ===============

router.get('/admin/settings', authMiddleware, async (_req, res) => {
    try {
        const s = await getSettings();
        res.json({ success: true, response: s });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed' });
    }
});

router.put('/admin/settings', authMiddleware, async (req, res) => {
    try {
        const fields = ['isEnabled', 'referrerBonus', 'refereeBonus', 'eligibility',
            'title_hi', 'title_en', 'description_hi', 'description_en', 'howItWorks_hi', 'howItWorks_en',
            'shareMessage_hi', 'shareMessage_en'];
        const updates = {};
        fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

        if (Array.isArray(req.body.milestones)) {
            updates.milestones = req.body.milestones
                .filter(m => m && Number(m.count) > 0)
                .map(m => ({
                    count: Number(m.count),
                    rewardAmount: Number(m.rewardAmount) || 0,
                    title_hi: String(m.title_hi || ''),
                    title_en: String(m.title_en || ''),
                    description_hi: String(m.description_hi || ''),
                    description_en: String(m.description_en || ''),
                    isActive: m.isActive !== false,
                }))
                .sort((a, b) => a.count - b.count);
        }

        let s = await ReferralSettings.findOne();
        if (!s) s = await ReferralSettings.create(updates);
        else {
            Object.assign(s, updates);
            await s.save();
        }
        cacheDel(REF_SETTINGS_KEY);
        announce('referrals', 'settings-updated', {}, ['referrals']);
        res.json({ success: true, response: s });
    } catch (err) {
        console.error('Update settings error:', err);
        res.status(500).json({ success: false, message: 'Failed' });
    }
});

router.get('/admin/list', authMiddleware, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 50);
        const filter = {};
        if (req.query.status) filter.status = req.query.status;
        if (req.query.search) {
            const q = String(req.query.search).trim();
            filter.$or = [
                { referralCode: new RegExp(q, 'i') },
                { referrerMobile: new RegExp(q, 'i') },
                { refereeMobile: new RegExp(q, 'i') },
                { refereeName: new RegExp(q, 'i') },
            ];
        }

        const [items, total, stats] = await Promise.all([
            ReferralUse.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            ReferralUse.countDocuments(filter),
            ReferralUse.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$bonusCredited' } } },
            ]),
        ]);

        const statsMap = {};
        stats.forEach(s => { statsMap[s._id] = { count: s.count, amount: s.amount }; });

        res.json({
            success: true,
            response: {
                items,
                pagination: { page, limit, total, pages: Math.ceil(total / limit) },
                stats: statsMap,
            },
        });
    } catch (err) {
        console.error('Admin list error:', err);
        res.status(500).json({ success: false, message: 'Failed' });
    }
});

router.get('/admin/stats', authMiddleware, async (_req, res) => {
    try {
        const [totalCodes, totalUses, payoutAgg] = await Promise.all([
            Referral.countDocuments(),
            ReferralUse.countDocuments(),
            ReferralUse.aggregate([
                { $match: { status: 'credited' } },
                { $group: { _id: null, total: { $sum: '$bonusCredited' } } },
            ]),
        ]);
        res.json({
            success: true,
            response: {
                totalCodes,
                totalUses,
                totalPayout: payoutAgg[0]?.total || 0,
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed' });
    }
});

// POST /api/referrals/admin/uses/:id/action — { action: 'credit'|'reject', note }
router.post('/admin/uses/:id/action', authMiddleware, async (req, res) => {
    try {
        const { action, note } = req.body;
        const use = await ReferralUse.findById(req.params.id);
        if (!use) return res.status(404).json({ success: false, message: 'Not found' });

        if (action === 'credit') {
            if (use.status === 'credited') {
                return res.status(400).json({ success: false, message: 'Already credited' });
            }
            const settings = await getSettings();
            const bonus = Number(settings.referrerBonus) || 0;
            if (bonus > 0) {
                await Wallet.findOneAndUpdate(
                    { deviceId: use.referrerDeviceId },
                    {
                        $inc: { balance: bonus, totalEarned: bonus },
                        $setOnInsert: { deviceId: use.referrerDeviceId, totalWithdrawn: 0 },
                    },
                    { upsert: true, new: true }
                );
                await WalletTransaction.create({
                    deviceId: use.referrerDeviceId,
                    type: 'credit_referral',
                    amount: bonus,
                    referralUseId: use._id,
                    note: `Manual credit by admin`,
                });
                await Referral.findOneAndUpdate(
                    { ownerDeviceId: use.referrerDeviceId },
                    { $inc: { usageCount: use.status === 'credited' ? 0 : 1, totalEarned: bonus } }
                );
            }
            use.status = 'credited';
            use.bonusCredited = bonus;
            use.creditedAt = new Date();
            use.note = note || use.note;
            await use.save();
        } else if (action === 'reject') {
            use.status = 'rejected';
            use.note = note || use.note;
            await use.save();
        } else {
            return res.status(400).json({ success: false, message: 'Invalid action' });
        }

        announce('referrals', 'action', { useId: String(use._id), status: use.status }, ['referrals', 'analyticsBiz']);
        res.json({ success: true, response: use });
    } catch (err) {
        console.error('Use action error:', err);
        res.status(500).json({ success: false, message: 'Failed' });
    }
});

module.exports = router;
