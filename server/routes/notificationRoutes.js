const express = require('express');
const jwt = require('jsonwebtoken');
const { Expo } = require('expo-server-sdk');
const Admin = require('../models/Admin');
const NaamJapUser = require('../models/NaamJapUser');
const router = express.Router();

const expo = new Expo();

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

// POST /api/notifications/send - Send push notification to all users
router.post('/send', authMiddleware, async (req, res) => {
    try {
        const { title, body } = req.body;

        if (!title || !body) {
            return res.status(400).json({
                success: false,
                message: 'title and body are required',
            });
        }

        // Get all users with push tokens
        const users = await NaamJapUser.find({
            isActive: true,
            pushToken: { $exists: true, $ne: null, $ne: '' },
        }).select('pushToken name');

        if (users.length === 0) {
            return res.json({
                success: true,
                response: {
                    sent: 0,
                    failed: 0,
                    message: 'No users with push tokens found',
                },
            });
        }

        // Build messages
        const messages = [];
        for (const user of users) {
            if (!Expo.isExpoPushToken(user.pushToken)) {
                continue;
            }
            messages.push({
                to: user.pushToken,
                sound: 'default',
                title: title,
                body: body,
                data: { screen: 'naam-jap-counter' },
            });
        }

        // Send in chunks
        const chunks = expo.chunkPushNotifications(messages);
        let sent = 0;
        let failed = 0;

        for (const chunk of chunks) {
            try {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                for (const ticket of ticketChunk) {
                    if (ticket.status === 'ok') {
                        sent++;
                    } else {
                        failed++;
                    }
                }
            } catch (error) {
                console.error('Error sending chunk:', error);
                failed += chunk.length;
            }
        }

        res.json({
            success: true,
            response: {
                sent,
                failed,
                total: messages.length,
            },
        });
    } catch (error) {
        console.error('Send notification error:', error);
        res.status(500).json({ success: false, message: 'Failed to send notifications' });
    }
});

module.exports = router;
