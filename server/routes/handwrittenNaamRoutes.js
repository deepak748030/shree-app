const express = require('express');
const HandwrittenNaam = require('../models/HandwrittenNaam');
const router = express.Router();

// Helper: today's date YYYY-MM-DD in IST
const getTodayString = () => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + istOffset);
    return `${istDate.getFullYear()}-${String(istDate.getMonth() + 1).padStart(2, '0')}-${String(istDate.getDate()).padStart(2, '0')}`;
};

const getTodayCount = (user) => {
    const today = getTodayString();
    const log = user.dailyLogs.find(l => l.date === today);
    return log ? log.count : 0;
};

// GET /api/handwritten-naam/:deviceId - fetch lifetime + today + selected mantra
router.get('/:deviceId', async (req, res) => {
    try {
        const { deviceId } = req.params;
        if (!deviceId) {
            return res.status(400).json({ success: false, message: 'deviceId required' });
        }

        let user = await HandwrittenNaam.findOne({ deviceId });
        if (!user) {
            return res.json({
                success: true,
                response: {
                    lifetimeCount: 0,
                    todayCount: 0,
                    selectedMantra: 'Om Namah Shivay',
                },
            });
        }

        return res.json({
            success: true,
            response: {
                lifetimeCount: user.lifetimeCount,
                todayCount: getTodayCount(user),
                selectedMantra: user.selectedMantra,
            },
        });
    } catch (error) {
        console.error('Handwritten get error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch' });
    }
});

// POST /api/handwritten-naam/increment - increment by 1 (or N) and update mantra
router.post('/increment', async (req, res) => {
    try {
        const { deviceId, increment, selectedMantra } = req.body;
        if (!deviceId) {
            return res.status(400).json({ success: false, message: 'deviceId required' });
        }
        const inc = Math.max(1, Math.min(Number(increment) || 1, 100));

        let user = await HandwrittenNaam.findOne({ deviceId });
        if (!user) {
            user = new HandwrittenNaam({ deviceId });
        }

        if (selectedMantra && typeof selectedMantra === 'string') {
            user.selectedMantra = String(selectedMantra).trim().slice(0, 200);
        }

        const today = getTodayString();
        const existing = user.dailyLogs.find(l => l.date === today);
        if (existing) {
            existing.count = (existing.count || 0) + inc;
        } else {
            // Cap to last 90 days
            if (user.dailyLogs.length >= 90) {
                user.dailyLogs.sort((a, b) => a.date.localeCompare(b.date));
                user.dailyLogs = user.dailyLogs.slice(-89);
            }
            user.dailyLogs.push({ date: today, count: inc });
        }

        user.lifetimeCount = (user.lifetimeCount || 0) + inc;
        user.lastSyncAt = new Date();
        await user.save();

        return res.json({
            success: true,
            response: {
                lifetimeCount: user.lifetimeCount,
                todayCount: getTodayCount(user),
                selectedMantra: user.selectedMantra,
            },
        });
    } catch (error) {
        console.error('Handwritten increment error:', error);
        return res.status(500).json({ success: false, message: 'Failed to increment' });
    }
});

// POST /api/handwritten-naam/mantra - update selected mantra only
router.post('/mantra', async (req, res) => {
    try {
        const { deviceId, selectedMantra } = req.body;
        if (!deviceId || !selectedMantra) {
            return res.status(400).json({ success: false, message: 'deviceId and selectedMantra required' });
        }
        let user = await HandwrittenNaam.findOne({ deviceId });
        if (!user) {
            user = new HandwrittenNaam({ deviceId });
        }
        user.selectedMantra = String(selectedMantra).trim().slice(0, 200);
        await user.save();
        return res.json({ success: true, response: { selectedMantra: user.selectedMantra } });
    } catch (error) {
        console.error('Handwritten mantra update error:', error);
        return res.status(500).json({ success: false, message: 'Failed to update mantra' });
    }
});

module.exports = router;
