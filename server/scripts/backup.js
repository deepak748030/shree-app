#!/usr/bin/env node
/**
 * Zero-dependency, memory-safe MongoDB backup.
 *
 * Works with Atlas / any hosted MongoDB without `mongodump` being installed:
 * every collection is streamed through a cursor into a gzipped JSONL file, and
 * a manifest records document counts, SHA-256 checksums and the index list so a
 * restore can be verified, not just hoped for.
 *
 *   node scripts/backup.js                       # -> backups/<timestamp>/
 *   node scripts/backup.js --out=/tmp/shree-bak  # custom destination
 *   node scripts/backup.js --collections=users,subscriptions
 *   node scripts/backup.js --no-gzip             # plain .jsonl
 *
 * Exit codes: 0 success, 1 failure (partial backups are still written and the
 * manifest is marked `complete: false`, so nothing is silently lost).
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const mongoose = require('mongoose');

function arg(name, fallback = null) {
    const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
    if (!hit) return fallback;
    if (hit.includes('=')) return hit.split('=').slice(1).join('=');
    return true;
}

function stamp() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}

async function backup() {
    const uri = arg('uri') || process.env.MONGODB_URI;
    if (!uri) {
        console.error('MONGODB_URI is not set. Aborting without touching anything.');
        process.exit(1);
    }

    const outRoot = String(arg('out') || path.join(process.cwd(), 'backups'));
    const dir = path.join(outRoot, String(arg('name') || stamp()));
    const gzip = !arg('no-gzip', false);
    const only = String(arg('collections', '') || '')
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);

    fs.mkdirSync(dir, { recursive: true });
    console.log(`[backup] target: ${dir}`);
    console.log(`[backup] connecting…`);

    await mongoose.connect(uri, { bufferCommands: false });
    const db = mongoose.connection.db;
    console.log(`[backup] database: ${db.databaseName}`);

    const { collections } = await db.listCollections().toArray();
    const names = collections
        .map((c) => c.name)
        .filter((n) => (only.length ? only.includes(n) : true) && !n.startsWith('system.'));

    const manifest = {
        startedAt: new Date().toISOString(),
        database: db.databaseName,
        gzip,
        complete: false,
        collections: {},
    };

    let failures = 0;

    for (const name of names) {
        const fileName = `${name}.jsonl${gzip ? '.gz' : ''}`;
        const filePath = path.join(dir, fileName);
        const hash = crypto.createHash('sha256');
        const out = gzip ? zlib.createGzip({ level: 6 }) : null;
        const file = fs.createWriteStream(filePath);
        const sink = gzip ? out.pipe(file) : file;

        const startedAt = Date.now();
        let count = 0;
        try {
            const cursor = db.collection(name).find({}, { batchSize: 1000 });
            for await (const doc of cursor) {
                let line = `${JSON.stringify(doc.__v !== undefined ? doc : doc)}\n`;
                count += 1;
                if (gzip) {
                    hash.update(line);
                    if (!out.write(line)) await new Promise((r) => out.once('drain', r));
                } else {
                    hash.update(line);
                    if (!file.write(line)) await new Promise((r) => file.once('drain', r));
                }
            }
            if (gzip) out.end();
            else file.end();
            await new Promise((resolve, reject) => {
                sink.on('finish', resolve);
                sink.on('error', reject);
            });

            const indexes = await db.collection(name).indexes().catch(() => []);
            const sizeBytes = fs.statSync(filePath).size;
            manifest.collections[name] = {
                file: fileName,
                documents: count,
                sizeBytes,
                sha256: hash.digest('hex'),
                durationMs: Date.now() - startedAt,
                indexes,
            };
            console.log(
                `[backup] ${name}: ${count} docs, ${(sizeBytes / 1024 / 1024).toFixed(1)} MB`
            );
        } catch (err) {
            failures += 1;
            console.error(`[backup] ${name} FAILED: ${err.message}`);
            manifest.collections[name] = { file: fileName, documents: count, error: err.message };
        }
    }

    manifest.finishedAt = new Date().toISOString();
    manifest.complete = failures === 0;
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    console.log(`[backup] manifest: ${path.join(dir, 'manifest.json')}`);
    console.log(`[backup] ${failures === 0 ? 'COMPLETE' : `${failures} collection(s) failed`}`);

    await mongoose.connection.close();
    process.exit(failures === 0 ? 0 : 1);
}

backup().catch(async (err) => {
    console.error('[backup] fatal:', err);
    try {
        await mongoose.connection.close();
    } catch {
        /* ignore */
    }
    process.exit(1);
});
