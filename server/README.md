# Shree Ji API Server

Express and MongoDB backend shared by the Shree Ji mobile app and admin dashboard. It provides Naam Jap synchronization, user rankings, content management, memberships, rewards, referrals, uploads, notifications, and admin authentication.

## Technology

- Node.js + Express 4
- MongoDB + Mongoose
- JWT authentication and bcrypt password hashing
- Cloudinary for uploaded media
- Razorpay for membership orders and payment verification
- Upstash Redis REST for optional serverless-friendly caching
- Expo Server SDK for push notifications
- Multer for multipart uploads
- Vercel serverless deployment support

## Prerequisites

- Node.js 20 LTS or newer
- npm 10 or newer
- MongoDB database
- Cloudinary credentials for image-upload endpoints
- Razorpay credentials for membership payments
- Optional Upstash Redis database

## Local setup

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

The API starts on `http://localhost:5000` by default.

```bash
curl http://localhost:5000/
curl http://localhost:5000/api/health
```

`/api/health` is answered before any database work, so it stays green even while
MongoDB is reconnecting. The richer probe is `/api/system/health`, which reports
database state, cache and realtime-hub statistics.

## Performance & realtime

The API is cache-first and event-driven. Details live in
[`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) and
[`docs/PERFORMANCE.md`](../docs/PERFORMANCE.md).

### Realtime endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /api/realtime/stream?topics=users,analytics` | Server-Sent Events; `token` query param accepted for EventSource |
| `GET /api/realtime/poll?since=<id>&topics=…` | Missed events (fallback for native clients) |
| `GET /api/realtime/version` | ~200-byte change detector for polling fallback |
| `GET /api/realtime/status` | Hub + cache diagnostics (admin) |

Every administrative write publishes an event and invalidates the matching cache
namespace. Events are `{ id, topic, type, at, day, data }`; the id is monotonic
and replayable through `Last-Event-ID`.

### Observability

* Every response carries `X-Request-Id`, `X-Response-Time` and `Server-Timing`.
* `GET /api/system/metrics` (admin) returns per-route count, avg, p50, p95, max.
* `GET /api/system/health` reports database state, cache hit-rate and hub stats.
* Responses above `SLOW_REQUEST_MS` are logged with their request id.

### Caching

A bounded in-process LRU is always on. Setting the Upstash variables adds a
shared layer so multiple serverless instances invalidate together. Keys are
versioned per namespace, which makes invalidation O(1) and impossible to miss.
If Redis is unreachable the API keeps working (memory only).

## Service scripts

```bash
npm test                 # node:test suite (cache, realtime, IST helpers)
npm run indexes          # create missing indexes (never drops)
npm run verify-data      # read-only integrity report
npm run backup           # streaming JSONL.gz backup + checksums
npm run restore -- --from=backups/<ts> --dry-run
```

See [`docs/DATA-SAFETY.md`](../docs/DATA-SAFETY.md) for the full runbook.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | Local HTTP port; defaults to `5000` |
| `NODE_ENV` | No | Use `development` locally; Vercel sets production mode |
| `MONGODB_URI` | Yes | MongoDB connection URI |
| `JWT_SECRET` | Yes | Long random secret used to sign and verify admin JWTs |
| `CLOUDINARY_CLOUD_NAME` | For uploads | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | For uploads | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | For uploads | Cloudinary API secret |
| `RAZORPAY_KEY_ID` | For payments | Razorpay public key ID |
| `RAZORPAY_KEY_SECRET` | For payments | Razorpay secret used for order creation and signature verification |
| `UPSTASH_REDIS_REST_URL` | No | Upstash REST endpoint (shared cache layer) |
| `UPSTASH_REDIS_REST_TOKEN` | No | Upstash REST token |
| `CACHE_MAX_ENTRIES` | No | In-process LRU size (default 1000) |
| `ANALYTICS_TTL_SECONDS` | No | Dashboard payload cache TTL (default 15) |
| `REALTIME_THROTTLE_MS` | No | Burst coalescing window for events (default 1500) |
| `REALTIME_HEARTBEAT_MS` | No | SSE heartbeat interval (default 25000) |
| `DAILY_LOG_RETAIN_DAYS` | No | Hot daily-log window before archiving (default 400) |
| `HANDWRITTEN_RETAIN_DAYS` | No | Same, for handwritten Naam (default 400) |
| `DB_TIMEOUT_MS` | No | Mongo server-selection timeout (default 5000) |
| `CORS_ORIGINS` | No | Comma-separated allowlist; default `*` |
| `LOGIN_MAX_ATTEMPTS` | No | Login attempts per 15 min per IP+email (default 10) |
| `SLOW_REQUEST_MS` | No | Slow-request log threshold (default 400) |

Generate a development JWT secret, for example:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Redis is fail-open: when its variables are absent or Upstash is unavailable, requests continue against MongoDB without cache acceleration.

## npm scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start with Nodemon and reload on JavaScript changes |
| `npm start` | Start with Node |

`server/index.js` listens directly outside production and exports the Express app for Vercel in production.

## API conventions

- Base path: `/api`
- JSON request limit: `4.5mb`
- Admin header: `Authorization: Bearer <token>`
- Typical success envelope:

```json
{
  "success": true,
  "response": {}
}
```

- Typical error envelope:

```json
{
  "success": false,
  "message": "Human-readable error"
}
```

Not every endpoint has the same `response` shape. Treat the route implementation and client TypeScript interfaces as the contract for each resource.

## Route groups

| Base path | Main responsibility | Access |
| --- | --- | --- |
| `/api/admin` | Bootstrap, login, profile, password, activity, analytics | Login is public; management requires admin JWT |
| `/api/naam-jap` | Mobile auth, profile, sync, rankings, stats, account deletion, user admin | Mixed public/app and admin JWT routes |
| `/api/daily-quotes` | Today's quote, recent quotes, upload, CRUD | Reads public; management requires admin JWT |
| `/api/home-content` | Bilingual home copy, banner, and sidebar image | Read public; management requires admin JWT |
| `/api/preset-images` | Counter image presets | Read public; management requires admin JWT |
| `/api/notifications` | Expo push notification broadcast | Admin JWT |
| `/api/step-tracker` | Per-device step synchronization and history | App/device routes |
| `/api/app-version` | Client update checks and version policy | Check public; management requires admin JWT |
| `/api/donation` | Donation details and scanner image | Read public; management requires admin JWT |
| `/api/handwritten-naam` | Handwritten Naam count, mantra, and admin user report | Mixed app and admin JWT routes |
| `/api/membership` | Plans, status, Razorpay order/verify, subscription admin | Mixed public/app and admin JWT routes |
| `/api/rewards` | Reward progress, claims, wallet, withdrawals, reward admin | Mixed app and admin JWT routes |
| `/api/referrals` | Referral settings, codes, applications, reports, moderation | Mixed app and admin JWT routes |
| `/api/games` | Score submission and per-game leaderboard | App/device routes |
| `/api/health` | Database-aware service health | Public |

### Frequently used endpoint examples

```text
POST /api/admin/login
GET  /api/admin/analytics

POST /api/naam-jap/auth-mobile
POST /api/naam-jap/sync
GET  /api/naam-jap/leaderboard?period=weekly&limit=200
GET  /api/naam-jap/stats

GET  /api/daily-quotes/today
GET  /api/home-content
GET  /api/membership/plans
GET  /api/rewards?deviceId=<device-id>
```

See the files in `routes/` for request bodies, query parameters, validation, and exact response payloads.

## Admin bootstrap and authentication

For a new database only:

```bash
curl -X POST http://localhost:5000/api/admin/setup
```

The route creates one bootstrap admin and refuses to recreate it when it already exists. Current bootstrap values are defined in `routes/adminRoutes.js`.

Then log in:

```bash
curl -X POST http://localhost:5000/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@shreejii.com","password":"<bootstrap-password>"}'
```

Use the returned token on protected routes:

```bash
curl http://localhost:5000/api/admin/me \
  -H 'Authorization: Bearer <token>'
```

**Production requirement:** change the initial password immediately, then protect or remove `/api/admin/setup`. Do not rely on source-controlled bootstrap credentials for a public environment.

## Data and integrations

### MongoDB

`config/db.js` caches the Mongoose connection globally so warm serverless invocations can reuse it. Models live in `models/`; there is no separate migration framework. Review model changes carefully and back up production data before migration scripts.

### Redis caching

`config/redis.js` exposes cache helpers and route middleware. Cacheable public reads currently include data such as daily quotes, home content, app versions, plans, presets, and referral settings. Mutation routes should invalidate related keys.

`X-Cache: HIT` or `X-Cache: MISS` is added when route caching is active.

### Cloudinary uploads

Cloudinary is used by profile, daily quote, home banner/sidebar, donation scanner, and preset-image flows. Upload requests use `multipart/form-data`; current JSON/form limits are suitable for small app assets, not large media files.

### Razorpay

The server creates membership orders and verifies Razorpay signatures. Only the key ID may be returned to clients. `RAZORPAY_KEY_SECRET` must remain server-side.

### Push notifications

The notification route targets stored Expo push tokens. Invalid or stale tokens are reported as failed sends; mobile registration/update flows are responsible for keeping tokens current.

## Directory structure

```text
server/
├── config/
│   ├── cloudinary.js
│   ├── db.js
│   ├── razorpay.js
│   └── redis.js
├── models/                    # Mongoose schemas
├── routes/                    # Express routers grouped by feature
├── utils/                     # One-off utility/migration scripts
├── .env.example
├── index.js                   # Middleware, route mounting, and app export
├── package.json
└── vercel.json
```

## Deployment to Vercel

1. Create a Vercel project whose root directory is `server`.
2. Add all required environment variables in the Vercel project settings.
3. Allow Vercel egress in MongoDB Atlas network access.
4. Deploy; `vercel.json` sends all routes to `index.js`.
5. Verify `/api/health`, admin login, one public read, upload, and payment test-mode flows.

Do not set production secrets in `.env.example` or commit a local `.env`.

## Security and production checklist

- Rotate credentials that were ever committed, logged, or shared.
- Use a unique high-entropy `JWT_SECRET` in every environment.
- Protect/remove the bootstrap endpoint after initial provisioning.
- Restrict the current wildcard CORS policy to dashboard/app origins where practical.
- Rate-limit login, mobile auth, sync, claim, referral, and withdrawal endpoints.
- Validate uploaded MIME type, dimensions, and size before public production use.
- Keep Razorpay in test mode until webhook/payment reconciliation is verified.
- Never log access tokens, payment secrets, complete user records, or private keys.
- Use a staging database for destructive or bulk changes.

## Validation

There is not yet an automated API test suite. At minimum run:

```bash
node --check index.js
find config models routes utils -name '*.js' -print0 | xargs -0 -n1 node --check
```

Then manually test the routes affected by your change against a non-production database.
