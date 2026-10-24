#!/usr/bin/env node
/**
 * Create the indexes declared in the Mongoose models — without ever dropping
 * one. `Model.syncIndexes()` (which deletes indexes it does not know about) is
 * deliberately NOT used here: on a production database a stale model file could
 * otherwise wipe a carefully tuned index.
 *
 *   node scripts/ensureIndexes.js           # create missing indexes
 *   node scripts/ensureIndexes.js --list    # show what exists / is declared
 *
 * Index builds are non-blocking for reads and are safe to run on a live DB.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

function hasFlag(name) {
    return process.argv.includes(`--${name}`);
}

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('MONGODB_URI is not set. Aborting.');
        process.exit(1);
    }

    // Load every model so all schema indexes are registered.
    const modelsDir = path.join(__dirname, '..', 'models');
    for (const file of fs.readdirSync(modelsDir)) {
        if (!file.endsWith('.js')) continue;
        require(path.join(modelsDir, file));
    }

    await mongoose.connect(uri, { bufferCommands: false });
    console.log(`[indexes] database: ${mongoose.connection.db.databaseName}`);

    const listOnly = hasFlag('list');
    let failures = 0;

    for (const [name, model] of Object.entries(mongoose.models)) {
        const declared = model.schema.indexes().map(([fields, opts = {}]) => ({
            fields,
            unique: !!opts.unique,
            sparse: !!opts.sparse,
        }));

        if (listOnly) {
            const existing = await model.collection.indexes().catch(() => []);
            console.log(`\n${name}`);
            console.log(`  existing: ${existing.map((i) => i.name).join(', ') || '(none)'}`);
            console.log(
                `  declared: ${declared.map((d) => `${JSON.stringify(d.fields)}${d.unique ? ' unique' : ''}`).join(', ') || '(none)'}`
            );
            continue;
        }

        try {
            const startedAt = Date.now();
            await model.createIndexes();
            const ms = Date.now() - startedAt;
            console.log(`[indexes] ${name}: ok (${declared.length} declared, ${ms}ms)`);
        } catch (err) {
            failures += 1;
            console.error(`[indexes] ${name}: FAILED — ${err.message}`);
            if (err.code === 11000) {
                console.error(
                    '  Duplicate values already exist for a unique index. Resolve the duplicates, then re-run. No data was changed.'
                );
            }
        }
    }

    await mongoose.connection.close();
    console.log(failures ? `\n[indexes] ${failures} model(s) failed` : '\n[indexes] all indexes in place');
    process.exit(failures ? 1 : 0);
}

main().catch(async (err) => {
    console.error('[indexes] fatal:', err);
    try {
        await mongoose.connection.close();
    } catch {
        /* ignore */
    }
    process.exit(1);
});
