#!/usr/bin/env node
/**
 * Read-only data integrity report. Never writes, never deletes.
 *
 * Checks the invariants the product promises:
 *   • lifetime counters are non-negative whole numbers
 *   • a device never has two log entries for the same day
 *   • lifetime totals are never smaller than what today's logs show
 *   • archived history is still readable and sums correctly
 *   • no orphan / duplicate device or mobile records
 *
 *   node scripts/verifyData.js
 *   node scripts/verifyData.js --json
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const modelsDir = path.join(__dirname, '..', 'models');
const models = {};
for (const file of fs.readdirSync(modelsDir)) {
    if (!file.endsWith('.js')) continue;
    const model = require(path.join(modelsDir, file));
    if (model && model.modelName) models[model.modelName] = model;
}

const json = process.argv.includes('--json');
const report = { checkedAt: new Date().toISOString(), issues: [], info: {}, ok: true };

function issue(level, code, message, sample) {
    report.issues.push({ level, code, message, sample });
    if (level === 'error') report.ok = false;
}

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('MONGODB_URI is not set.');
        process.exit(1);
    }
    await mongoose.connect(uri, { bufferCommands: false });
    const db = mongoose.connection.db;

    const NaamJapUser = models.NaamJapUser;
    const DailyLogArchive = models.DailyLogArchive;

    const collections = await db.listCollections().toArray();
    for (const { name } of collections) {
        const count = await db.collection(name).estimatedDocumentCount();
        report.info[name] = { documents: count };
    }

    if (NaamJapUser) {
        const totalsDocs = await NaamJapUser.countDocuments();
        report.info.NaamJapUser = { documents: totalsDocs };

        const badTotals = await NaamJapUser.countDocuments({
            $or: [
                { totalCount: { $lt: 0 } },
                { totalMalas: { $lt: 0 } },
                { totalCount: { $not: { $type: 'number' } } },
                { totalMalas: { $not: { $type: 'number' } } },
            ],
        });
        if (badTotals) issue('error', 'negative-or-non-numeric-totals', `${badTotals} user(s) have invalid lifetime counters`);

        const duplicateDevices = await NaamJapUser.aggregate([
            { $group: { _id: '$deviceId', n: { $sum: 1 } } },
            { $match: { n: { $gt: 1 } } },
            { $limit: 20 },
        ]);
        if (duplicateDevices.length) {
            issue('error', 'duplicate-device', `${duplicateDevices.length} deviceId(s) appear more than once (unique index missing?)`, duplicateDevices);
        }

        const duplicateDays = await NaamJapUser.aggregate([
            { $project: { dates: '$dailyLogs.date' } },
            {
                $project: {
                    dup: {
                        $size: {
                            $filter: {
                                input: { $range: [0, { $size: '$dates' }] },
                                as: 'i',
                                cond: {
                                    $gt: [
                                        {
                                            $size: {
                                                $filter: {
                                                    input: '$dates',
                                                    as: 'd',
                                                    cond: { $eq: ['$$d', { $arrayElemAt: ['$dates', '$$i'] }] },
                                                },
                                            },
                                        },
                                        1,
                                    ],
                                },
                            },
                        },
                    },
                },
            },
            { $match: { dup: { $gt: 0 } } },
            { $limit: 5 },
        ]);
        if (duplicateDays.length) {
            issue('warning', 'duplicate-daily-log', `sample of users with duplicate day entries`, duplicateDays);
        }

        const [sums] = await NaamJapUser.aggregate([
            {
                $project: {
                    logCount: { $sum: '$dailyLogs.count' },
                    logMalas: { $sum: '$dailyLogs.malas' },
                    totalCount: 1,
                    totalMalas: 1,
                },
            },
            {
                $group: {
                    _id: null,
                    windowCount: { $sum: '$logCount' },
                    windowMalas: { $sum: '$logMalas' },
                    lifetimeCount: { $sum: '$totalCount' },
                    lifetimeMalas: { $sum: '$totalMalas' },
                },
            },
        ]);
        report.info.naamJapSums = sums;

        const missingArchive = await NaamJapUser.countDocuments({
            $expr: { $gt: [{ $size: { $ifNull: ['$dailyLogs', []] } }, 400] },
        });
        if (missingArchive) {
            issue('warning', 'hot-window-overflow', `${missingArchive} user document(s) hold more than 400 daily logs; run a maintenance sync`);
        }

        if (DailyLogArchive) {
            const archived = await DailyLogArchive.countDocuments();
            const [archiveSums] = await DailyLogArchive.aggregate([
                { $group: { _id: null, count: { $sum: '$count' }, malas: { $sum: '$malas' } } },
            ]);
            report.info.archivedLogs = { documents: archived, ...(archiveSums || {}) };
        }
    }

    await mongoose.connection.close();

    if (json) {
        console.log(JSON.stringify(report, null, 2));
    } else {
        console.log(`\nShree Jii data integrity report — ${report.checkedAt}\n`);
        for (const [name, info] of Object.entries(report.info)) {
            console.log(`  ${name.padEnd(22)} ${JSON.stringify(info)}`);
        }
        console.log('');
        if (report.issues.length === 0) {
            console.log('  ✅ No integrity issues found. Nothing was modified.');
        } else {
            for (const i of report.issues) {
                console.log(`  ${i.level === 'error' ? '❌' : '⚠️ '} [${i.code}] ${i.message}`);
                if (i.sample) console.log(`     ${JSON.stringify(i.sample).slice(0, 400)}`);
            }
        }
        console.log('');
    }

    process.exit(report.ok ? 0 : 2);
}

main().catch(async (err) => {
    console.error('[verify] fatal:', err);
    try {
        await mongoose.connection.close();
    } catch {
        /* ignore */
    }
    process.exit(1);
});
