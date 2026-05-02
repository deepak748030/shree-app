const express = require('express');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const HandwrittenNaam = require('../models/HandwrittenNaam');
const NaamJapUser = require('../models/NaamJapUser');
const router = express.Router();

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

const getTodayString = () => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + istOffset);
    return `${istDate.getFullYear()}-${String(istDate.getMonth() + 1).padStart(2, '0')}-${String(istDate.getDate()).padStart(2, '0')}`;
};

// GET /api/handwritten-naam/admin/users
router.get('/admin/users', authMiddleware, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 50);
        const search = (req.query.search || '').trim();
        const sortBy = req.query.sortBy || 'lifetimeCount';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

        const today = getTodayString();
        const filter = {};
        // Search via NaamJapUser (name/mobile/city) -> deviceIds
        let deviceFilter = null;
        if (search) {
            const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            const users = await NaamJapUser.find({
                $or: [{ name: rx }, { mobile: rx }, { city: rx }, { deviceId: rx }],
            }).select('deviceId').lean();
            deviceFilter = users.map(u => u.deviceId);
            filter.deviceId = { $in: deviceFilter };
        }

        const [docs, total] = await Promise.all([
            HandwrittenNaam.find(filter).sort({ [sortBy]: sortOrder }).skip((page - 1) * limit).limit(limit).lean(),
            HandwrittenNaam.countDocuments(filter),
        ]);

        const deviceIds = docs.map(d => d.deviceId);
        const profiles = await NaamJapUser.find({ deviceId: { $in: deviceIds } })
            .select('deviceId name mobile city').lean();
        const pmap = new Map(profiles.map(p => [p.deviceId, p]));

        const items = docs.map(d => {
            const todayLog = (d.dailyLogs || []).find(l => l.date === today);
            const p = pmap.get(d.deviceId);
            return {
                _id: d._id,
                deviceId: d.deviceId,
                name: p?.name || '—',
                mobile: p?.mobile || '',
                city: p?.city || '',
                selectedMantra: d.selectedMantra,
                lifetimeCount: d.lifetimeCount || 0,
                todayCount: todayLog?.count || 0,
                lastSyncAt: d.lastSyncAt,
            };
        });

        // overall stats
        const agg = await HandwrittenNaam.aggregate([
            { $group: { _id: null, totalLifetime: { $sum: '$lifetimeCount' }, users: { $sum: 1 } } },
        ]);
        const stats = {
            totalUsers: agg[0]?.users || 0,
            totalLifetime: agg[0]?.totalLifetime || 0,
        };

        res.json({
            success: true,
            response: {
                items,
                stats,
                pagination: { page, limit, total, pages: Math.ceil(total / limit) },
            },
        });
    } catch (err) {
        console.error('Handwritten admin error:', err);
        res.status(500).json({ success: false, message: 'Failed' });
    }
});

module.exports = router;
