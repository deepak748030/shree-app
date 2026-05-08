const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const MembershipPlan = require('../models/MembershipPlan');
const Subscription = require('../models/Subscription');
const NaamJapUser = require('../models/NaamJapUser');
const razorpay = require('../config/razorpay');
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

// =============== PUBLIC ===============

// GET /api/membership/plans - active plans for app
router.get('/plans', async (req, res) => {
    try {
        const plans = await MembershipPlan.find({ isActive: true }).sort({ sortOrder: 1, price: 1 });
        res.json({ success: true, response: plans });
    } catch (err) {
        console.error('Get plans error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch plans' });
    }
});

// GET /api/membership/key - publishable razorpay key id
router.get('/key', (req, res) => {
    res.json({ success: true, response: { keyId: process.env.RAZORPAY_KEY_ID || '' } });
});

// GET /api/membership/status/:deviceId - active subscription
// Optional ?mobile=... so a paid subscription is found even after the user
// logs out / re-installs / switches device but logs back in with same mobile.
router.get('/status/:deviceId', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const rawMobile = (req.query.mobile || '').toString().trim().replace(/[^0-9]/g, '');
        const now = new Date();

        const orClauses = [{ deviceId }];
        if (rawMobile && rawMobile.length >= 10) {
            orClauses.push({ mobile: rawMobile });
        }

        const sub = await Subscription.findOne({
            $or: orClauses,
            status: 'paid',
            $and: [{ $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }],
        }).sort({ expiresAt: -1, paidAt: -1 });

        // If we found one tied to a different deviceId, migrate it to the
        // current device so future device-only lookups also succeed.
        if (sub && sub.deviceId !== deviceId) {
            try {
                sub.deviceId = deviceId;
                await sub.save();
            } catch (e) {
                console.warn('status: deviceId migrate skipped:', e.message);
            }
        }
        if (!sub) return res.json({ success: true, response: { isActive: false } });
        res.json({
            success: true,
            response: {
                isActive: true,
                planName_hi: sub.planSnapshot?.name_hi,
                planName_en: sub.planSnapshot?.name_en,
                isLifetime: !!sub.planSnapshot?.isLifetime,
                expiresAt: sub.expiresAt,
                paidAt: sub.paidAt,
            },
        });
    } catch (err) {
        console.error('Status error:', err);
        res.status(500).json({ success: false, message: 'Failed' });
    }
});

// POST /api/membership/create-order - create razorpay order
router.post('/create-order', async (req, res) => {
    try {
        const { planId, deviceId, mobile } = req.body;
        if (!planId || !deviceId) {
            return res.status(400).json({ success: false, message: 'planId and deviceId required' });
        }
        const plan = await MembershipPlan.findById(planId);
        if (!plan || !plan.isActive) {
            return res.status(404).json({ success: false, message: 'Plan not found' });
        }

        const trimmedMobile = (mobile || '').toString().trim().replace(/[^0-9]/g, '');

        // Guard: if user already has an active paid subscription (by device or
        // mobile), don't let them create another order.
        const now = new Date();
        const activeOr = [{ deviceId }];
        if (trimmedMobile.length >= 10) activeOr.push({ mobile: trimmedMobile });
        const activeSub = await Subscription.findOne({
            $or: activeOr,
            status: 'paid',
            $and: [{ $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }],
        });
        if (activeSub) {
            return res.status(400).json({
                success: false,
                message: 'You already have an active membership',
            });
        }

        // Cleanup: mark any stale unpaid orders from previous abandoned attempts
        // for this device as cancelled so they don't accumulate.
        await Subscription.updateMany(
            { deviceId, status: 'created' },
            { $set: { status: 'cancelled', cancelledAt: new Date(), cancelReason: 'abandoned' } }
        );

        const amountPaise = Math.round(plan.price * 100);
        const order = await razorpay.orders.create({
            amount: amountPaise,
            currency: 'INR',
            receipt: `mem_${Date.now()}`,
            notes: { planId: String(plan._id), deviceId, mobile: trimmedMobile },
        });

        const sub = await Subscription.create({
            deviceId,
            mobile: trimmedMobile,
            planId: plan._id,
            planSnapshot: {
                name_hi: plan.name_hi,
                name_en: plan.name_en,
                price: plan.price,
                durationMonths: plan.durationMonths,
                isLifetime: plan.isLifetime,
            },
            razorpayOrderId: order.id,
            amount: amountPaise,
            currency: 'INR',
            status: 'created',
        });

        res.json({
            success: true,
            response: {
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
                keyId: process.env.RAZORPAY_KEY_ID,
                subscriptionId: sub._id,
                plan: {
                    name_hi: plan.name_hi,
                    name_en: plan.name_en,
                    price: plan.price,
                },
            },
        });
    } catch (err) {
        console.error('Create order error:', err);
        res.status(500).json({ success: false, message: 'Failed to create order' });
    }
});

// POST /api/membership/verify - verify razorpay payment
router.post('/verify', async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, deviceId, mobile } = req.body;
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ success: false, message: 'Missing fields' });
        }
        const expected = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (expected !== razorpay_signature) {
            await Subscription.findOneAndUpdate(
                { razorpayOrderId: razorpay_order_id },
                { status: 'failed' }
            );
            return res.status(400).json({ success: false, message: 'Invalid signature' });
        }

        const sub = await Subscription.findOne({ razorpayOrderId: razorpay_order_id });
        if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found' });

        const now = new Date();
        let expiresAt = null;
        if (!sub.planSnapshot?.isLifetime) {
            const months = sub.planSnapshot?.durationMonths || 1;
            expiresAt = new Date(now);
            expiresAt.setMonth(expiresAt.getMonth() + months);
        }
        sub.razorpayPaymentId = razorpay_payment_id;
        sub.razorpaySignature = razorpay_signature;
        sub.status = 'paid';
        sub.paidAt = now;
        sub.startsAt = now;
        sub.expiresAt = expiresAt;
        // Always store the latest deviceId/mobile that completed the payment so
        // future status lookups (on either) succeed even after re-install/login.
        if (deviceId) sub.deviceId = deviceId;
        if (mobile) {
            const m = String(mobile).trim().replace(/[^0-9]/g, '');
            if (m) sub.mobile = m;
        }
        await sub.save();

        res.json({
            success: true,
            response: {
                isActive: true,
                expiresAt,
                isLifetime: !!sub.planSnapshot?.isLifetime,
            },
        });
    } catch (err) {
        console.error('Verify error:', err);
        res.status(500).json({ success: false, message: 'Verification failed' });
    }
});

// =============== ADMIN ===============

// GET /api/membership/admin/plans
router.get('/admin/plans', authMiddleware, async (req, res) => {
    try {
        const plans = await MembershipPlan.find().sort({ sortOrder: 1, createdAt: -1 });
        res.json({ success: true, response: plans });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed' });
    }
});

// POST /api/membership/admin/plans
router.post('/admin/plans', authMiddleware, async (req, res) => {
    try {
        const { name_hi, name_en, description_hi, description_en, price, durationMonths, isLifetime, isActive, isBestValue, sortOrder } = req.body;
        if (!name_hi || !name_en || !price || !durationMonths) {
            return res.status(400).json({ success: false, message: 'Required: name_hi, name_en, price, durationMonths' });
        }
        const plan = await MembershipPlan.create({
            name_hi, name_en,
            description_hi: description_hi || '',
            description_en: description_en || '',
            price: Number(price),
            durationMonths: Number(durationMonths),
            isLifetime: !!isLifetime,
            isActive: isActive !== false,
            isBestValue: !!isBestValue,
            sortOrder: Number(sortOrder) || 0,
        });
        res.json({ success: true, response: plan });
    } catch (err) {
        console.error('Create plan error:', err);
        res.status(500).json({ success: false, message: 'Failed to create plan' });
    }
});

// PUT /api/membership/admin/plans/:id
router.put('/admin/plans/:id', authMiddleware, async (req, res) => {
    try {
        const updates = {};
        const fields = ['name_hi', 'name_en', 'description_hi', 'description_en', 'price', 'durationMonths', 'isLifetime', 'isActive', 'isBestValue', 'sortOrder'];
        fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
        const plan = await MembershipPlan.findByIdAndUpdate(req.params.id, updates, { new: true });
        if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
        res.json({ success: true, response: plan });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to update' });
    }
});

// DELETE /api/membership/admin/plans/:id
router.delete('/admin/plans/:id', authMiddleware, async (req, res) => {
    try {
        await MembershipPlan.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed' });
    }
});

// GET /api/membership/admin/subscriptions
router.get('/admin/subscriptions', authMiddleware, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 50);
        const filter = {};
        if (req.query.status) filter.status = req.query.status;
        const search = (req.query.search || '').trim();
        if (search) {
            filter.$or = [
                { mobile: { $regex: search, $options: 'i' } },
                { deviceId: { $regex: search, $options: 'i' } },
                { razorpayOrderId: { $regex: search, $options: 'i' } },
                { razorpayPaymentId: { $regex: search, $options: 'i' } },
            ];
        }
        const [items, total, stats] = await Promise.all([
            Subscription.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            Subscription.countDocuments(filter),
            Subscription.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$amount' } } },
            ]),
        ]);

        // Attach user info (name/city) for each subscription via NaamJapUser by mobile or deviceId
        const deviceIds = [...new Set(items.map(i => i.deviceId).filter(Boolean))];
        const mobiles = [...new Set(items.map(i => i.mobile).filter(Boolean))];
        const users = await NaamJapUser.find({
            $or: [
                { deviceId: { $in: deviceIds } },
                { mobile: { $in: mobiles } },
            ],
        }).select('name city mobile deviceId').lean();

        const byDevice = new Map(users.map(u => [u.deviceId, u]));
        const byMobile = new Map(users.map(u => [u.mobile, u]));

        const now = new Date();
        const enriched = items.map(s => {
            const u = byDevice.get(s.deviceId) || byMobile.get(s.mobile) || null;
            const isLifetime = !!s.planSnapshot?.isLifetime;
            const expired = !isLifetime && s.expiresAt && new Date(s.expiresAt) < now;
            return {
                ...s,
                userName: u?.name || '',
                userCity: u?.city || '',
                computedActive: s.status === 'paid' && (isLifetime || !expired),
                isExpired: expired,
            };
        });

        // Aggregate active count (paid + not expired)
        const activeCount = enriched.filter(e => e.computedActive).length;

        res.json({
            success: true,
            response: {
                items: enriched,
                pagination: { page, limit, total, pages: Math.ceil(total / limit) },
                stats: {
                    byStatus: stats.reduce((acc, s) => { acc[s._id] = { count: s.count, amount: s.amount }; return acc; }, {}),
                    activeOnPage: activeCount,
                },
            },
        });
    } catch (err) {
        console.error('List subs error:', err);
        res.status(500).json({ success: false, message: 'Failed' });
    }
});

// POST /api/membership/admin/subscriptions/:id/pause
router.post('/admin/subscriptions/:id/pause', authMiddleware, async (req, res) => {
    try {
        const sub = await Subscription.findById(req.params.id);
        if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found' });
        if (sub.status !== 'paid') {
            return res.status(400).json({ success: false, message: `Cannot pause a ${sub.status} subscription` });
        }
        const now = new Date();
        // Capture remaining time so resume can extend expiresAt
        if (!sub.planSnapshot?.isLifetime && sub.expiresAt) {
            const remaining = new Date(sub.expiresAt).getTime() - now.getTime();
            sub.pausedRemainingMs = Math.max(0, remaining);
        } else {
            sub.pausedRemainingMs = null;
        }
        sub.status = 'paused';
        sub.pausedAt = now;
        await sub.save();
        res.json({ success: true, response: sub });
    } catch (err) {
        console.error('Pause sub error:', err);
        res.status(500).json({ success: false, message: 'Failed to pause' });
    }
});

// POST /api/membership/admin/subscriptions/:id/resume
router.post('/admin/subscriptions/:id/resume', authMiddleware, async (req, res) => {
    try {
        const sub = await Subscription.findById(req.params.id);
        if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found' });
        if (sub.status !== 'paused') {
            return res.status(400).json({ success: false, message: `Cannot resume a ${sub.status} subscription` });
        }
        const now = new Date();
        // Re-apply remaining duration from when it was paused
        if (!sub.planSnapshot?.isLifetime && sub.pausedRemainingMs != null) {
            sub.expiresAt = new Date(now.getTime() + sub.pausedRemainingMs);
        }
        sub.status = 'paid';
        sub.pausedAt = null;
        sub.pausedRemainingMs = null;
        await sub.save();
        res.json({ success: true, response: sub });
    } catch (err) {
        console.error('Resume sub error:', err);
        res.status(500).json({ success: false, message: 'Failed to resume' });
    }
});

// POST /api/membership/admin/subscriptions/:id/cancel
router.post('/admin/subscriptions/:id/cancel', authMiddleware, async (req, res) => {
    try {
        const { reason } = req.body || {};
        const sub = await Subscription.findById(req.params.id);
        if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found' });
        if (sub.status === 'cancelled') {
            return res.status(400).json({ success: false, message: 'Already cancelled' });
        }
        sub.status = 'cancelled';
        sub.cancelledAt = new Date();
        sub.cancelReason = (reason || '').toString().slice(0, 300);
        // End access immediately
        sub.expiresAt = sub.cancelledAt;
        await sub.save();
        res.json({ success: true, response: sub });
    } catch (err) {
        console.error('Cancel sub error:', err);
        res.status(500).json({ success: false, message: 'Failed to cancel' });
    }
});

module.exports = router;
