const express = require('express');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const router = express.Router();

// Auth middleware
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const admin = await Admin.findById(decoded.id);

        if (!admin) {
            return res.status(401).json({ success: false, message: 'Admin not found' });
        }

        req.admin = admin;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

// POST /api/admin/setup - Create default admin
router.post('/setup', async (req, res) => {
    try {
        const existingAdmin = await Admin.findOne({ email: 'admin@shreejii.com' });
        if (existingAdmin) {
            return res.status(400).json({
                success: false,
                message: 'Default admin already exists. Login with admin@shreejii.com',
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

        const admin = await Admin.findOne({ email: email.toLowerCase() });
        if (!admin) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        const isMatch = await admin.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        // Update last login
        admin.lastLogin = new Date();
        await admin.save();

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
router.get('/me', authMiddleware, async (req, res) => {
    try {
        res.json({ success: true, response: req.admin.toJSON() });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get profile' });
    }
});

// PUT /api/admin/profile - Update profile
router.put('/profile', authMiddleware, async (req, res) => {
    try {
        const { name, email, avatar } = req.body;
        const admin = req.admin;

        if (name) admin.name = name;
        if (email) admin.email = email;
        if (avatar !== undefined) admin.avatar = avatar;

        await admin.save();

        res.json({ success: true, response: admin.toJSON() });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ success: false, message: 'Failed to update profile' });
    }
});

// PUT /api/admin/password - Update password
router.put('/password', authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Current and new password are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
        }

        const isMatch = await req.admin.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Current password is incorrect' });
        }

        req.admin.password = newPassword;
        await req.admin.save();

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error('Password update error:', error);
        res.status(500).json({ success: false, message: 'Failed to update password' });
    }
});

// GET /api/admin/activity - Get admin activity
router.get('/activity', authMiddleware, async (req, res) => {
    try {
        res.json({
            success: true,
            response: {
                admin: req.admin.toJSON(),
                activity: {
                    lastLogin: req.admin.lastLogin || req.admin.createdAt,
                    accountCreated: req.admin.createdAt,
                    stats: {
                        totalOrders: 0,
                        totalUsers: 0,
                        totalCoupons: 0,
                        totalCategories: 0,
                        totalBanners: 0,
                        totalDeliveryPartners: 0,
                    },
                },
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get activity' });
    }
});

// GET /api/admin/analytics - Dashboard analytics
router.get('/analytics', authMiddleware, async (req, res) => {
    try {
        res.json({
            success: true,
            response: {
                overview: {
                    totalUsers: 0,
                    activeUsers: 0,
                    blockedUsers: 0,
                    totalVendors: 0,
                    activeVendors: 0,
                    blockedVendors: 0,
                    pendingKYC: 0,
                    verifiedVendors: 0,
                    totalOrders: 0,
                    pendingOrders: 0,
                    deliveredOrders: 0,
                    cancelledOrders: 0,
                    totalRevenue: 0,
                    totalDeliveryPartners: 0,
                    activeDeliveryPartners: 0,
                    onlineDeliveryPartners: 0,
                    pendingKycPartners: 0,
                },
                periodStats: {
                    users: 0,
                    vendors: 0,
                    revenue: 0,
                    filter: req.query.filter || 'monthly',
                },
                charts: {
                    monthlyGrowth: [],
                    orderStatusDistribution: [],
                    vendorKycDistribution: [],
                },
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get analytics' });
    }
});

module.exports = router;
