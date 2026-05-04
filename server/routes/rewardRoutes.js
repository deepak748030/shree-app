const express = require('express');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Reward = require('../models/Reward');
const RewardClaim = require('../models/RewardClaim');
const Wallet = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const NaamJapUser = require('../models/NaamJapUser');
const Subscription = require('../models/Subscription');
const StepTracker = require('../models/StepTracker');
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

// Helper: check membership
async function isMember(deviceId) {
    const now = new Date();
    const sub = await Subscription.findOne({
        deviceId,
        status: 'paid',
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    });
    return !!sub;
}

// =============== PUBLIC ===============

// GET /api/rewards?deviceId=xxx — list rewards with user progress
router.get('/', async (req, res) => {
    try {
        const { deviceId } = req.query;
        if (!deviceId) return res.status(400).json({ success: false, message: 'deviceId required' });

        const [rewards, user, steps, claims, memberStatus] = await Promise.all([
            Reward.find({ isActive: true }).sort({ sortOrder: 1 }).lean(),
            NaamJapUser.findOne({ deviceId }).lean(),
            StepTracker.findOne({ deviceId }).lean(),
            RewardClaim.find({ deviceId }).lean(),
            isMember(deviceId),
        ]);

        const claimedSet = new Set(claims.map(c => String(c.rewardId)));

        // Today's stats (dates stored as YYYY-MM-DD strings)
        const todayStr = new Date().toISOString().slice(0, 10);
        const todayCount = user?.dailyCounts?.find(d => d.date === todayStr)?.count || 0;
        const todaySteps = steps?.dailySteps?.find(d => d.date === todayStr)?.steps || 0;

        const totalJap = user?.totalCount || 0;
        const totalSteps = steps?.totalSteps || 0;

        const enriched = rewards.map(r => {
            const userJap = r.type === 'daily' ? todayCount : totalJap;
            const userSteps = r.type === 'daily' ? todaySteps : totalSteps;
            const japProgress = r.japTarget > 0 ? Math.min(userJap / r.japTarget, 1) : 1;
            const stepsProgress = r.stepsTarget > 0 ? Math.min(userSteps / r.stepsTarget, 1) : 1;
            const unlocked = japProgress >= 1 && stepsProgress >= 1;
            const claimed = claimedSet.has(String(r._id));
            return {
                ...r,
                userJap,
                userSteps,
                japProgress,
                stepsProgress,
                unlocked,
                claimed,
            };
        });

        res.json({ success: true, response: { rewards: enriched, isMember: memberStatus } });
    } catch (err) {
        console.error('Fetch rewards error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch rewards' });
    }
});

// POST /api/rewards/claim — claim a reward
router.post('/claim', async (req, res) => {
    try {
        const { deviceId, rewardId } = req.body;
        if (!deviceId || !rewardId) return res.status(400).json({ success: false, message: 'deviceId and rewardId required' });

        // Check membership
        if (!(await isMember(deviceId))) {
            return res.status(403).json({ success: false, message: 'Membership required' });
        }

        // Check already claimed
        const existing = await RewardClaim.findOne({ deviceId, rewardId });
        if (existing) return res.status(400).json({ success: false, message: 'Already claimed' });

        const reward = await Reward.findById(rewardId);
        if (!reward || !reward.isActive) return res.status(404).json({ success: false, message: 'Reward not found' });

        // Create claim
        await RewardClaim.create({ deviceId, rewardId });

        // Credit wallet
        const wallet = await Wallet.findOneAndUpdate(
            { deviceId },
            {
                $inc: { balance: reward.rewardAmount, totalEarned: reward.rewardAmount },
                $setOnInsert: { deviceId, totalWithdrawn: 0 },
            },
            { upsert: true, new: true }
        );

        await WalletTransaction.create({
            deviceId,
            type: 'credit_reward',
            amount: reward.rewardAmount,
            rewardId: reward._id,
            rewardTitle: reward.title_en,
            note: `Reward: ${reward.title_en}`,
        });

        res.json({ success: true, response: { balance: wallet.balance } });
    } catch (err) {
        console.error('Claim reward error:', err);
        res.status(500).json({ success: false, message: 'Failed to claim reward' });
    }
});

// GET /api/rewards/wallet/:deviceId — wallet info + transactions
router.get('/wallet/:deviceId', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const memberStatus = await isMember(deviceId);

        const [wallet, transactions] = await Promise.all([
            Wallet.findOne({ deviceId }).lean(),
            WalletTransaction.find({ deviceId }).sort({ createdAt: -1 }).limit(50).lean(),
        ]);

        res.json({
            success: true,
            response: {
                wallet: wallet || { balance: 0, totalEarned: 0, totalWithdrawn: 0 },
                transactions: transactions || [],
                isMember: memberStatus,
            },
        });
    } catch (err) {
        console.error('Fetch wallet error:', err);
        res.status(500).json({ success: false, message: 'Failed' });
    }
});

// POST /api/rewards/wallet/withdraw — request withdrawal
router.post('/wallet/withdraw', async (req, res) => {
    try {
        const { deviceId, amount, upiId, userName } = req.body;
        if (!deviceId || !amount || !upiId) {
            return res.status(400).json({ success: false, message: 'deviceId, amount, upiId required' });
        }

        if (!(await isMember(deviceId))) {
            return res.status(403).json({ success: false, message: 'Membership required' });
        }

        const wallet = await Wallet.findOne({ deviceId });
        if (!wallet || wallet.balance < amount) {
            return res.status(400).json({ success: false, message: 'Insufficient balance' });
        }

        // Deduct balance
        wallet.balance -= amount;
        wallet.totalWithdrawn += amount;
        await wallet.save();

        const wr = await WithdrawalRequest.create({
            deviceId,
            amount,
            upiId,
            userName: userName || '',
            status: 'pending',
        });

        await WalletTransaction.create({
            deviceId,
            type: 'debit_withdrawal',
            amount,
            withdrawalId: wr._id,
            note: `Withdrawal to ${upiId}`,
        });

        res.json({ success: true, response: { balance: wallet.balance, withdrawalId: wr._id } });
    } catch (err) {
        console.error('Withdraw error:', err);
        res.status(500).json({ success: false, message: 'Failed' });
    }
});

// GET /api/rewards/wallet/:deviceId/withdrawals — user's withdrawal history
router.get('/wallet/:deviceId/withdrawals', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const items = await WithdrawalRequest.find({ deviceId }).sort({ createdAt: -1 }).limit(50).lean();
        res.json({ success: true, response: items });
    } catch (err) {
        console.error('Fetch withdrawals error:', err);
        res.status(500).json({ success: false, message: 'Failed' });
    }
});

// =============== ADMIN ===============

// GET /api/rewards/admin/list
router.get('/admin/list', authMiddleware, async (req, res) => {
    try {
        const items = await Reward.find().sort({ sortOrder: 1, createdAt: -1 }).lean();
        res.json({ success: true, response: items });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed' });
    }
});

// POST /api/rewards/admin
router.post('/admin', authMiddleware, async (req, res) => {
    try {
        const { title_hi, title_en, description_hi, description_en, japTarget, stepsTarget, rewardAmount, type, icon, isActive, sortOrder } = req.body;
        if (!title_hi || !title_en || japTarget == null || stepsTarget == null || rewardAmount == null) {
            return res.status(400).json({ success: false, message: 'Required fields missing' });
        }
        const reward = await Reward.create({
            title_hi, title_en,
            description_hi: description_hi || '',
            description_en: description_en || '',
            japTarget: Number(japTarget),
            stepsTarget: Number(stepsTarget),
            rewardAmount: Number(rewardAmount),
            type: type || 'lifetime',
            icon: icon || 'trophy',
            isActive: isActive !== false,
            sortOrder: Number(sortOrder) || 0,
        });
        res.json({ success: true, response: reward });
    } catch (err) {
        console.error('Create reward error:', err);
        res.status(500).json({ success: false, message: 'Failed' });
    }
});

// PUT /api/rewards/admin/:id
router.put('/admin/:id', authMiddleware, async (req, res) => {
    try {
        const updates = {};
        const fields = ['title_hi', 'title_en', 'description_hi', 'description_en', 'japTarget', 'stepsTarget', 'rewardAmount', 'type', 'icon', 'isActive', 'sortOrder'];
        fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
        const reward = await Reward.findByIdAndUpdate(req.params.id, updates, { new: true });
        if (!reward) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, response: reward });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed' });
    }
});

// DELETE /api/rewards/admin/:id
router.delete('/admin/:id', authMiddleware, async (req, res) => {
    try {
        await Reward.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed' });
    }
});

// GET /api/rewards/admin/withdrawals
router.get('/admin/withdrawals', authMiddleware, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 50);
        const filter = {};
        if (req.query.status) filter.status = req.query.status;

        const [items, total] = await Promise.all([
            WithdrawalRequest.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            WithdrawalRequest.countDocuments(filter),
        ]);

        res.json({
            success: true,
            response: {
                items,
                pagination: { page, limit, total, pages: Math.ceil(total / limit) },
            },
        });
    } catch (err) {
        console.error('Admin withdrawals error:', err);
        res.status(500).json({ success: false, message: 'Failed' });
    }
});

// POST /api/rewards/admin/withdrawals/:id/action
router.post('/admin/withdrawals/:id/action', authMiddleware, async (req, res) => {
    try {
        const { action, note } = req.body;
        const wr = await WithdrawalRequest.findById(req.params.id);
        if (!wr) return res.status(404).json({ success: false, message: 'Not found' });

        if (action === 'approve') {
            wr.status = 'approved';
            wr.adminNote = note || '';
        } else if (action === 'pay') {
            wr.status = 'paid';
            wr.paidAt = new Date();
            wr.adminNote = note || wr.adminNote;
        } else if (action === 'reject') {
            wr.status = 'rejected';
            wr.processedAt = new Date();
            wr.adminNote = note || '';
            // Refund balance
            await Wallet.findOneAndUpdate(
                { deviceId: wr.deviceId },
                { $inc: { balance: wr.amount, totalWithdrawn: -wr.amount } }
            );
            await WalletTransaction.create({
                deviceId: wr.deviceId,
                type: 'debit_withdrawal_reverted',
                amount: wr.amount,
                withdrawalId: wr._id,
                note: `Withdrawal rejected: ${note || ''}`,
            });
        } else {
            return res.status(400).json({ success: false, message: 'Invalid action' });
        }

        await wr.save();
        res.json({ success: true, response: wr });
    } catch (err) {
        console.error('Withdrawal action error:', err);
        res.status(500).json({ success: false, message: 'Failed' });
    }
});

module.exports = router;
