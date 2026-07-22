const express = require('express');
const router = express.Router();
const GameScore = require('../models/GameScore');
const NaamJapUser = require('../models/NaamJapUser');

const ALLOWED_GAMES = new Set(['2048', 'radha-jap', 'bubble-smash', 'tictactoe', 'memory', 'snake']);

// Submit / update a score
router.post('/score', async (req, res) => {
    try {
        const { deviceId, gameId, score } = req.body || {};
        if (!deviceId || !gameId) {
            return res.status(400).json({ success: false, message: 'deviceId and gameId are required' });
        }
        if (!ALLOWED_GAMES.has(String(gameId))) {
            return res.status(400).json({ success: false, message: 'Unknown gameId' });
        }
        const s = Math.max(0, Math.floor(Number(score) || 0));

        // Pull latest user profile for denormalized leaderboard fields
        const user = await NaamJapUser.findOne({ deviceId }).lean();
        const profile = {
            mobile: user?.mobile || '',
            name: user?.name || 'Guest',
            city: user?.city || '',
            profileImage: user?.profileImage || '',
        };

        const existing = await GameScore.findOne({ gameId, deviceId });
        if (!existing) {
            const created = await GameScore.create({
                deviceId,
                gameId,
                bestScore: s,
                lastScore: s,
                playCount: 1,
                ...profile,
            });
            return res.json({ success: true, response: created, isBest: true });
        }

        const isBest = s > (existing.bestScore || 0);
        existing.lastScore = s;
        existing.playCount = (existing.playCount || 0) + 1;
        if (isBest) existing.bestScore = s;
        existing.mobile = profile.mobile || existing.mobile;
        existing.name = profile.name || existing.name;
        existing.city = profile.city || existing.city;
        existing.profileImage = profile.profileImage || existing.profileImage;
        await existing.save();

        res.json({ success: true, response: existing, isBest });
    } catch (err) {
        console.error('game score submit error:', err);
        res.status(500).json({ success: false, message: 'Failed to submit score' });
    }
});

// Leaderboard for a specific game
router.get('/:gameId/leaderboard', async (req, res) => {
    try {
        const { gameId } = req.params;
        if (!ALLOWED_GAMES.has(String(gameId))) {
            return res.status(400).json({ success: false, message: 'Unknown gameId' });
        }
        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
        const deviceId = req.query.deviceId;

        const top = await GameScore.find({ gameId, bestScore: { $gt: 0 } })
            .sort({ bestScore: -1, updatedAt: 1 })
            .limit(limit)
            .lean();

        let me = null;
        let myRank = null;
        if (deviceId) {
            me = await GameScore.findOne({ gameId, deviceId }).lean();
            if (me && me.bestScore > 0) {
                myRank = await GameScore.countDocuments({ gameId, bestScore: { $gt: me.bestScore } }) + 1;
            }
        }

        res.json({
            success: true,
            response: {
                leaderboard: top.map((r, i) => ({
                    rank: i + 1,
                    deviceId: r.deviceId,
                    name: r.name,
                    city: r.city,
                    profileImage: r.profileImage,
                    bestScore: r.bestScore,
                    playCount: r.playCount,
                    updatedAt: r.updatedAt,
                })),
                me: me ? {
                    rank: myRank,
                    bestScore: me.bestScore,
                    lastScore: me.lastScore,
                    playCount: me.playCount,
                } : null,
            },
        });
    } catch (err) {
        console.error('leaderboard error:', err);
        res.status(500).json({ success: false, message: 'Failed to load leaderboard' });
    }
});

module.exports = router;