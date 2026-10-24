# Performance & realtime — what changed and how to verify it

The goal was not "fast-looking", it was **fast and correct**: every screen paints
from memory, every number is recomputed from the database, and no optimisation
is allowed to change a business value silently.

## 1. Principles

1. **Cache reads, never writes.** A write always reaches MongoDB first, then
   invalidates, then notifies.
2. **One timezone for all counters.** IST (`Asia/Kolkata`) is the single day key.
   Previously the API mixed server-local time and UTC, so "today" could differ
   between the app and the dashboard by up to 5.5 hours.
3. **Idempotent, atomic writes.** Counters are merged with `$max` inside one
   `findOneAndUpdate`; retries and concurrent devices cannot corrupt them.
4. **Measure it.** `Server-Timing`, `X-Response-Time`, `X-Cache`, `X-Request-Id`
   and `GET /api/system/metrics` make regressions visible immediately.

## 2. Server

| Area | Before | After |
| --- | --- | --- |
| Dashboard analytics | 6 sequential queries; activity pipeline unwound **every** log of every user then filtered | 9 parallel index-backed queries; activity pre-filters by `dailyLogs.date` before `$unwind` |
| Repeated dashboard loads | Every request hit MongoDB | 15 s cache, invalidated by realtime on writes; cold loads coalesced (single-flight) |
| Naam Jap sync | read → mutate → `save()` (3 roundtrips, last-write-wins race) | 1 atomic pipeline update (`$max` merge), no lost updates |
| Rank + totals per sync | 2 extra `countDocuments` + full doc read | 1 index count + 15 s cached user total |
| Leaderboards / stats | recomputed per request | cached 10 s / 30 s, DB aggregation pre-filtered |
| Admin user list | regex scan on every keystroke, no cache | escaped regex, indexed sort, 8 s cache, `lean()` |
| Auth on every call | JWT verify + `Admin.findById` per request | + 60 s admin cache; cached doc excludes the password |
| Unknown `/api/*` route with DB down | waited the driver's 30 s timeout | fast 404/503; connection retries back off in 3 s windows |
| Response payloads | not compressed below default threshold | gzip above 1 KB, strong ETag revalidation |
| Observability | console logs only | request ids, `Server-Timing`, per-route p50/p95, slow-request warnings |

## 3. Admin dashboard

| Area | Before | After |
| --- | --- | --- |
| Bundle | one eager bundle incl. recharts | route-level `lazy()` + vendor chunks; charts load only when a chart page opens |
| Navigation | full spinner per page | shared SWR cache paints instantly, revalidates in background |
| Duplicate requests | each component fetched independently | request de-duplication by cache key |
| Search | one request per keystroke | 300 ms debounce + `keepPreviousData` (table never collapses) |
| Freshness | manual "Refresh" only | SSE invalidation, focus/visibility revalidation, reconnect catch-up |
| Navigation latency | route chunk downloaded on click | hover/focus prefetch warms chunks |
| Asset caching | `no-store` for everything (`vercel.json`) | immutable for `/assets/*`, revalidate only `index.html` |
| Failure UX | spinner forever on API error | explicit error card with retry; live/polling/offline badge |

### Measured bundle output (`npm run build`)

```
index-*.js        31.3 kB   ← app shell + inlined logo (initial)
react-*.js       162.6 kB   ← hashed, cached for a year
charts-*.js      336.5 kB   ← only on chart pages
http-*.js         36.3 kB
utils-*.js        20.0 kB
icons-*.js        15.7 kB
per-page chunks   3–16 kB each
index.css         37.3 kB   ← gzipped ≈ 6 kB
```

The brand logo used to be a **396 kB** 1024 px PNG imported by the shell and the
login screen. It is now a 2.5 kB 192 px asset (inlined by Vite), so it costs
zero extra requests and roughly 160× less transfer on the first paint. The
`index.html` shell also paints the brand background inline, which removes the
white flash before React mounts.

## 4. Mobile app

| Area | Before | After |
| --- | --- | --- |
| Every tap | debounced sync, but `fetch` with no timeout | debounce 350 ms + 10 s timeout, abortable |
| Backgrounded app | kept syncing every 15 s | paused on `background/inactive`, flushes once on the way out, syncs on return |
| Failure handling | silent fail, retry only on next change | exponential backoff (2 s → 60 s, jittered) while keeping counters dirty |
| Idle cost | fixed 15 s polling | adaptive: 15 s while counting, 60 s when idle |
| Static reads | refetched on every mount | memoised (home content 60 s, presets 5 min, stats 30 s, leaderboard 10 s) |
| Network errors | could hang the UI | single retry for GETs only; writes are never retried automatically |
| Change detection | full profile fetch | `GET /user/:deviceId/snapshot` (~200 bytes) |

## 5. Numbers from this workspace

Measured against the local API on 2026-10-24 (no MongoDB reachable, so only
cache/health paths are meaningful):

| Request | Latency | Notes |
| --- | --- | --- |
| `GET /api/health` | ~2.5 ms | no DB, no cache |
| `GET /api/realtime/version` | ~3 ms | 13 namespace version lookups |
| SSE first event | < 5 ms after connect | `ready` event, then 25 s heartbeats |

Data endpoints always report their own cost:

```bash
curl -sI http://localhost:5000/api/admin/analytics | grep -i server-timing
# Server-Timing: app;dur=3.1, analytics;dur=1.2;desc="memory"
# X-Cache: HIT
```

A memory hit for the dashboard payload is typically well under 5 ms; a cold
recompute depends on collection size and is the number to watch in
`/api/system/metrics` (`p95Ms` per route).

## 6. Tuning knobs

All are optional environment variables with safe defaults.

| Variable | Default | Effect |
| --- | --- | --- |
| `ANALYTICS_TTL_SECONDS` | 15 | dashboard cache freshness |
| `CACHE_MAX_ENTRIES` | 1000 | in-process LRU size |
| `CACHE_VERSION_REFRESH_MS` | 2000 | how often Redis versions are re-read |
| `REALTIME_THROTTLE_MS` | 1500 | burst coalescing window |
| `REALTIME_HEARTBEAT_MS` | 25000 | SSE heartbeat |
| `REALTIME_MAX_CLIENTS` | 5000 | connection guard |
| `SLOW_REQUEST_MS` | 400 | slow-request log threshold |
| `DB_TIMEOUT_MS` | 5000 | server selection timeout |
| `DB_RETRY_COOLDOWN_MS` | 3000 | backoff when the DB is known down |
| `DAILY_LOG_RETAIN_DAYS` | 400 | hot window before archiving |
| `LOGIN_MAX_ATTEMPTS` | 10 | login attempts per 15 min per IP+email |
| `CORS_ORIGINS` | `*` | comma-separated allowlist for production |

## 7. Scaling notes

* **Serverless (Vercel).** Each instance keeps its own SSE clients and its own
  LRU. Set `UPSTASH_REDIS_REST_URL/TOKEN` so cache versions are shared; the
  dashboard then invalidates across instances within ~2 s and the version-polling
  fallback covers any event that was broadcast on a different instance.
* **Long-lived Node host.** Everything works without Redis. Keep
  `KEEP_ALIVE_TIMEOUT_MS` above the load balancer's idle timeout so connections
  are reused.
* **MongoDB.** The hot queries are covered by compound indexes; run
  `npm run indexes` after a deploy that adds one. Watch `p95Ms` on
  `/api/naam-jap/sync` — it should stay at single-digit milliseconds because it
  is a single indexed `findOneAndUpdate`.

## 8. Regression guards

```bash
cd server && npm test          # cache, realtime and IST unit tests
cd .. && npx tsc --noEmit      # dashboard types
npm run build                  # production build
server/scripts/verifyData.js   # integrity report (read-only)
```

The tests encode the properties that keep the app fast *and* correct:
namespace invalidation, single-flight coalescing, trailing throttled events,
replayable event ids, and IST day rollover at 18:30 UTC.
