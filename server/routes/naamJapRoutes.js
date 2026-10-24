const express = require('express');
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const NaamJapUser = require('../models/NaamJapUser');
const DailyLogArchive = require('../models/DailyLogArchive');
const HandwrittenNaam = require('../models/HandwrittenNaam');
const StepTracker = require('../models/StepTracker');
const { migrateDeviceId } = require('../utils/migrateDeviceId');
const { verifyAdmin } = require('../middleware/auth');
const { cached } = require('../config/cache');
const realtime = require('../config/realtime');
const ist = require('../utils/ist');
const { enforceRetention, needsRetention } = require('../services/dailyLogRetention');
const router = express.Router();

// Multer for in-memory image upload
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed'), false);
    },
});

const uploadToCloudinary = (buffer) => new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
        { folder: 'profile-images', resource_type: 'image', quality: 'auto', fetch_format: 'auto', transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }] },
        (error, result) => { if (error) reject(error); else resolve(result); }
    );
    stream.end(buffer);
});

const deleteFromCloudinary = async (imageUrl) => {
    try {
        if (!imageUrl) return;
        const parts = imageUrl.split('/');
        const uploadIndex = parts.indexOf('upload');
        if (uploadIndex === -1) return;
        const pathParts = parts.slice(uploadIndex + 2);
        const publicId = pathParts.join('/').replace(/\.[^/.]+$/, '');
        await cloudinary.uploader.destroy(publicId);
    } catch (err) {
        console.error('Cloudinary delete error:', err.message);
    }
};

const normaliseMobile = (mobile) => String(mobile || '').trim().replace(/[^0-9]/g, '');

/** Fire-and-forget realtime + cache invalidation for a user write. */
function announceUserChange(type, payload) {
    try {
        realtime.publishThrottled('users', type, payload, {
            invalidate: ['users', 'analytics', 'leaderboard', 'stats'],
        });
    } catch {
        /* never fail a write because of the event hub */
    }
}

// Cached global counters. These change constantly, so the TTL is short and they
// are invalidated by writes through `announceUserChange`.
const TOTAL_USERS_TTL = 15;

async function getTotalUsers() {
    return cached('stats', 'total-users', TOTAL_USERS_TTL, () =>
        NaamJapUser.countDocuments({ isActive: true })
    );
}

async function getRankAndTotal(totalMalas) {
    const [rank, totalUsers] = await Promise.all([
        NaamJapUser.countDocuments({ isActive: true, totalMalas: { $gt: totalMalas } }),
        getTotalUsers(),
    ]);
    return { rank: rank + 1, totalUsers: Math.max(totalUsers, rank + 1) };
}

// ============ PUBLIC ROUTES (for mobile app) ============

// POST /api/naam-jap/validate-session - Check if user session is still valid
router.post('/validate-session', async (req, res) => {
    try {
        const { mobile, deviceId } = req.body;

        if (!mobile || !deviceId) {
            return res.status(400).json({ success: false, message: 'mobile and deviceId are required' });
        }

        const trimmedMobile = normaliseMobile(mobile);
        const user = await NaamJapUser.findOne({ mobile: trimmedMobile, deviceId, isActive: true })
            .select('-dailyLogs')
            .lean();

        if (!user) {
            return res.json({ success: false, message: 'Session invalid' });
        }

        return res.json({ success: true, response: user });
    } catch (error) {
        console.error('Validate session error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /api/naam-jap/auth-mobile - Login or register by mobile number
router.post('/auth-mobile', async (req, res) => {
    try {
        const { mobile, deviceId, pushToken } = req.body;

        if (!mobile || !deviceId) {
            return res.status(400).json({
                success: false,
                message: 'mobile and deviceId are required',
            });
        }

        const trimmedMobile = normaliseMobile(mobile);
        if (trimmedMobile.length < 10 || trimmedMobile.length > 15) {
            return res.status(400).json({
                success: false,
                message: 'Invalid mobile number',
            });
        }

        // Check if user exists with this mobile number
        let user = await NaamJapUser.findOne({ mobile: trimmedMobile });

        if (user) {
            // Existing user — try to update deviceId / pushToken, but never block
            // login if the update fails (e.g. deviceId unique conflict). The
            // user MUST be returned so the app logs in instead of asking them
            // to register again.
            const needsDeviceUpdate = user.deviceId !== deviceId;
            const needsTokenUpdate = pushToken && user.pushToken !== pushToken;

            if (needsDeviceUpdate || needsTokenUpdate) {
                try {
                    let oldDeviceId = null;
                    if (needsDeviceUpdate) {
                        // If another stale record holds this deviceId, free it
                        // first so the unique index doesn't reject our save.
                        await NaamJapUser.updateMany(
                            { deviceId, _id: { $ne: user._id } },
                            { $set: { deviceId: `orphan_${user._id}_${Date.now()}` } }
                        );
                        oldDeviceId = user.deviceId;
                        user.deviceId = deviceId;
                    }
                    if (needsTokenUpdate) {
                        user.pushToken = pushToken;
                    }
                    await user.save();
                    if (oldDeviceId && oldDeviceId !== deviceId) {
                        try {
                            await migrateDeviceId(oldDeviceId, deviceId, trimmedMobile);
                        } catch (migErr) {
                            console.error('auth-mobile: migrateDeviceId failed:', migErr.message);
                        }
                    }
                    announceUserChange('device-moved', { deviceId, mobile: trimmedMobile });
                } catch (saveErr) {
                    console.error('auth-mobile: non-fatal save error:', saveErr.message);
                    // fall through — still return the user as logged in
                }
            }

            return res.json({
                success: true,
                isNewUser: false,
                response: user,
            });
        }

        // New user - return that registration is needed
        return res.json({
            success: true,
            isNewUser: true,
            response: null,
        });
    } catch (error) {
        console.error('Auth mobile error:', error);
        res.status(500).json({ success: false, message: 'Failed to authenticate' });
    }
});

// POST /api/naam-jap/register - Register or update user info
router.post('/register', async (req, res) => {
    try {
        const { deviceId, name, city, mobile, pushToken } = req.body;

        if (!deviceId || !name || !city || !mobile) {
            return res.status(400).json({
                success: false,
                message: 'deviceId, name, city, and mobile are required',
            });
        }

        const trimmedName = String(name).trim().slice(0, 100);
        const trimmedCity = String(city).trim().slice(0, 100);

        if (!trimmedName || !trimmedCity) {
            return res.status(400).json({
                success: false,
                message: 'name and city cannot be empty',
            });
        }

        const trimmedMobile = normaliseMobile(mobile);

        // Check if mobile already registered to another user
        const existingMobileUser = await NaamJapUser.findOne({ mobile: trimmedMobile, deviceId: { $ne: deviceId } })
            .select('_id')
            .lean();
        if (existingMobileUser) {
            return res.status(400).json({
                success: false,
                message: 'This mobile number is already registered',
            });
        }

        const update = {
            deviceId,
            name: trimmedName,
            city: trimmedCity,
            mobile: trimmedMobile,
            isActive: true,
        };
        if (pushToken) update.pushToken = pushToken;

        // Upsert in one roundtrip: no find-then-save race when the app retries.
        const user = await NaamJapUser.findOneAndUpdate(
            { deviceId },
            { $set: update, $setOnInsert: { totalCount: 0, totalMalas: 0, dailyLogs: [] } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        ).lean();

        announceUserChange('registered', { deviceId, name: trimmedName, city: trimmedCity });

        res.json({ success: true, response: user });
    } catch (error) {
        // Unique index race: two simultaneous registrations for the same device.
        if (error && error.code === 11000) {
            const user = await NaamJapUser.findOne({ deviceId }).lean();
            if (user) return res.json({ success: true, response: user });
        }
        console.error('NaamJap register error:', error);
        res.status(500).json({ success: false, message: 'Failed to register user' });
    }
});

// POST /api/naam-jap/profile/update - Update name and/or upload profile image (multipart)
router.post('/profile/update', upload.single('image'), async (req, res) => {
    try {
        const { deviceId, name } = req.body;
        if (!deviceId) {
            return res.status(400).json({ success: false, message: 'deviceId is required' });
        }
        const user = await NaamJapUser.findOne({ deviceId });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (typeof name === 'string' && name.trim()) {
            user.name = name.trim().slice(0, 100);
        }

        if (req.file) {
            const result = await uploadToCloudinary(req.file.buffer);
            // Delete old image if it was on cloudinary
            if (user.profileImage) {
                deleteFromCloudinary(user.profileImage).catch(() => { });
            }
            user.profileImage = result.secure_url;
        }

        await user.save();
        announceUserChange('profile-updated', { deviceId, name: user.name });
        res.json({ success: true, response: user });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ success: false, message: 'Failed to update profile' });
    }
});

/**
 * POST /api/naam-jap/sync
 *
 * Single-document, single-roundtrip, atomic sync. The app can call this on
 * every mala without risking lost updates:
 *
 *  - Lifetime counters are monotonic (`$max`): a stale or freshly-reinstalled
 *    client can never lower the server totals.
 *  - Today's entry is merged inside the same update, so two devices (or two
 *    overlapping requests) cannot overwrite each other's counts.
 *  - The whole thing is one `findOneAndUpdate`, so it is safe under concurrency
 *    and cheap (no read-modify-write, no version conflicts).
 */
router.post('/sync', async (req, res) => {
    try {
        const { deviceId } = req.body;
        if (!deviceId) {
            return res.status(400).json({ success: false, message: 'deviceId is required' });
        }

        const incomingTotalCount = Math.max(0, Number(req.body.totalCount) || 0);
        const incomingTotalMalas = Math.max(0, Number(req.body.totalMalas) || 0);
        const incomingTodayCount = Math.max(0, Number(req.body.todayCount) || 0);
        const incomingTodayMalas = Math.max(0, Number(req.body.todayMalas) || 0);
        const today = ist.today();

        const shouldTouchToday = incomingTodayCount > 0 || incomingTodayMalas > 0;

        const mergeDailyLogs = {
            $let: {
                vars: {
                    logs: { $ifNull: ['$dailyLogs', []] },
                },
                in: {
                    $let: {
                        vars: {
                            existing: {
                                $arrayElemAt: [
                                    {
                                        $filter: {
                                            input: '$$logs',
                                            as: 'log',
                                            cond: { $eq: ['$$log.date', today] },
                                        },
                                    },
                                    0,
                                ],
                            },
                        },
                        in: {
                            $concatArrays: [
                                {
                                    $filter: {
                                        input: '$$logs',
                                        as: 'log',
                                        cond: { $ne: ['$$log.date', today] },
                                    },
                                },
                                [
                                    {
                                        date: today,
                                        count: {
                                            $max: [
                                                { $ifNull: ['$$existing.count', 0] },
                                                incomingTodayCount,
                                            ],
                                        },
                                        malas: {
                                            $max: [
                                                { $ifNull: ['$$existing.malas', 0] },
                                                incomingTodayMalas,
                                            ],
                                        },
                                    },
                                ],
                            ],
                        },
                    },
                },
            },
        };

        const user = await NaamJapUser.findOneAndUpdate(
            { deviceId },
            [
                {
                    $set: {
                        totalCount: {
                            $max: [{ $ifNull: ['$totalCount', 0] }, incomingTotalCount],
                        },
                        totalMalas: {
                            $max: [{ $ifNull: ['$totalMalas', 0] }, incomingTotalMalas],
                        },
                        lastSyncAt: '$$NOW',
                        dailyLogs: shouldTouchToday ? mergeDailyLogs : { $ifNull: ['$dailyLogs', []] },
                    },
                },
            ],
            { new: true }
        ).lean();

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found. Please register first.' });
        }

        // Retention runs in the background: it never delays the sync response
        // and it can never delete data without archiving it first.
        if (needsRetention(user)) {
            enforceRetention(user).catch((err) =>
                console.error('retention failed for', deviceId, err.message)
            );
        }
        if (user.dailyLogs && user.dailyLogs.length > 400) {
            // Keep the response payload small even before retention runs.
            user.dailyLogs = user.dailyLogs.slice(-400);
        }

        const { rank, totalUsers } = await getRankAndTotal(user.totalMalas);

        announceUserChange('sync', {
            deviceId,
            totalMalas: user.totalMalas,
            todayMalas: incomingTodayMalas,
            today,
        });

        res.json({
            success: true,
            response: {
                user,
                rank,
                totalUsers,
                today,
                serverTime: new Date().toISOString(),
                version: realtime.currentSeq(),
            },
        });
    } catch (error) {
        console.error('NaamJap sync error:', error);
        res.status(500).json({ success: false, message: 'Failed to sync data' });
    }
});

// GET /api/naam-jap/leaderboard - Get top users (cached, realtime-aware)
router.get('/leaderboard', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 200, 500);
        const period = ['all', 'daily', 'weekly', 'monthly'].includes(req.query.period)
            ? req.query.period
            : 'all';

        const payload = await cached('leaderboard', `${period}:${limit}`, 10, async () => {
            let users;

            if (period === 'all') {
                users = await NaamJapUser.find({ isActive: true })
                    .sort({ totalMalas: -1, totalCount: -1 })
                    .limit(limit)
                    .select('name city totalMalas totalCount profileImage')
                    .lean();
            } else {
                const startDate =
                    period === 'daily'
                        ? ist.today()
                        : period === 'weekly'
                            ? ist.daysAgo(7)
                            : ist.daysAgo(30);

                users = await NaamJapUser.aggregate([
                    // Pre-filter users so we never unwind logs outside the window.
                    { $match: { isActive: true, 'dailyLogs.date': { $gte: startDate } } },
                    { $unwind: '$dailyLogs' },
                    { $match: { 'dailyLogs.date': { $gte: startDate } } },
                    {
                        $group: {
                            _id: '$_id',
                            name: { $first: '$name' },
                            city: { $first: '$city' },
                            profileImage: { $first: '$profileImage' },
                            periodMalas: { $sum: '$dailyLogs.malas' },
                            periodCount: { $sum: '$dailyLogs.count' },
                        },
                    },
                    { $match: { periodMalas: { $gt: 0 } } },
                    { $sort: { periodMalas: -1, periodCount: -1 } },
                    { $limit: limit },
                ]);
            }

            return users.map((u, i) => ({
                rank: i + 1,
                name: u.name,
                city: u.city,
                profileImage: u.profileImage || '',
                malas: u.totalMalas ?? u.periodMalas ?? 0,
                count: u.totalCount ?? u.periodCount ?? 0,
            }));
        });

        res.set('Cache-Control', 'public, max-age=5, stale-while-revalidate=20');
        res.json({
            success: true,
            response: payload,
            meta: { period, limit, generatedAt: new Date().toISOString() },
        });
    } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({ success: false, message: 'Failed to get leaderboard' });
    }
});

// GET /api/naam-jap/stats - Worldwide stats (cached)
router.get('/stats', async (req, res) => {
    try {
        const payload = await cached('stats', 'worldwide', 30, async () => {
            const weekStart = ist.daysAgo(7);
            const monthStart = ist.daysAgo(30);

            const [totals, weeklyStats, monthlyStats] = await Promise.all([
                NaamJapUser.aggregate([
                    { $match: { isActive: true } },
                    {
                        $group: {
                            _id: null,
                            users: { $sum: 1 },
                            totalMalas: { $sum: '$totalMalas' },
                            totalCount: { $sum: '$totalCount' },
                        },
                    },
                ]),
                NaamJapUser.aggregate([
                    { $match: { isActive: true, 'dailyLogs.date': { $gte: weekStart } } },
                    { $unwind: '$dailyLogs' },
                    { $match: { 'dailyLogs.date': { $gte: weekStart } } },
                    {
                        $group: {
                            _id: null,
                            malas: { $sum: '$dailyLogs.malas' },
                            users: { $addToSet: '$_id' },
                        },
                    },
                    { $project: { malas: 1, users: { $size: '$users' } } },
                ]),
                NaamJapUser.aggregate([
                    { $match: { isActive: true, 'dailyLogs.date': { $gte: monthStart } } },
                    { $unwind: '$dailyLogs' },
                    { $match: { 'dailyLogs.date': { $gte: monthStart } } },
                    {
                        $group: {
                            _id: null,
                            malas: { $sum: '$dailyLogs.malas' },
                            users: { $addToSet: '$_id' },
                        },
                    },
                    { $project: { malas: 1, users: { $size: '$users' } } },
                ]),
            ]);

            const row = totals[0] || {};
            return {
                allTimeUsers: row.users || 0,
                allTimeMalas: row.totalMalas || 0,
                allTimeCount: row.totalCount || 0,
                weeklyUsers: weeklyStats[0]?.users || 0,
                weeklyMalas: weeklyStats[0]?.malas || 0,
                monthlyUsers: monthlyStats[0]?.users || 0,
                monthlyMalas: monthlyStats[0]?.malas || 0,
            };
        });

        res.set('Cache-Control', 'public, max-age=15, stale-while-revalidate=45');
        res.json({ success: true, response: payload, meta: { serverTime: new Date().toISOString(), today: ist.today() } });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ success: false, message: 'Failed to get stats' });
    }
});

// GET /api/naam-jap/user/:deviceId - Get user data + rank
router.get('/user/:deviceId', async (req, res) => {
    try {
        const user = await NaamJapUser.findOne({ deviceId: req.params.deviceId })
            .select('-pushToken')
            .lean();
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const { rank, totalUsers } = await getRankAndTotal(user.totalMalas);

        // Get highest mala day + recent logs in one pass (logs are small).
        let highestMalaDay = 0;
        for (const log of user.dailyLogs) {
            if (log.malas > highestMalaDay) highestMalaDay = log.malas;
        }

        const recentLogs = [...user.dailyLogs]
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 30);

        res.json({
            success: true,
            response: {
                user: {
                    name: user.name,
                    city: user.city,
                    mobile: user.mobile,
                    profileImage: user.profileImage || '',
                    deviceId: user.deviceId,
                    totalCount: user.totalCount,
                    totalMalas: user.totalMalas,
                    lastSyncAt: user.lastSyncAt,
                },
                rank,
                totalUsers,
                highestMalaDay,
                recentLogs,
                today: ist.today(),
                serverTime: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ success: false, message: 'Failed to get user data' });
    }
});

// GET /api/naam-jap/user/:deviceId/snapshot - Ultra-cheap change detector
// The app polls this while the counter screen is open: ~200 bytes, no
// aggregation, no ranking. If `version` differs from the last one, it fetches
// the full profile instead.
router.get('/user/:deviceId/snapshot', async (req, res) => {
    try {
        const user = await NaamJapUser.findOne({ deviceId: req.params.deviceId })
            .select('totalCount totalMalas lastSyncAt')
            .lean();
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.set('Cache-Control', 'no-store');
        res.json({
            success: true,
            response: {
                totalCount: user.totalCount,
                totalMalas: user.totalMalas,
                lastSyncAt: user.lastSyncAt,
                version: realtime.currentSeq(),
                today: ist.today(),
                serverTime: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('Snapshot error:', error);
        res.status(500).json({ success: false, message: 'Failed to get snapshot' });
    }
});

// POST /api/naam-jap/update-push-token - Update push token for a device
router.post('/update-push-token', async (req, res) => {
    try {
        const { deviceId, pushToken } = req.body;

        if (!deviceId || !pushToken) {
            return res.status(400).json({
                success: false,
                message: 'deviceId and pushToken are required',
            });
        }

        const result = await NaamJapUser.updateOne({ deviceId }, { $set: { pushToken } });
        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ success: true, message: 'Push token updated' });
    } catch (error) {
        console.error('Update push token error:', error);
        res.status(500).json({ success: false, message: 'Failed to update push token' });
    }
});

// POST /api/naam-jap/delete-account - Delete user account by mobile number (Play Store compliant)
router.post('/delete-account', async (req, res) => {
    try {
        const { mobile } = req.body;

        if (!mobile) {
            return res.status(400).json({
                success: false,
                message: 'Mobile number is required',
            });
        }

        const trimmedMobile = normaliseMobile(mobile);
        if (trimmedMobile.length < 10 || trimmedMobile.length > 15) {
            return res.status(400).json({
                success: false,
                message: 'Invalid mobile number',
            });
        }

        const user = await NaamJapUser.findOne({ mobile: trimmedMobile }).select('_id deviceId name').lean();
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'No account found with this mobile number',
            });
        }

        // Personal data is deleted across every collection that stores it.
        // Financial ledgers (wallet / withdrawals / referral credits) are kept
        // for accounting but are no longer linkable to a phone number.
        await Promise.all([
            NaamJapUser.deleteOne({ _id: user._id }),
            DailyLogArchive.deleteMany({ $or: [{ deviceId: user.deviceId }, { mobile: trimmedMobile }] }),
            HandwrittenNaam.deleteMany({ deviceId: user.deviceId }),
            StepTracker.deleteMany({ deviceId: user.deviceId }),
            NaamJapUser.updateMany({ mobile: trimmedMobile }, { $set: { mobile: '' } }),
        ]);

        try {
            const Wallet = require('../models/Wallet');
            await Wallet.updateMany({ mobile: trimmedMobile }, { $set: { mobile: '' } });
        } catch (walletErr) {
            console.error('delete-account: wallet anonymise failed:', walletErr.message);
        }

        announceUserChange('deleted', { deviceId: user.deviceId });

        res.json({
            success: true,
            message: 'Your account and all associated data have been permanently deleted',
        });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete account. Please try again.' });
    }
});

// ============ ADMIN ROUTES ============

// GET /api/naam-jap/admin/users - List all users (admin)
router.get('/admin/users', verifyAdmin, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
        const skip = (page - 1) * limit;
        const rawSearch = String(req.query.search || '').trim().slice(0, 60);
        const allowedSort = new Set(['totalMalas', 'totalCount', 'lastSyncAt', 'createdAt', 'name', 'city']);
        const sortBy = allowedSort.has(req.query.sortBy) ? req.query.sortBy : 'totalMalas';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

        const filter = { isActive: true };
        if (rawSearch) {
            // Escape user input so a stray "(" cannot throw a regex error.
            const safe = rawSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const rx = new RegExp(safe, 'i');
            filter.$or = [{ name: rx }, { city: rx }, { mobile: rx }];
        }

        const cacheKey = `admin-users:${page}:${limit}:${rawSearch}:${sortBy}:${sortOrder}`;
        const payload = await cached('users', cacheKey, 8, async () => {
            const [users, total] = await Promise.all([
                NaamJapUser.find(filter)
                    .sort({ [sortBy]: sortOrder, _id: 1 })
                    .skip(skip)
                    .limit(limit)
                    .select('name city mobile profileImage totalCount totalMalas lastSyncAt createdAt')
                    .lean(),
                NaamJapUser.countDocuments(filter),
            ]);
            return {
                users,
                pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
            };
        });

        res.json({ success: true, response: payload, meta: { serverTime: new Date().toISOString() } });
    } catch (error) {
        console.error('Admin list users error:', error);
        res.status(500).json({ success: false, message: 'Failed to list users' });
    }
});

// GET /api/naam-jap/admin/stats - Admin overview stats
router.get('/admin/stats', verifyAdmin, async (req, res) => {
    try {
        const payload = await cached('stats', 'admin-overview', 10, async () => {
            const today = ist.today();
            const [totals, todayActive, newThisWeek] = await Promise.all([
                NaamJapUser.aggregate([
                    { $match: { isActive: true } },
                    {
                        $group: {
                            _id: null,
                            users: { $sum: 1 },
                            totalMalas: { $sum: '$totalMalas' },
                            totalCount: { $sum: '$totalCount' },
                        },
                    },
                ]),
                NaamJapUser.countDocuments({
                    isActive: true,
                    dailyLogs: {
                        $elemMatch: { date: today, $or: [{ malas: { $gt: 0 } }, { count: { $gt: 0 } }] },
                    },
                }),
                NaamJapUser.countDocuments({ createdAt: { $gte: ist.startOfISTDayMinusDays(7) } }),
            ]);
            const row = totals[0] || {};
            return {
                totalUsers: row.users || 0,
                totalMalas: row.totalMalas || 0,
                totalCount: row.totalCount || 0,
                todayActiveUsers: todayActive,
                newUsersThisWeek: newThisWeek,
            };
        });

        res.json({ success: true, response: payload, meta: { today: ist.today() } });
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ success: false, message: 'Failed to get admin stats' });
    }
});

// GET /api/naam-jap/user/:deviceId/daily/:date - Get or create daily log for specific date
router.get('/user/:deviceId/daily/:date', async (req, res) => {
    try {
        const { deviceId, date } = req.params;

        // Validate date format YYYY-MM-DD
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ success: false, message: 'Invalid date format. Use YYYY-MM-DD' });
        }

        // Read first (fast path used on every counter screen open).
        let user = await NaamJapUser.findOne({ deviceId }).lean();
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        let dailyLog = user.dailyLogs.find((log) => log.date === date);

        if (!dailyLog) {
            dailyLog = { date, count: 0, malas: 0 };
            // Idempotent create: only appends if no entry for this date exists
            // yet, so two devices opening the same screen cannot duplicate it.
            await NaamJapUser.updateOne(
                { deviceId, 'dailyLogs.date': { $ne: date } },
                { $push: { dailyLogs: { date, count: 0, malas: 0 } } }
            );
            user.dailyLogs.push(dailyLog);
            if (needsRetention(user)) {
                enforceRetention(user).catch((err) =>
                    console.error('retention failed for', deviceId, err.message)
                );
            }
        }

        const { rank, totalUsers } = await getRankAndTotal(user.totalMalas);

        res.json({
            success: true,
            response: {
                user: {
                    name: user.name,
                    city: user.city,
                    mobile: user.mobile,
                    profileImage: user.profileImage || '',
                    deviceId: user.deviceId,
                    totalCount: user.totalCount,
                    totalMalas: user.totalMalas,
                    lastSyncAt: user.lastSyncAt,
                },
                dailyLog,
                rank,
                totalUsers,
                today: ist.today(),
            },
        });
    } catch (error) {
        console.error('Get daily log error:', error);
        res.status(500).json({ success: false, message: 'Failed to get daily log' });
    }
});

module.exports = router;
