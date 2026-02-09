const express = require('express');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const NaamJapUser = require('../models/NaamJapUser');
const router = express.Router();

// Admin auth middleware
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ success: false, message: 'No token provided' });
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const admin = await Admin.findById(decoded.id);
        if (!admin) return res.status(401).json({ success: false, message: 'Admin not found' });
        req.admin = admin;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

// Helper: get today's date string YYYY-MM-DD
const getTodayString = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// ============ PUBLIC ROUTES (for mobile app) ============

// POST /api/naam-jap/register - Register or update user info
router.post('/register', async (req, res) => {
    try {
        const { deviceId, name, city } = req.body;

        if (!deviceId || !name || !city) {
            return res.status(400).json({
                success: false,
                message: 'deviceId, name, and city are required',
            });
        }

        const trimmedName = String(name).trim().slice(0, 100);
        const trimmedCity = String(city).trim().slice(0, 100);

        if (!trimmedName || !trimmedCity) {
            return res.status(400).json({
                success: false,
                message: 'name and city cannot be empty',
            });
        }

        let user = await NaamJapUser.findOne({ deviceId });

        if (user) {
            user.name = trimmedName;
            user.city = trimmedCity;
            await user.save();
        } else {
            user = new NaamJapUser({
                deviceId,
                name: trimmedName,
                city: trimmedCity,
            });
            await user.save();
        }

        res.json({ success: true, response: user });
    } catch (error) {
        console.error('NaamJap register error:', error);
        res.status(500).json({ success: false, message: 'Failed to register user' });
    }
});

// POST /api/naam-jap/sync - Sync count data from device
router.post('/sync', async (req, res) => {
    try {
        const { deviceId, totalCount, totalMalas, todayCount, todayMalas } = req.body;

        if (!deviceId) {
            return res.status(400).json({ success: false, message: 'deviceId is required' });
        }

        const user = await NaamJapUser.findOne({ deviceId });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found. Please register first.' });
        }

        // Update totals
        user.totalCount = Math.max(0, Number(totalCount) || 0);
        user.totalMalas = Math.max(0, Number(totalMalas) || 0);
        user.lastSyncAt = new Date();

        // Update today's daily log
        const today = getTodayString();
        const existingLog = user.dailyLogs.find(log => log.date === today);
        if (existingLog) {
            existingLog.count = Math.max(0, Number(todayCount) || 0);
            existingLog.malas = Math.max(0, Number(todayMalas) || 0);
        } else {
            // Keep only last 90 days of logs
            if (user.dailyLogs.length >= 90) {
                user.dailyLogs.sort((a, b) => a.date.localeCompare(b.date));
                user.dailyLogs = user.dailyLogs.slice(-89);
            }
            user.dailyLogs.push({
                date: today,
                count: Math.max(0, Number(todayCount) || 0),
                malas: Math.max(0, Number(todayMalas) || 0),
            });
        }

        await user.save();

        // Get user's rank
        const rank = await NaamJapUser.countDocuments({
            isActive: true,
            totalMalas: { $gt: user.totalMalas },
        }) + 1;

        const totalUsers = await NaamJapUser.countDocuments({ isActive: true });

        res.json({
            success: true,
            response: {
                user,
                rank,
                totalUsers,
            },
        });
    } catch (error) {
        console.error('NaamJap sync error:', error);
        res.status(500).json({ success: false, message: 'Failed to sync data' });
    }
});

// GET /api/naam-jap/leaderboard - Get top users
router.get('/leaderboard', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 200, 500);
        const period = req.query.period || 'all'; // all, daily, weekly, monthly

        let users;

        if (period === 'all') {
            users = await NaamJapUser.find({ isActive: true })
                .sort({ totalMalas: -1 })
                .limit(limit)
                .select('name city totalMalas totalCount');
        } else {
            // For period-based, we aggregate from dailyLogs
            const now = new Date();
            let startDate;

            if (period === 'daily') {
                startDate = getTodayString();
            } else if (period === 'weekly') {
                const weekAgo = new Date(now);
                weekAgo.setDate(weekAgo.getDate() - 7);
                startDate = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, '0')}-${String(weekAgo.getDate()).padStart(2, '0')}`;
            } else if (period === 'monthly') {
                const monthAgo = new Date(now);
                monthAgo.setDate(monthAgo.getDate() - 30);
                startDate = `${monthAgo.getFullYear()}-${String(monthAgo.getMonth() + 1).padStart(2, '0')}-${String(monthAgo.getDate()).padStart(2, '0')}`;
            }

            users = await NaamJapUser.aggregate([
                { $match: { isActive: true } },
                { $unwind: '$dailyLogs' },
                { $match: { 'dailyLogs.date': { $gte: startDate } } },
                {
                    $group: {
                        _id: '$_id',
                        name: { $first: '$name' },
                        city: { $first: '$city' },
                        periodMalas: { $sum: '$dailyLogs.malas' },
                        periodCount: { $sum: '$dailyLogs.count' },
                    },
                },
                { $sort: { periodMalas: -1 } },
                { $limit: limit },
                {
                    $project: {
                        name: 1,
                        city: 1,
                        totalMalas: '$periodMalas',
                        totalCount: '$periodCount',
                    },
                },
            ]);
        }

        res.json({
            success: true,
            response: users.map((u, i) => ({
                rank: i + 1,
                name: u.name,
                city: u.city,
                malas: u.totalMalas || 0,
                count: u.totalCount || 0,
            })),
        });
    } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({ success: false, message: 'Failed to get leaderboard' });
    }
});

// GET /api/naam-jap/stats - Get worldwide stats
router.get('/stats', async (req, res) => {
    try {
        const totalUsers = await NaamJapUser.countDocuments({ isActive: true });

        const totals = await NaamJapUser.aggregate([
            { $match: { isActive: true } },
            {
                $group: {
                    _id: null,
                    totalMalas: { $sum: '$totalMalas' },
                    totalCount: { $sum: '$totalCount' },
                },
            },
        ]);

        const allTimeMalas = totals[0]?.totalMalas || 0;

        // Weekly stats
        const now = new Date();
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekStart = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, '0')}-${String(weekAgo.getDate()).padStart(2, '0')}`;

        const weeklyStats = await NaamJapUser.aggregate([
            { $match: { isActive: true } },
            { $unwind: '$dailyLogs' },
            { $match: { 'dailyLogs.date': { $gte: weekStart } } },
            {
                $group: {
                    _id: null,
                    weeklyMalas: { $sum: '$dailyLogs.malas' },
                    weeklyUsers: { $addToSet: '$_id' },
                },
            },
            {
                $project: {
                    weeklyMalas: 1,
                    weeklyUsers: { $size: '$weeklyUsers' },
                },
            },
        ]);

        // Monthly stats
        const monthAgo = new Date(now);
        monthAgo.setDate(monthAgo.getDate() - 30);
        const monthStart = `${monthAgo.getFullYear()}-${String(monthAgo.getMonth() + 1).padStart(2, '0')}-${String(monthAgo.getDate()).padStart(2, '0')}`;

        const monthlyStats = await NaamJapUser.aggregate([
            { $match: { isActive: true } },
            { $unwind: '$dailyLogs' },
            { $match: { 'dailyLogs.date': { $gte: monthStart } } },
            {
                $group: {
                    _id: null,
                    monthlyMalas: { $sum: '$dailyLogs.malas' },
                    monthlyUsers: { $addToSet: '$_id' },
                },
            },
            {
                $project: {
                    monthlyMalas: 1,
                    monthlyUsers: { $size: '$monthlyUsers' },
                },
            },
        ]);

        res.json({
            success: true,
            response: {
                allTimeUsers: totalUsers,
                allTimeMalas: allTimeMalas,
                weeklyUsers: weeklyStats[0]?.weeklyUsers || 0,
                weeklyMalas: weeklyStats[0]?.weeklyMalas || 0,
                monthlyUsers: monthlyStats[0]?.monthlyUsers || 0,
                monthlyMalas: monthlyStats[0]?.monthlyMalas || 0,
            },
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ success: false, message: 'Failed to get stats' });
    }
});

// GET /api/naam-jap/user/:deviceId - Get user data + rank
router.get('/user/:deviceId', async (req, res) => {
    try {
        const user = await NaamJapUser.findOne({ deviceId: req.params.deviceId });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const rank = await NaamJapUser.countDocuments({
            isActive: true,
            totalMalas: { $gt: user.totalMalas },
        }) + 1;

        const totalUsers = await NaamJapUser.countDocuments({ isActive: true });

        // Get highest mala day
        let highestMalaDay = 0;
        for (const log of user.dailyLogs) {
            if (log.malas > highestMalaDay) highestMalaDay = log.malas;
        }

        // Get recent logs (last 30 days)
        const recentLogs = user.dailyLogs
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 30);

        res.json({
            success: true,
            response: {
                user: {
                    name: user.name,
                    city: user.city,
                    totalCount: user.totalCount,
                    totalMalas: user.totalMalas,
                    lastSyncAt: user.lastSyncAt,
                },
                rank,
                totalUsers,
                highestMalaDay,
                recentLogs,
            },
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ success: false, message: 'Failed to get user data' });
    }
});

// ============ ADMIN ROUTES ============

// GET /api/naam-jap/admin/users - List all users (admin)
router.get('/admin/users', authMiddleware, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        const sortBy = req.query.sortBy || 'totalMalas';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

        const filter = { isActive: true };
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { city: { $regex: search, $options: 'i' } },
            ];
        }

        const [users, total] = await Promise.all([
            NaamJapUser.find(filter)
                .sort({ [sortBy]: sortOrder })
                .skip(skip)
                .limit(limit)
                .select('name city totalCount totalMalas lastSyncAt createdAt'),
            NaamJapUser.countDocuments(filter),
        ]);

        res.json({
            success: true,
            response: {
                users,
                pagination: { page, limit, total, pages: Math.ceil(total / limit) },
            },
        });
    } catch (error) {
        console.error('Admin list users error:', error);
        res.status(500).json({ success: false, message: 'Failed to list users' });
    }
});

// GET /api/naam-jap/admin/stats - Admin overview stats
router.get('/admin/stats', authMiddleware, async (req, res) => {
    try {
        const totalUsers = await NaamJapUser.countDocuments({ isActive: true });
        const totals = await NaamJapUser.aggregate([
            { $match: { isActive: true } },
            {
                $group: {
                    _id: null,
                    totalMalas: { $sum: '$totalMalas' },
                    totalCount: { $sum: '$totalCount' },
                },
            },
        ]);

        // Today's active users
        const today = getTodayString();
        const todayActive = await NaamJapUser.countDocuments({
            isActive: true,
            'dailyLogs.date': today,
        });

        // New users this week
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const newThisWeek = await NaamJapUser.countDocuments({
            createdAt: { $gte: weekAgo },
        });

        res.json({
            success: true,
            response: {
                totalUsers,
                totalMalas: totals[0]?.totalMalas || 0,
                totalCount: totals[0]?.totalCount || 0,
                todayActiveUsers: todayActive,
                newUsersThisWeek: newThisWeek,
            },
        });
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ success: false, message: 'Failed to get admin stats' });
    }
});

module.exports = router;
