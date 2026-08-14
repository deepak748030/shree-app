# Shree Ji Platform & Admin Dashboard

Shree Ji is a bilingual spiritual platform built around **Naam Jap**, mala counting, handwritten Naam practice, devotional content, rewards, memberships, and community leaderboards.

This repository contains three connected applications:

| Project | Location | Technology | Purpose |
| --- | --- | --- | --- |
| Admin dashboard | `/` | React, TypeScript, Vite, Tailwind CSS | Manage content, users, plans, rewards, referrals, and app settings |
| API server | [`server/`](server/) | Node.js, Express, MongoDB | Shared API for the mobile app and dashboard |
| Mobile app | [`shree-app/`](shree-app/) | Expo, React Native, Expo Router | Android, iOS, and web client |

> **Terminology:** user-facing copy uses **Jap** in English and **जप** in Hindi. Existing API paths such as `/api/naam-jap` are stable contracts and should not be renamed without a migration.

## Architecture

```text
┌──────────────────────┐       ┌─────────────────────────┐
│ Expo mobile app      │──────▶│ Express API             │
│ Android / iOS / Web  │       │ /api/*                  │
└──────────────────────┘       │                         │
                               │ MongoDB · Cloudinary    │
┌──────────────────────┐       │ Razorpay · Upstash      │
│ React admin dashboard│──────▶│ Expo Push Service       │
│ Vite web app         │       └─────────────────────────┘
└──────────────────────┘
```

## Main features

### Mobile app

- Mobile-number onboarding and device-linked profile
- Naam Jap counter, mala totals, sync, rank, and passbook
- Daily, weekly, monthly, and all-time leaderboards
- Handwritten Naam practice and progress tracking
- Daily quote, configurable home content, and image presets
- Step tracker, games, rewards, wallet, and withdrawals
- Referral program and share flow
- Membership checkout through Razorpay
- Push notifications and forced app updates
- Hindi/English copy and multiple themes

### Admin dashboard

- Secure JWT-based admin login
- Platform analytics and Naam Jap user monitoring
- Daily quote and home-content management
- Push notification composer
- Preset image, donation, and app-version settings
- Membership plan and subscription management
- Handwritten Naam analytics
- Reward, withdrawal, and referral administration
- Public privacy policy, terms, and account-deletion pages

## Prerequisites

- [Node.js](https://nodejs.org/) 20 LTS or newer
- npm 10 or newer
- MongoDB (local instance or MongoDB Atlas)
- An Expo-compatible Android/iOS device or emulator for native app development
- Cloudinary and Razorpay accounts for upload/payment features
- Optional: Upstash Redis for API response caching

## Quick start: complete local stack

### 1. Install dependencies

```bash
# Admin dashboard
npm install

# API server
npm --prefix server install

# Expo app
npm --prefix shree-app install
```

### 2. Create local environment files

```bash
cp .env.example .env
cp server/.env.example server/.env
cp shree-app/.env.example shree-app/.env
```

At minimum, set a valid `MONGODB_URI` and a long random `JWT_SECRET` in `server/.env`.

For a physical phone, `localhost` means the phone itself. Set `EXPO_PUBLIC_API_URL` to a URL the phone can reach, for example:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.20:5000/api
```

### 3. Start each project in a separate terminal

```bash
# Terminal 1 — API at http://localhost:5000
cd server && npm run dev

# Terminal 2 — dashboard at http://localhost:8080
npm run dev

# Terminal 3 — Expo development server
cd shree-app && npm run dev
```

Check the API with:

```bash
curl http://localhost:5000/api/health
```

### 4. Bootstrap the first admin

On a fresh database, call the setup endpoint once:

```bash
curl -X POST http://localhost:5000/api/admin/setup
```

The current development bootstrap account is defined in `server/routes/adminRoutes.js`. Log in and change its password immediately from **Settings**. Before a public deployment, protect or remove the setup route and replace the default credentials.

## Admin dashboard setup

### Environment

The root `.env` controls the dashboard:

| Variable | Required | Example | Description |
| --- | --- | --- | --- |
| `VITE_API_URL` | Yes | `http://localhost:5000/api` | Complete API base URL, including `/api` |

Vite exposes variables prefixed with `VITE_` to browser code. Never place server secrets in the dashboard environment.

### Dashboard scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Vite on port `8080` |
| `npm run build` | Type-check and create a production build in `dist/` |
| `npm run build:dev` | Build using Vite's development mode |
| `npm run lint` | Run ESLint with zero warnings allowed |
| `npm run preview` | Preview the production build locally |

### Dashboard routes

Public routes:

- `/login`
- `/privacy-policy`
- `/terms-conditions`
- `/delete-account`

Authenticated routes:

- `/` — analytics overview
- `/home-content`, `/daily-quotes`, `/preset-images`
- `/naam-jap-users`, `/handwritten-naam`
- `/push-notifications`, `/app-version`, `/donation-settings`
- `/membership-plans`, `/subscriptions`
- `/rewards`, `/withdrawals`, `/referrals`, `/settings`

Admin JWT and profile data are stored in browser `localStorage`. API `401` and `403` responses clear the session and return the user to the login screen.

## Project structure

```text
.
├── src/                       # Admin dashboard source
│   ├── components/            # Layout and route guards
│   ├── context/               # Dashboard authentication
│   ├── lib/                   # Axios API client and utilities
│   └── pages/                 # Dashboard and public pages
├── server/                    # Express API (see server/README.md)
├── shree-app/                 # Expo app (see shree-app/README.md)
├── .env.example               # Dashboard environment template
├── vite.config.ts             # Dashboard Vite configuration
└── vercel.json                # Dashboard SPA deployment rules
```

## Validation before opening a pull request

Run checks in all three projects:

```bash
npm run lint
npm run build
npm --prefix shree-app run lint
npm --prefix shree-app run typecheck
npm --prefix shree-app run build
node --check server/index.js
```

The API currently has no automated test script, so exercise `/api/health`, authentication, and any modified endpoint manually against a non-production database.

## Deployment overview

### Dashboard on Vercel

- Project root: repository root
- Build command: `npm run build`
- Output directory: `dist`
- Environment: `VITE_API_URL=https://your-api.example.com/api`

`vercel.json` contains the SPA rewrite needed for React Router deep links.

### API on Vercel

Deploy `server/` as its own Vercel project and configure every required server environment variable. The Express app is exported from `server/index.js`; `server/vercel.json` routes requests to that function.

### Mobile app with EAS

Build from `shree-app/` after setting production Expo environment variables and native service files. See [`shree-app/README.md`](shree-app/README.md) for native run and EAS commands.

## Security checklist

- Never commit `.env`, private keys, service-account JSON, database URLs, or payment secrets.
- Use separate MongoDB, Cloudinary, Razorpay, and Redis credentials for development and production.
- Rotate any credential that has ever been committed or shared publicly; deleting it from the latest commit is not sufficient.
- Replace the bootstrap admin password and restrict `/api/admin/setup` before production.
- Use a long random `JWT_SECRET` and HTTPS for all deployed clients.
- Restrict CORS to trusted origins before exposing the production API.
- Back up MongoDB before schema or bulk-data changes.

## More documentation

- [API server guide](server/README.md)
- [Expo mobile app guide](shree-app/README.md)
