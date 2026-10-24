# Data safety — nothing already in the database may be lost

This is the rule every change in this repository is measured against. It applies
to schema changes, performance work, retention and deployments.

## 1. Guarantees

| Guarantee | How it is enforced |
| --- | --- |
| No silent deletion | Daily logs that leave the hot window are copied to `DailyLogArchive` (and `HandwrittenLogArchive`) **before** the trim. Copy first, delete second, idempotent upserts. |
| No counter regression | Lifetime counters are merged with `$max` in MongoDB itself. A reinstalled app sending `0` can never erase history. |
| No lost increments | Sync is a single atomic pipeline update, so overlapping requests and multiple devices cannot overwrite each other. |
| No destructive schema work | All new fields are optional with defaults. Indexes are created with `createIndexes()`; `syncIndexes()` (which drops) is never used. |
| No destructive restore | Restores are upserts by `_id`; `--drop` is opt-in and requires typing `RESTORE`. A pre-restore snapshot is always written first. |
| Verifiable backup | Every backup file has a SHA-256 checksum + document count in `manifest.json`; restore refuses to run on a mismatch. |
| Read-only diagnostics | `verifyData.js` never writes. It reports problems; a human decides the fix. |

## 2. Retention policy

```
hot document (NaamJapUser.dailyLogs)
    0 ─────────────────────────── 400 days ──────────────▶
    │◀──── served by every API read ────▶│
                                         │  archive copy (durable, indexed)
                                         ▼
                              DailyLogArchive { deviceId, date, count, malas }
```

* Hot window: `DAILY_LOG_RETAIN_DAYS` (default **400**). Previously the cap was
  90 entries and the excess was deleted outright.
* Lifetime totals (`totalCount`, `totalMalas`, `HandwrittenNaam.lifetimeCount`)
  are **never** touched by retention.
* Archive collections are indexed on `(deviceId, date)` unique, `date`, `mobile`
  — so historical reports and support requests stay queryable.
* Account deletion (Play Store requirement) removes the archives for that user
  as part of the deletion; financial ledgers stay but are anonymised (mobile
  number cleared).

## 3. Backup runbook

Backups use only the Node driver, so they work on Atlas, on a VPS, and in CI
without `mongodump` installed.

```bash
cd server

# 1. Take a backup (streaming, gzip, checksummed)
npm run backup
#   → backups/<timestamp>/<collection>.jsonl.gz + manifest.json

# 2. Prove the backup is complete
cat backups/<timestamp>/manifest.json
#   "complete": true     ← false means at least one collection failed

# 3. Inspect what a restore would do (no writes)
node scripts/restore.js --from=backups/<timestamp> --dry-run

# 4. Restore (upsert merge; existing docs not in the backup are untouched)
node scripts/restore.js --from=backups/<timestamp>

# 5. Verify integrity afterwards
npm run verify-data
```

Targeted restore of one collection (for example after a bad bulk edit):

```bash
node scripts/restore.js --from=backups/<timestamp> --collections=naamjapusers
```

**Before any risky operation** (migration, bulk update, index rewrite): take a
fresh backup and confirm `"complete": true`.

Recommended cadence: nightly scheduled backup, plus an on-demand backup before
every deploy that touches data.

## 4. Integrity checks

`server/scripts/verifyData.js` answers "is our data still sane?" without
touching anything:

* negative / non-numeric lifetime counters
* duplicate `deviceId` documents (would mean the unique index is missing)
* duplicated day entries inside one user document
* hot documents holding more than 400 logs (retention lagging)
* archive totals vs. hot totals
* collection inventory with document counts

Exit codes: `0` clean, `2` issues found, `1` could not run.

## 5. Sync semantics (why data stopped disappearing)

```js
// one atomic update, executed inside MongoDB
findOneAndUpdate({ deviceId }, [{
  $set: {
    totalCount: { $max: ['$totalCount', incomingCount] },   // never goes down
    totalMalas: { $max: ['$totalMalas', incomingMalas] },
    lastSyncAt: '$$NOW',
    dailyLogs: mergeTodayEntry(incomingTodayCount, incomingTodayMalas)
  }
}], { new: true })
```

* The app never has to know the server's current value.
* A stale device, a double tap, or two phones signed into the same account all
  converge to the maximum value — the correct one.
* Today's entry is merged in the same write, so the dashboard's "active today"
  and "today's malas" cannot drift from the user's totals.
* Retention runs asynchronously after the response: it can never slow a sync,
  and if it fails the data simply stays in the hot document.

## 6. Deploy checklist (data edition)

```bash
# 1. Backup and verify
cd server && npm run backup && npm run verify-data

# 2. Apply index changes (creates only — safe on a live database)
npm run indexes

# 3. Run the API test suite
npm test

# 4. Deploy, then confirm health from the outside
curl -s https://your-api/api/system/health | jq '.response.status'
```

Rollback plan: restore from the backup taken in step 1 with
`node scripts/restore.js --from=…`. Because restores are merges, they can be
applied to a live database without dropping documents written after the backup.

## 7. Rules for future changes

1. **Additive first.** Add a field, backfill, code switch, then (much later and
   only with a backup) remove the old field.
2. **Never rename a collection or index in place.** Create the new one, dual
   write, migrate, then remove.
3. **Never `drop()`, `deleteMany({})`, or `syncIndexes()` in application code or
   scripts.** Production cleanup is a reviewed, backed-up, scripted operation.
4. **Any code that trims or deletes must write a durable copy first** — the
   retention services are the reference implementation.
5. **Every write path that affects a dashboard number must publish an event**
   (`announce(...)`) so caches and clients cannot serve stale values.
6. **Keep the day key consistent.** Use `server/utils/ist.js`; never
   `new Date().toISOString().slice(0, 10)`.

## 8. Incident playbook

| Symptom | First move |
| --- | --- |
| Numbers dropped unexpectedly | `npm run verify-data`; compare with last night's backup manifest; restore only the affected collection. |
| Wrong numbers on the dashboard only | `POST /api/system/cache/flush {"namespaces":"analytics"}`; the database is untouched. |
| A user's history looks short | Check `DailyLogArchive` for that `deviceId`/`mobile` — archived days are never deleted. |
| Bad bulk edit | `node scripts/restore.js --from=<pre-deploy backup> --collections=<collection>` (merge restore, then verify). |
| API can't reach MongoDB | `/api/health` still returns 200 so the platform does not restart-loop; data routes return 503 with a clear message. |
