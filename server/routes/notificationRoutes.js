const express = require('express');
const jwt = require('jsonwebtoken');
const { Expo } = require('expo-server-sdk');
const Admin = require('../models/Admin');
const NaamJapUser = require('../models/NaamJapUser');
const { announce } = require('../config/announce');
const router = express.Router();

const expo = new Expo();

// Expo accepts up to 100 messages per call and rate-limits per project.
// Streaming in batches keeps memory flat (a million users used to be a million
// objects in RAM) and lets the request finish long before any proxy timeout.
const BATCH_SIZE = 100;
const BATCH_CONCURRENCY = 3;
const MAX_REPORTED_ERRORS = 50;

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
//
// Design notes
//  * Users are streamed with a cursor, never materialised as a whole array.
//  * Tokens are validated and de-duplicated while streaming.
//  * Batches of 100 go to Expo with bounded concurrency; results are counted as
//    they arrive, so a slow send cannot balloon memory.
//  * Tokens Expo reports as `DeviceNotRegistered` are cleared from the database,
//    which keeps future sends fast and accurate.
//  * Per-token logging is gone: it was a privacy leak and made the endpoint
//    O(n) in stdout.
router.post('/send', authMiddleware, async (req, res) => {
    const startedAt = Date.now();
    try {
        const { title, body } = req.body || {};

        if (!title || !body) {
            return res.status(400).json({
                success: false,
                message: 'title and body are required',
            });
        }

        // Optional audience filter, useful for targeted announcements.
        const filter = {
            isActive: true,
            pushToken: { $exists: true, $nin: [null, ''] },
        };
        if (req.body.city) filter.city = req.body.city;
        if (req.body.mobile) filter.mobile = req.body.mobile;

        const seen = new Set();
        let total = 0;
        let sent = 0;
        let failed = 0;
        let skipped = 0;
        const errors = [];
        const deadTokens = [];

        const flush = async (batch) => {
            if (!batch.length) return;
            let tickets;
            try {
                tickets = await expo.sendPushNotificationsAsync(batch);
            } catch (error) {
                failed += batch.length;
                if (errors.length < MAX_REPORTED_ERRORS) {
                    errors.push({ error: error.message, count: batch.length });
                }
                return;
            }
            tickets.forEach((ticket, index) => {
                if (ticket.status === 'ok') {
                    sent += 1;
                    return;
                }
                failed += 1;
                const token = batch[index]?.to;
                if (ticket.details?.error === 'DeviceNotRegistered' && token) {
                    deadTokens.push(token);
                }
                if (errors.length < MAX_REPORTED_ERRORS) {
                    errors.push({
                        token: token ? `${String(token).slice(0, 12)}…` : undefined,
                        error: ticket.message,
                        code: ticket.details?.error,
                    });
                }
            });
        };

        // --- stream + send ---
        const cursor = NaamJapUser.find(filter).select('pushToken').lean().cursor();
        let pending = [];
        let inflight = [];

        for await (const user of cursor) {
            const token = user.pushToken;
            if (!token || !Expo.isExpoPushToken(token) || seen.has(token)) {
                skipped += 1;
                continue;
            }
            seen.add(token);
            total += 1;
            pending.push({ to: token, sound: 'default', title, body, data: { screen: 'naam-jap-counter' } });

            if (pending.length >= BATCH_SIZE) {
                inflight.push(flush(pending));
                pending = [];
                if (inflight.length >= BATCH_CONCURRENCY) {
                    await Promise.all(inflight);
                    inflight = [];
                }
            }
        }
        if (pending.length) inflight.push(flush(pending));
        await Promise.all(inflight);

        // Housekeeping: drop tokens Expo says are dead. Fire and forget — the
        // send must not fail because cleanup did.
        if (deadTokens.length) {
            NaamJapUser.updateMany(
                { pushToken: { $in: deadTokens.slice(0, 5000) } },
                { $unset: { pushToken: '' } }
            ).catch((error) => console.error('[push] dead token cleanup failed:', error.message));
        }

        const durationMs = Date.now() - startedAt;
        console.log(
            `[push] sent=${sent} failed=${failed} skipped=${skipped} total=${total} in ${durationMs}ms`
        );

        announce('notifications', 'sent', { sent, failed, total, skipped, durationMs });
        res.json({
            success: true,
            response: {
                sent,
                failed,
                total,
                skipped,
                durationMs,
                errors: errors.length ? errors : undefined,
            },
        });
    } catch (error) {
        console.error('=== PUSH NOTIFICATION ERROR ===');
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to send notifications' });
    }
});

module.exports = router;
