const express = require('express');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const HomeContent = require('../models/HomeContent');
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

// GET /api/home-content - Public: get home content
router.get('/', async (req, res) => {
    try {
        const content = await HomeContent.findOne().sort({ updatedAt: -1 });
        if (!content) {
            return res.json({ success: true, response: null });
        }
        res.json({
            success: true,
            response: {
                _id: content._id,
                title_hi: content.title_hi,
                title_en: content.title_en,
                subtitle_hi: content.subtitle_hi,
                subtitle_en: content.subtitle_en,
                paragraphs_hi: content.paragraphs_hi,
                paragraphs_en: content.paragraphs_en,
                updatedAt: content.updatedAt,
            },
        });
    } catch (error) {
        console.error('Get home content error:', error);
        res.status(500).json({ success: false, message: 'Failed to get home content' });
    }
});

// POST /api/home-content - Admin: create or update home content
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { title_hi, title_en, subtitle_hi, subtitle_en, paragraphs_hi, paragraphs_en } = req.body;

        // Upsert: find existing or create new (only one record)
        let content = await HomeContent.findOne();
        if (content) {
            content.title_hi = title_hi || '';
            content.title_en = title_en || '';
            content.subtitle_hi = subtitle_hi || '';
            content.subtitle_en = subtitle_en || '';
            content.paragraphs_hi = paragraphs_hi || [];
            content.paragraphs_en = paragraphs_en || [];
            await content.save();
        } else {
            content = new HomeContent({
                title_hi: title_hi || '',
                title_en: title_en || '',
                subtitle_hi: subtitle_hi || '',
                subtitle_en: subtitle_en || '',
                paragraphs_hi: paragraphs_hi || [],
                paragraphs_en: paragraphs_en || [],
            });
            await content.save();
        }

        res.json({
            success: true,
            message: content.isNew ? 'Home content created' : 'Home content updated',
            response: content,
        });
    } catch (error) {
        console.error('Save home content error:', error);
        res.status(500).json({ success: false, message: 'Failed to save home content' });
    }
});

module.exports = router;
