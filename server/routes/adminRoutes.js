const express = require('express');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const NaamJapUser = require('../models/NaamJapUser');
const DailyQuote = require('../models/DailyQuote');
const MembershipPlan = require('../models/MembershipPlan');
const Subscription = require('../models/Subscription');
const Reward = require('../models/Reward');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const Referral = require('../models/Referral');
const { verifyAdmin, invalidateAdmin } = require('../middleware/auth');
const { cached } = require('../config/cache');
const { getDashboardAnalytics } = require('../services/analyticsService');
const ist = require('../utils/ist');

const router = express.Router();

// Simple in-memory brute-force protection for the login endpoint. Keyed by
// IP + email so one noisy client cannot lock out everyone, and bounded so it
// can never grow without limit.
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS || 10);
const loginAttempts = new Map();

function loginKey(req, email) {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || 'unknown';
    return `${ip}|${String(email || '').toLowerCase()}`;
}

function registerFailure(key) {
    const now = Date.now();
    const entry = loginAttempts.get(key);
    if (!entry || entry.resetAt < now) {
        loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    } else {
        entry.count += 1;
    }
    if (loginAttempts.size > 5000) {
        for (const [k, v] of loginAttempts) if (v.resetAt < now) loginAttempts.delete(k);
    }
}

function isLocked(key) {
    const entry = loginAttempts.get(key);
    if (!entry) return 0;
    if (entry.resetAt < Date.now()) {
        loginAttempts.delete(key);
        return 0;
    }
    return entry.count >= LOGIN_MAX_ATTEMPTS ? Math.ceil((entry.resetAt - Date.now()) / 1000) : 0;
}

// POST /api/admin/setup - Create the first admin (refuses once any admin exists)
router.post('/setup', async (req, res) => {
    try {
        const anyAdmin = await Admin.findOne().select('_id').lean();
        if (anyAdmin) {
            return res.status(400).json({
                success: false,
                message: 'An admin already exists. Please sign in instead.',
            });
        }

        const admin = new Admin({
            name: 'Shree Jii Admin',
            email: 'admin@shreejii.com',
            password: 'Admin@123',
            role: 'superadmin',
        });

        await admin.save();

        res.status(201).json({
            success: true,
            message: 'Default admin created successfully',
            response: {
                email: admin.email,
                name: admin.name,
            },
        });
    } catch (error) {
        console.error('Setup error:', error);
        res.status(500).json({ success: false, message: 'Failed to create default admin' });
    }
});

// POST /api/admin/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }

        const key = loginKey(req, email);
        const lockedFor = isLocked(key);
        if (lockedFor > 0) {
            res.set('Retry-After', String(lockedFor));
            return res.status(429).json({
                success: false,
                message: `Too many attempts. Try again in ${Math.ceil(lockedFor / 60)} minute(s).`,
            });
        }

        const admin = await Admin.findOne({ email: String(email).toLowerCase() });
        if (!admin) {
            registerFailure(key);
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        const isMatch = await admin.comparePassword(password);
        if (!isMatch) {
            registerFailure(key);
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        loginAttempts.delete(key);

        // Update last login without running full document validation and
        // without triggering the password-hashing hook.
        admin.lastLogin = new Date();
        await Admin.updateOne({ _id: admin._id }, { $set: { lastLogin: admin.lastLogin } });

        const token = jwt.sign(
            { id: admin._id, role: admin.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            response: {
                token,
                admin: admin.toJSON(),
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
});

// GET /api/admin/me - Get current admin profile
router.get('/me', verifyAdmin, async (req, res) => {
    try {
        res.json({ success: true, response: req.admin });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get profile' });
    }
});

// PUT /api/admin/profile - Update profile
router.put('/profile', verifyAdmin, async (req, res) => {
    try {
        const { name, email, avatar } = req.body;
        const $set = {};
        if (name) $set.name = name;
        if (email) $set.email = String(email).toLowerCase();
        if (avatar !== undefined) $set.avatar = avatar;

        const admin = await Admin.findByIdAndUpdate(req.adminId, { $set }, { new: true, runValidators: true })
            .select('-password')
            .lean();

        invalidateAdmin(req.adminId);
        res.json({ success: true, response: admin });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ success: false, message: 'Failed to update profile' });
    }
});

// PUT /api/admin/password - Update password
router.put('/password', verifyAdmin, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Current and new password are required' });
        }

        if (String(newPassword).length < 8) {
            return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
        }

        // Password comparison needs the real document (the middleware caches a
        // password-free copy for speed).
        const admin = await Admin.findById(req.adminId);
        if (!admin) {
            return res.status(401).json({ success: false, message: 'Admin not found' });
        }

        const isMatch = await admin.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Current password is incorrect' });
        }

        admin.password = newPassword;
        await admin.save();
        invalidateAdmin(req.adminId);

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error('Password update error:', error);
        res.status(500).json({ success: false, message: 'Failed to update password' });
    }
});

// GET /api/admin/activity - Admin activity + platform footprint
router.get('/activity', verifyAdmin, async (req, res) => {
    try {
        const stats = await cached('settings', 'admin-activity', 60, async () => {
            const [
                totalUsers,
                totalQuotes,
                totalPlans,
                totalSubscriptions,
                activeRewards,
                pendingWithdrawals,
                totalReferrals,
            ] = await Promise.all([
                NaamJapUser.countDocuments({ isActive: true }),
                DailyQuote.countDocuments(),
                MembershipPlan.countDocuments(),
                Subscription.countDocuments({ status: 'paid' }),
                Reward.countDocuments({ isActive: true }),
                WithdrawalRequest.countDocuments({ status: 'pending' }),
                Referral.countDocuments(),
            ]);
            return {
                totalUsers,
                totalQuotes,
                totalPlans,
                totalSubscriptions,
                activeRewards,
                pendingWithdrawals,
                totalReferrals,
            };
        });

        res.json({
            success: true,
            response: {
                admin: req.admin,
                activity: {
                    lastLogin: req.admin.lastLogin || req.admin.createdAt,
                    accountCreated: req.admin.createdAt,
                    stats,
                },
            },
        });
    } catch (error) {
        console.error('Activity error:', error);
        res.status(500).json({ success: false, message: 'Failed to get activity' });
    }
});

// GET /api/admin/analytics - Dashboard analytics (real Naam Jap data)
router.get('/analytics', verifyAdmin, async (req, res) => {
    try {
        const startedAt = Date.now();
        const payload = await getDashboardAnalytics({ force: req.query.force === '1' });
        const duration = Date.now() - startedAt;

        res.set('Server-Timing', `analytics;dur=${duration};desc="${payload.source}"`);
        res.set('X-Cache', payload.source === 'fresh' ? 'MISS' : 'HIT');
        res.json({ success: true, response: payload });
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ success: false, message: 'Failed to get analytics' });
    }
});

module.exports = router;
