const express = require('express');
const HandwrittenNaam = require('../models/HandwrittenNaam');
const HandwrittenLogArchive = require('../models/HandwrittenLogArchive');
const { announceThrottled } = require('../config/announce');
const ist = require('../utils/ist');
const router = express.Router();

// Retention window for hot per-day logs. Anything older is copied to
// HandwrittenLogArchive before being trimmed — history is never discarded.
const RETAIN_DAYS = Number(process.env.HANDWRITTEN_RETAIN_DAYS || 400);

// Helper: today's date YYYY-MM-DD in IST (shared platform helper)
const getTodayString = () => ist.today();

/**
 * Copy old daily logs to cold storage, then trim the hot document.
 * The copy happens first and is idempotent (unique device+date index), so an
 * interrupted run is safe and no log can be lost.
 */
async function archiveAndTrim(user) {
    const cutoff = ist.daysAgo(RETAIN_DAYS);
    const stale = (user.dailyLogs || []).filter((log) => log.date < cutoff);
    if (stale.length === 0) return 0;
    await HandwrittenLogArchive.bulkWrite(
        stale.map((log) => ({
            updateOne: {
                filter: { deviceId: user.deviceId, date: log.date },
                update: {
                    $set: {
                        deviceId: user.deviceId,
                        mobile: user.mobile || '',
                        date: log.date,
                        count: log.count || 0,
                        mantra: user.selectedMantra || '',
                        archivedAt: new Date(),
                        reason: 'retention',
                    },
                },
                upsert: true,
            },
        })),
        { ordered: false }
    );
    user.dailyLogs = user.dailyLogs.filter((log) => log.date >= cutoff);
    return stale.length;
}

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
            user.dailyLogs.push({ date: today, count: inc });
        }

        user.lifetimeCount = (user.lifetimeCount || 0) + inc;
        user.lastSyncAt = new Date();
        await archiveAndTrim(user);
        await user.save();

        announceThrottled('users', 'handwritten', { deviceId }, ['analytics']);

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
