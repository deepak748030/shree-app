const express = require('express');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const AppVersion = require('../models/AppVersion');
const { cacheRoute, cacheDelPattern } = require('../config/redis');
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

// GET /api/app-version/check?platform=android&currentVersion=1.0.0 (public)
router.get('/check', cacheRoute(req => `appver:${req.query.platform || 'android'}:${req.query.currentVersion || ''}`, 300), async (req, res) => {
    try {
        const { platform = 'android', currentVersion } = req.query;
        const config = await AppVersion.findOne({ platform });

        if (!config) {
            return res.json({ success: true, response: { needsUpdate: false } });
        }

        const needsUpdate = compareVersions(currentVersion, config.requiredVersion) < 0;

        res.json({
            success: true,
            response: {
                needsUpdate,
                isForceUpdate: config.isForceUpdate,
                requiredVersion: config.requiredVersion,
                playStoreUrl: config.playStoreUrl,
                appStoreUrl: config.appStoreUrl,
                updateMessage_hi: config.updateMessage_hi,
                updateMessage_en: config.updateMessage_en,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to check version' });
    }
});

// GET /api/app-version (admin - get all configs)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const configs = await AppVersion.find().sort({ platform: 1 });
        res.json({ success: true, response: configs });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch version configs' });
    }
});

// POST /api/app-version (admin - create or update)
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { platform, requiredVersion, playStoreUrl, appStoreUrl, updateMessage_hi, updateMessage_en, isForceUpdate } = req.body;

        if (!platform || !requiredVersion) {
            return res.status(400).json({ success: false, message: 'platform and requiredVersion are required' });
        }

        const config = await AppVersion.findOneAndUpdate(
            { platform },
            { requiredVersion, playStoreUrl, appStoreUrl, updateMessage_hi, updateMessage_en, isForceUpdate },
            { upsert: true, new: true }
        );

        cacheDelPattern('appver:*');
        res.json({ success: true, response: config });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to save version config' });
    }
});

// Compare semver: returns -1 if a < b, 0 if equal, 1 if a > b
function compareVersions(a, b) {
    if (!a || !b) return -1;
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const na = pa[i] || 0;
        const nb = pb[i] || 0;
        if (na < nb) return -1;
        if (na > nb) return 1;
    }
    return 0;
}

module.exports = router;
