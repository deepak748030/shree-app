const express = require('express');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const DonationSettings = require('../models/DonationSettings');
const cloudinary = require('../config/cloudinary');
const { announce } = require('../config/announce');
const router = express.Router();

// Auth middleware
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

// GET /api/donation - Public: Get donation settings
router.get('/', async (req, res) => {
    try {
        const settings = await DonationSettings.findOne({ isActive: true }).sort({ updatedAt: -1 });
        if (!settings) {
            return res.json({ success: true, response: null });
        }
        res.json({ success: true, response: settings });
    } catch (error) {
        console.error('Get donation settings error:', error);
        res.status(500).json({ success: false, message: 'Failed to get donation settings' });
    }
});

// GET /api/donation/admin - Admin: Get donation settings
router.get('/admin', authMiddleware, async (req, res) => {
    try {
        let settings = await DonationSettings.findOne().sort({ updatedAt: -1 });
        if (!settings) {
            settings = new DonationSettings({});
            await settings.save();
        }
        res.json({ success: true, response: settings });
    } catch (error) {
        console.error('Get admin donation settings error:', error);
        res.status(500).json({ success: false, message: 'Failed to get donation settings' });
    }
});

// PUT /api/donation/admin - Admin: Update donation settings
router.put('/admin', authMiddleware, async (req, res) => {
    try {
        const { upiId, accountNumber, ifscCode, accountHolderName, bankName, isActive, note_hi, note_en } = req.body;

        let settings = await DonationSettings.findOne().sort({ updatedAt: -1 });
        if (!settings) {
            settings = new DonationSettings({});
        }

        if (upiId !== undefined) settings.upiId = upiId;
        if (accountNumber !== undefined) settings.accountNumber = accountNumber;
        if (ifscCode !== undefined) settings.ifscCode = ifscCode;
        if (accountHolderName !== undefined) settings.accountHolderName = accountHolderName;
        if (bankName !== undefined) settings.bankName = bankName;
        if (isActive !== undefined) settings.isActive = isActive;
        if (note_hi !== undefined) settings.note_hi = note_hi;
        if (note_en !== undefined) settings.note_en = note_en;

        await settings.save();
        announce('settings', 'donation-updated', {}, ['settings']);
        res.json({ success: true, response: settings });
    } catch (error) {
        console.error('Update donation settings error:', error);
        res.status(500).json({ success: false, message: 'Failed to update donation settings' });
    }
});

// POST /api/donation/admin/upload-scanner - Admin: Upload QR scanner image
router.post('/admin/upload-scanner', authMiddleware, async (req, res) => {
    try {
        const { image } = req.body;
        if (!image) {
            return res.status(400).json({ success: false, message: 'Image is required' });
        }

        // Delete old scanner image if exists
        let settings = await DonationSettings.findOne().sort({ updatedAt: -1 });
        if (settings && settings.scannerPublicId) {
            try {
                await cloudinary.uploader.destroy(settings.scannerPublicId);
            } catch (e) {
                console.error('Failed to delete old scanner image:', e);
            }
        }

        // Upload new image
        const result = await cloudinary.uploader.upload(image, {
            folder: 'shree-jii/donation',
            resource_type: 'image',
        });

        if (!settings) {
            settings = new DonationSettings({});
        }

        settings.scannerImage = result.secure_url;
        settings.scannerPublicId = result.public_id;
        await settings.save();

        announce('settings', 'scanner-updated', {}, ['settings']);
        res.json({
            success: true,
            response: {
                scannerImage: result.secure_url,
                scannerPublicId: result.public_id,
            },
        });
    } catch (error) {
        console.error('Upload scanner image error:', error);
        res.status(500).json({ success: false, message: 'Failed to upload scanner image' });
    }
});

// DELETE /api/donation/admin/scanner - Admin: Remove scanner image
router.delete('/admin/scanner', authMiddleware, async (req, res) => {
    try {
        const settings = await DonationSettings.findOne().sort({ updatedAt: -1 });
        if (settings && settings.scannerPublicId) {
            try {
                await cloudinary.uploader.destroy(settings.scannerPublicId);
            } catch (e) {
                console.error('Failed to delete scanner image:', e);
            }
            settings.scannerImage = '';
            settings.scannerPublicId = '';
            await settings.save();
        }
        announce('settings', 'scanner-removed', {}, ['settings']);
        res.json({ success: true, message: 'Scanner image removed' });
    } catch (error) {
        console.error('Delete scanner image error:', error);
        res.status(500).json({ success: false, message: 'Failed to remove scanner image' });
    }
});

module.exports = router;
