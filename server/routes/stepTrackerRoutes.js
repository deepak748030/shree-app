const express = require('express');
const router = express.Router();
const StepTracker = require('../models/StepTracker');

// Sync step data
router.post('/sync', async (req, res) => {
    try {
        const { deviceId, mobile, todaySteps, todayDistance, todayCalories, dailyGoal } = req.body;

        if (!deviceId || !mobile) {
            return res.status(400).json({ success: false, message: 'deviceId and mobile are required' });
        }

        const cleanMobile = String(mobile).trim().replace(/[^0-9]/g, '');
        const today = new Date().toISOString().split('T')[0];
        const nextSteps = Math.max(0, Number(todaySteps) || 0);
        const nextDistance = Math.max(0, Number(todayDistance) || 0);
        const nextCalories = Math.max(0, Number(todayCalories) || 0);

        let user = await StepTracker.findOne({ deviceId });
        if (!user && cleanMobile) {
            user = await StepTracker.findOne({ mobile: cleanMobile }).sort({ totalSteps: -1, lastSyncAt: -1 });
            if (user && user.deviceId !== deviceId) user.deviceId = deviceId;
        }

        if (!user) {
            user = new StepTracker({
                deviceId,
                mobile: cleanMobile,
                totalSteps: nextSteps,
                totalDistance: nextDistance,
                totalCalories: nextCalories,
                dailyGoal: dailyGoal || 5000,
                dailyLogs: [{
                    date: today,
                    steps: nextSteps,
                    distance: nextDistance,
                    calories: nextCalories,
                    goal: dailyGoal || 5000,
                }],
            });
        } else {
            const existingLogIndex = user.dailyLogs.findIndex(l => l.date === today);
            const oldTodaySteps = existingLogIndex >= 0 ? user.dailyLogs[existingLogIndex].steps : 0;
            const oldTodayDist = existingLogIndex >= 0 ? user.dailyLogs[existingLogIndex].distance : 0;
            const oldTodayCal = existingLogIndex >= 0 ? user.dailyLogs[existingLogIndex].calories : 0;
            const mergedSteps = Math.max(oldTodaySteps, nextSteps);
            const mergedDistance = Math.max(oldTodayDist, nextDistance);
            const mergedCalories = Math.max(oldTodayCal, nextCalories);

            if (existingLogIndex >= 0) {
                user.dailyLogs[existingLogIndex].steps = mergedSteps;
                user.dailyLogs[existingLogIndex].distance = mergedDistance;
                user.dailyLogs[existingLogIndex].calories = mergedCalories;
                user.dailyLogs[existingLogIndex].goal = dailyGoal || 5000;
            } else {
                user.dailyLogs.push({
                    date: today,
                    steps: nextSteps,
                    distance: nextDistance,
                    calories: nextCalories,
                    goal: dailyGoal || 5000,
                });
            }

            // Keep only last 90 days
            if (user.dailyLogs.length > 90) {
                user.dailyLogs = user.dailyLogs.slice(-90);
            }

            user.totalSteps = Math.max(0, (user.totalSteps || 0) - oldTodaySteps + (existingLogIndex >= 0 ? mergedSteps : nextSteps));
            user.totalDistance = Math.max(0, (user.totalDistance || 0) - oldTodayDist + (existingLogIndex >= 0 ? mergedDistance : nextDistance));
            user.totalCalories = Math.max(0, (user.totalCalories || 0) - oldTodayCal + (existingLogIndex >= 0 ? mergedCalories : nextCalories));
            if (dailyGoal) user.dailyGoal = dailyGoal;
            user.mobile = cleanMobile;
        }

        user.lastSyncAt = new Date();
        await user.save();

        res.json({ success: true, response: user });
    } catch (error) {
        console.error('Step sync error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get user step data
router.get('/user/:deviceId', async (req, res) => {
    try {
        const user = await StepTracker.findOne({ deviceId: req.params.deviceId });
        if (!user) {
            return res.json({ success: true, response: null });
        }
        res.json({ success: true, response: user });
    } catch (error) {
        console.error('Step fetch error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
