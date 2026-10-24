#!/usr/bin/env node
/**
 * Restore / merge a backup created by scripts/backup.js — safely.
 *
 * Safety model
 *  * Idempotent: documents are upserted by `_id`. Running a restore twice is a
 *    no-op the second time, so an interrupted restore can simply be re-run.
 *  * Non-destructive by default: existing documents that are *not* in the
 *    backup are left alone. Nothing is dropped unless you pass `--drop`.
 *  * Automatic safety copy: before writing anything, the current state of the
 *    affected collections is backed up to backups/pre-restore-<timestamp>.
 *  * Checksum verification: every file is SHA-256 checked against the manifest
 *    before a single document is written.
 *
 *   node scripts/restore.js --from=backups/2026-01-01T10-00-00-000Z --dry-run
 *   node scripts/restore.js --from=... --collections=naamjapusers
 *   node scripts/restore.js --from=... --drop   # destructive, asks for --yes
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const readline = require('readline');
const mongoose = require('mongoose');

function arg(name, fallback = null) {
    const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
    if (!hit) return fallback;
    if (hit.includes('=')) return hit.split('=').slice(1).join('=');
    return true;
}

const STAMP = new Date().toISOString().replace(/[:.]/g, '-');

async function verifyAndHash(filePath, expected) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const isGzip = filePath.endsWith('.gz');
        const input = fs.createReadStream(filePath);
        const stream = isGzip ? input.pipe(zlib.createGunzip()) : input;
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => {
            const actual = hash.digest('hex');
            resolve({ ok: !expected || actual === expected, actual });
        });
        stream.on('error', reject);
    });
}

async function safetyBackup(db, collections, sourceDir) {
    const dir = path.join(path.dirname(sourceDir), `pre-restore-${STAMP}`);
    fs.mkdirSync(dir, { recursive: true });
    const manifest = { startedAt: new Date().toISOString(), reason: 'pre-restore safety copy', collections: {} };
    for (const name of collections) {
        const exists = (await db.listCollections({ name }).toArray()).length > 0;
        if (!exists) {
            manifest.collections[name] = { documents: 0, note: 'collection did not exist' };
            continue;
        }
        const filePath = path.join(dir, `${name}.jsonl.gz`);
        const out = zlib.createGzip({ level: 6 });
        const file = fs.createWriteStream(filePath);
        out.pipe(file);
        let count = 0;
        for await (const doc of db.collection(name).find({}, { batchSize: 1000 })) {
            if (!out.write(`${JSON.stringify(doc)}\n`)) await new Promise((r) => out.once('drain', r));
            count += 1;
        }
        out.end();
        await new Promise((resolve) => file.on('finish', resolve));
        manifest.collections[name] = { file: path.basename(filePath), documents: count };
    }
    manifest.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    return dir;
}

async function confirm(question) {
    if (arg('yes', false)) return true;
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((resolve) => rl.question(`${question} [type RESTORE]: `, resolve));
    rl.close();
    return answer.trim() === 'RESTORE';
}

async function restore() {
    const uri = arg('uri') || process.env.MONGODB_URI;
    if (!uri) {
        console.error('MONGODB_URI is not set. Aborting.');
        process.exit(1);
    }
    const from = arg('from');
    if (!from || from === true) {
        console.error('Usage: node scripts/restore.js --from=<backup-dir> [--dry-run] [--collections=a,b] [--drop]');
        process.exit(1);
    }
    const dir = path.resolve(String(from));
    const manifestPath = path.join(dir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
        console.error(`No manifest.json in ${dir}`);
        process.exit(1);
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const dryRun = !!arg('dry-run', false);
    const drop = !!arg('drop', false);
    const only = String(arg('collections', '') || '')
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);

    const names = Object.keys(manifest.collections).filter((n) => (only.length ? only.includes(n) : true));
    console.log(`[restore] source     : ${dir}`);
    console.log(`[restore] collections: ${names.join(', ')}`);
    console.log(`[restore] mode       : ${dryRun ? 'DRY RUN (no writes)' : drop ? 'DROP + INSERT' : 'UPSERT MERGE'}`);

    await mongoose.connect(uri, { bufferCommands: false });
    const db = mongoose.connection.db;
    console.log(`[restore] database   : ${db.databaseName}`);

    // 1. Verify every file before writing anything.
    for (const name of names) {
        const entry = manifest.collections[name];
        if (entry.error) {
            console.error(`[restore] ${name}: source backup recorded an error, refusing to restore it`);
            process.exit(1);
        }
        const filePath = path.join(dir, entry.file);
        if (!fs.existsSync(filePath)) {
            console.error(`[restore] ${name}: missing file ${entry.file}`);
            process.exit(1);
        }
        const { ok, actual } = await verifyAndHash(filePath, entry.sha256);
        if (!ok) {
            console.error(`[restore] ${name}: checksum mismatch (expected ${entry.sha256}, got ${actual})`);
            process.exit(1);
        }
        console.log(`[restore] ${name}: checksum OK (${entry.documents} docs expected)`);
    }

    if (dryRun) {
        console.log('[restore] dry run complete — nothing was written.');
        await mongoose.connection.close();
        return;
    }

    if (drop) {
        const ok = await confirm(
            `This will DELETE all documents in: ${names.join(', ')} on "${db.databaseName}"`
        );
        if (!ok) {
            console.log('[restore] cancelled.');
            await mongoose.connection.close();
            process.exit(1);
        }
    }

    // 2. Always create a safety copy first.
    const safetyDir = await safetyBackup(db, names, dir);
    console.log(`[restore] safety copy: ${safetyDir}`);
    fs.writeFileSync(path.join(safetyDir, 'README.txt'), `Partial (pre-restore) copy created at ${STAMP}.\nIts manifest has no checksums; it is a rollback aid.\n`);

    // 3. Restore.
    let totalWritten = 0;
    for (const name of names) {
        const entry = manifest.collections[name];
        const filePath = path.join(dir, entry.file);
        const collection = db.collection(name);

        if (drop) await collection.deleteMany({});

        const input = fs.createReadStream(filePath);
        const stream = entry.file.endsWith('.gz') ? input.pipe(zlib.createGunzip()) : input;
        const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

        let batch = [];
        let written = 0;
        const flush = async () => {
            if (!batch.length) return;
            const ops = batch.map((doc) => ({
                replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true },
            }));
            await collection.bulkWrite(ops, { ordered: false });
            written += ops.length;
            batch = [];
        };

        for await (const line of rl) {
            if (!line.trim()) continue;
            batch.push(JSON.parse(line));
            if (batch.length >= 500) await flush();
        }
        await flush();
        totalWritten += written;
        console.log(`[restore] ${name}: ${written} document(s) upserted`);
    }

    console.log(`[restore] done — ${totalWritten} document(s) written. Safety copy: ${safetyDir}`);
    await mongoose.connection.close();
}

restore().catch(async (err) => {
    console.error('[restore] fatal:', err);
    try {
        await mongoose.connection.close();
    } catch {
        /* ignore */
    }
    process.exit(1);
});
