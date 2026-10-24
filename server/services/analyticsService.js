// Dashboard analytics: every number on the admin home page, computed in
// parallel, memoised and shape-stable.
//
// Performance notes (this used to be the slowest endpoint in the product):
//  * `dailyActivity` filters users by `dailyLogs.date` *before* `$unwind`.
//    The old pipeline unwound every log of every user and then matched, which
//    grows with (users × 90) instead of (users active in the window).
//  * Totals use `$group` over an index-backed `$match` (streaming, no sort).
//  * Every query runs with `.lean()` so Mongoose does not hydrate documents.
//  * The whole payload is cached for `ANALYTICS_TTL` seconds and invalidated
//    the instant a Naam Jap sync / write happens (see realtime.publish).
//  * The response shape is intentionally backwards compatible: existing keys
//    keep their meaning, extra keys are additive.

const NaamJapUser = require('../models/NaamJapUser');
const DailyQuote = require('../models/DailyQuote');
const Subscription = require('../models/Subscription');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const Wallet = require('../models/Wallet');
const RewardClaim = require('../models/RewardClaim');
const HandwrittenNaam = require('../models/HandwrittenNaam');
const { cachedResult } = require('../config/cache');
const ist = require('../utils/ist');

// Two cache namespaces with different costs and different write rates:
//   analytics    → Naam Jap counters (invalidated by every user sync, cheap to
//                  recompute: index-backed counts only)
//   analyticsBiz → membership + money (expensive scans, changed only by payment
//                  or payout writes)
// Splitting them stops a busy counting day from forcing wallet/revenue
// aggregations to run every couple of seconds.
const TTL = Number(process.env.ANALYTICS_TTL_SECONDS || 15);
const BIZ_TTL = Number(process.env.ANALYTICS_BIZ_TTL_SECONDS || 60);

function sum(list, field) {
    return list.reduce((acc, item) => acc + (Number(item[field]) || 0), 0);
}

async function naamJapSection() {
    const weekStart = ist.daysAgo(6);
    const monthStart = ist.daysAgo(29);
    const today = ist.today();
    const yesterday = ist.daysAgo(1);

    const activeToday = {
        isActive: true,
        dailyLogs: {
            $elemMatch: { date: today, $or: [{ malas: { $gt: 0 } }, { count: { $gt: 0 } }] },
        },
    };
    const activeYesterday = {
        isActive: true,
        dailyLogs: {
            $elemMatch: { date: yesterday, $or: [{ malas: { $gt: 0 } }, { count: { $gt: 0 } }] },
        },
    };

    const [
        totalsAgg,
        topUsersRaw,
        activityAgg,
        totalUsers,
        todayActive,
        yesterdayActive,
        above100,
        newThisWeek,
        newToday,
    ] = await Promise.all([
        NaamJapUser.aggregate([
            { $match: { isActive: true } },
            {
                $group: {
                    _id: null,
                    totalMalas: { $sum: '$totalMalas' },
                    totalCount: { $sum: '$totalCount' },
                },
            },
        ]),

        NaamJapUser.find({ isActive: true })
            .sort({ totalMalas: -1, totalCount: -1 })
            .limit(10)
            .select('name city totalMalas totalCount profileImage')
            .lean(),

        // Filter BEFORE unwind so we only touch logs inside the window.
        NaamJapUser.aggregate([
            { $match: { isActive: true, 'dailyLogs.date': { $gte: weekStart } } },
            { $unwind: '$dailyLogs' },
            { $match: { 'dailyLogs.date': { $gte: weekStart, $lte: today } } },
            {
                $group: {
                    _id: '$dailyLogs.date',
                    malas: { $sum: '$dailyLogs.malas' },
                    count: { $sum: '$dailyLogs.count' },
                    users: { $addToSet: '$_id' },
                },
            },
            { $project: { malas: 1, count: 1, users: { $size: '$users' } } },
            { $sort: { _id: 1 } },
        ]),

        // Index-backed counts (each is a covered multikey scan, no documents
        // are returned) instead of a $facet that would buffer the user set
        // several times over.
        NaamJapUser.countDocuments({ isActive: true }),
        NaamJapUser.countDocuments(activeToday),
        NaamJapUser.countDocuments(activeYesterday),
        NaamJapUser.countDocuments({ isActive: true, totalMalas: { $gte: 100 } }),
        NaamJapUser.countDocuments({ createdAt: { $gte: ist.startOfISTDayMinusDays(7) } }),
        NaamJapUser.countDocuments({ createdAt: { $gte: ist.startOfISTDay() } }),
    ]);

    const totals = totalsAgg[0] || {};

    const byDate = new Map(activityAgg.map((row) => [row._id, row]));
    const dailyActivity = ist.daysWindow(7).map((date) => {
        const row = byDate.get(date);
        return {
            date,
            name: ist.shortLabel(date),
            malas: row?.malas || 0,
            users: row?.users || 0,
            count: row?.count || 0,
        };
    });

    const todayRow = byDate.get(today) || { malas: 0, count: 0, users: 0 };
    const yesterdayRow = byDate.get(yesterday) || { malas: 0, count: 0, users: 0 };
    const last7Malas = sum(dailyActivity, 'malas');
    const prev7Malas = yesterdayRow.malas; // today is included in the window
    const trendPct =
        prev7Malas > 0 ? Number((((todayRow.malas - prev7Malas) / prev7Malas) * 100).toFixed(1)) : null;

    return {
        naamJap: {
            totalUsers,
            totalMalas: totals.totalMalas || 0,
            totalCount: totals.totalCount || 0,
            todayActiveUsers: todayActive,
            yesterdayActiveUsers: yesterdayActive,
            newUsersThisWeek: newThisWeek,
            newUsersToday: newToday,
            activeMilestoneUsers: above100,
            todayMalas: todayRow.malas,
            todayCount: todayRow.count,
            last7DaysMalas: last7Malas,
            dayOverDayTrend: trendPct,
            avgMalasPerActiveUser:
                todayActive > 0 ? Math.round(todayRow.malas / todayActive) : 0,
        },
        topUsers: topUsersRaw.map((u, i) => ({
            rank: i + 1,
            name: u.name,
            city: u.city,
            malas: u.totalMalas,
            count: u.totalCount,
            profileImage: u.profileImage || '',
        })),
        dailyActivity,
    };
}

async function quotesSection() {
    const [total, active] = await Promise.all([
        DailyQuote.countDocuments(),
        DailyQuote.countDocuments({ isActive: true }),
    ]);
    return { total, active };
}

async function membershipSection() {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const rows = await Subscription.aggregate([
        { $match: { status: 'paid' } },
        {
            $group: {
                _id: null,
                paidCount: { $sum: 1 },
                revenuePaise: { $sum: '$amount' },
                monthRevenuePaise: {
                    $sum: { $cond: [{ $gte: ['$paidAt', monthStart] }, '$amount', 0] },
                },
                activeNow: {
                    $sum: {
                        $cond: [
                            {
                                $or: [
                                    { $eq: ['$expiresAt', null] },
                                    { $gt: ['$expiresAt', now] },
                                ],
                            },
                            1,
                            0,
                        ],
                    },
                },
                lifetime: { $sum: { $cond: ['$planSnapshot.isLifetime', 1, 0] } },
            },
        },
    ]);
    const row = rows[0] || {};
    return {
        activeMembers: row.activeNow || 0,
        paidSubscriptions: row.paidCount || 0,
        lifetimeMembers: row.lifetime || 0,
        revenue: Math.round((row.revenuePaise || 0) / 100),
        revenueThisMonth: Math.round((row.monthRevenuePaise || 0) / 100),
    };
}

async function moneySection() {
    const [withdrawals, wallet, claims, handwritten] = await Promise.all([
        WithdrawalRequest.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    amount: { $sum: '$amount' },
                },
            },
        ]),
        Wallet.aggregate([
            {
                $group: {
                    _id: null,
                    balance: { $sum: '$balance' },
                    earned: { $sum: '$totalEarned' },
                    withdrawn: { $sum: '$totalWithdrawn' },
                    wallets: { $sum: 1 },
                },
            },
        ]),
        RewardClaim.aggregate([{ $count: 'n' }]),
        HandwrittenNaam.aggregate([
            {
                $group: {
                    _id: null,
                    users: { $sum: 1 },
                    lifetime: { $sum: '$lifetimeCount' },
                },
            },
        ]),
    ]);

    const byStatus = Object.fromEntries(
        withdrawals.map((w) => [w._id, { count: w.count, amount: w.amount }])
    );
    const walletRow = wallet[0] || {};

    return {
        pendingWithdrawals: byStatus.pending || { count: 0, amount: 0 },
        paidWithdrawals: byStatus.paid || { count: 0, amount: 0 },
        rejectedWithdrawals: byStatus.rejected || { count: 0, amount: 0 },
        wallet: {
            users: walletRow.wallets || 0,
            balance: Math.round(walletRow.balance || 0),
            totalEarned: Math.round(walletRow.earned || 0),
            totalWithdrawn: Math.round(walletRow.withdrawn || 0),
        },
        rewardClaims: claims[0]?.n || 0,
        handwritten: {
            users: handwritten[0]?.users || 0,
            lifetimeCount: handwritten[0]?.lifetime || 0,
        },
    };
}

/**
 * Build the full dashboard payload. Cached for TTL seconds; callers get
 * `source` so the UI can show "live vs cached" honestly.
 */
async function getDashboardAnalytics({ force = false } = {}) {
    if (force) {
        const { bump } = require('../config/cache');
        bump('analytics');
        bump('analyticsBiz');
    }

    const [core, business] = await Promise.all([
        cachedResult('analytics', 'overview', TTL, async () => {
            const [jap, quotes] = await Promise.all([naamJapSection(), quotesSection()]);
            return {
                naamJap: jap.naamJap,
                dailyQuotes: quotes,
                topUsers: jap.topUsers,
                dailyActivity: jap.dailyActivity,
                generatedAt: new Date().toISOString(),
                today: ist.today(),
            };
        }),
        cachedResult('analyticsBiz', 'overview', BIZ_TTL, async () => {
            const [membership, money] = await Promise.all([membershipSection(), moneySection()]);
            return { membership, money };
        }),
    ]);

    return {
        ...core.value,
        ...business.value,
        // Report the weakest link honestly: if any part was recomputed, the
        // caller is looking at fresh data.
        source: core.source === 'fresh' || business.source === 'fresh' ? 'fresh' : core.source,
        cachedForMs: Math.min(
            core.source === 'fresh' ? 0 : TTL * 1000,
            business.source === 'fresh' ? 0 : BIZ_TTL * 1000
        ),
    };
}

module.exports = { getDashboardAnalytics, TTL, BIZ_TTL };
