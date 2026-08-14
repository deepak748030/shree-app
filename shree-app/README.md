# Shree Ji Mobile App

Bilingual Expo/React Native client for the Shree Ji spiritual platform. The app supports Android, iOS, and static web export and connects to the Shree Ji Express API.

User-facing terminology is standardized as **Jap** in English and **जप** in Hindi.

## Features

- Hindi/English language selection and persistent theme preferences
- Mobile-number login, profile editing, and account logout/deletion flow
- Naam Jap counter with haptics, sound options, malas, daily logs, and sync
- Personal rank, worldwide analytics, passbook, and leaderboards
- Handwritten Naam practice with today/lifetime progress
- Daily quote and remotely managed home content
- Step tracker using device pedometer permissions
- 2048, Radha Jap, and Bubble Smash games with score leaderboards
- Membership plans and Razorpay checkout
- Rewards, wallet balance, withdrawals, and referrals
- Donation information, sharing, and devotional information screens
- Push notifications and server-controlled forced updates
- Android, iOS, and web targets through Expo

## Technology

- Expo SDK 54
- React 19 and React Native 0.81
- Expo Router 6 with file-based navigation
- TypeScript
- AsyncStorage for local persistence
- Expo Notifications, Sensors, Audio, Haptics, Image Picker, and Sharing
- React Native Reanimated and Gesture Handler
- Zustand and Supabase packages are installed for supporting app capabilities

## Prerequisites

- Node.js 20 LTS or newer
- npm 10 or newer
- Android Studio/emulator, Xcode/iOS Simulator, or the Expo Go app
- Running Shree Ji API or access to a deployed API
- EAS account for cloud builds

## Local setup

```bash
cd shree-app
npm install
cp .env.example .env
```

Set the API base URL, including the `/api` suffix:

```dotenv
EXPO_PUBLIC_API_URL=http://localhost:5000/api
```

Then start Expo:

```bash
npm run dev
```

From the Expo terminal UI, open Android, iOS, or web. You can also start a target directly:

```bash
npm run dev -- --android
npm run dev -- --ios
npm run dev -- --web
```

## Connecting a phone or emulator to the local API

The API URL is compiled into the client as a public Expo variable.

| Client | Typical local API URL |
| --- | --- |
| iOS Simulator | `http://localhost:5000/api` |
| Android Emulator | `http://10.0.2.2:5000/api` |
| Physical phone on same Wi-Fi | `http://<computer-lan-ip>:5000/api` |
| Production build | `https://your-api.example.com/api` |

For a physical device, start the API on an interface reachable from your LAN and ensure the firewall allows port `5000`. `localhost` on the phone does not point to your development computer.

If environment values change, stop and restart Expo with a cleared cache:

```bash
npx expo start --clear
```

`EXPO_PUBLIC_*` values are visible in the built application. Never put JWT secrets, payment secrets, database credentials, service-account keys, or other private data in them.

## App flow and navigation

At startup, the root layout:

1. Loads the animated splash and stored language/theme.
2. Checks the current app version against the API.
3. Blocks on a mandatory update when configured by the dashboard.
4. Requests notification and pedometer permissions.
5. Shows language selection for first-time users.
6. Shows mobile authentication when there is no valid session.
7. Opens the tab application after session validation.

Main tabs:

- Home
- Leaderboard
- Rewards
- Settings

Stack screens include:

- Naam Jap counter and analytics sheets
- Handwritten Naam
- Daily quote and Shree information
- Membership, wallet, donation, and referral/share flows
- Step tracker
- Profile, language, theme, privacy, and terms
- 2048, Radha Jap, and Bubble Smash games

Routes are files under `app/`; add a screen by creating a route file and registering special presentation options in `app/_layout.tsx` when needed.

## Project structure

```text
shree-app/
├── app/                        # Expo Router routes and tab layout
│   └── (tabs)/                 # Home, leaderboard, rewards, settings
├── assets/
│   ├── images/                 # Icons, logo, and bundled images
│   └── sounds/                 # Counter/game audio
├── components/
│   ├── home/                   # Home dashboard cards
│   ├── naam-jap/               # Counter sheets, menu, and user modal
│   └── ui/                     # Shared UI primitives
├── constants/                  # Theme values and Hindi/English copy
├── contexts/                   # Auth, language, and app theme providers
├── hooks/                      # Counter, sync, notifications, and step logic
├── services/api.ts             # Typed fetch helpers and API URL
├── app.json                    # Expo app and native configuration
├── eas.json                    # EAS production profile
├── .env.example
└── package.json
```

## Local persistence and sync

The app uses AsyncStorage for authentication, language, theme, device identity, counters, and feature caches. Naam Jap and related progress are synchronized through device-based API routes.

When changing storage keys:

- preserve backward compatibility where possible;
- add a small migration for renamed keys;
- do not clear all AsyncStorage during normal logout;
- test upgrade behavior with data from the previous app version.

The existing logout intentionally removes authentication keys while retaining device-bound state such as preferences and membership/wallet caches.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Expo development server with telemetry disabled |
| `npm run lint` | Run Expo ESLint checks |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm run build` | Export a static web build to `dist/` |

Recommended validation:

```bash
npm run lint
npm run typecheck
npm run build
```

Also test at least one native target; a successful web export does not validate native permissions, notifications, sensors, payment WebViews, or file handling.

## Native configuration

Important values in `app.json`:

| Setting | Value |
| --- | --- |
| App name | `श्री जी` |
| Slug | `shree-jii` |
| Android package | `com.shreejii.app` |
| iOS bundle identifier | `com.shreejii.app` |
| Orientation | Portrait |
| Web output | Static |

Configured plugins include Expo Router, Sensors, Notifications, Splash Screen, Web Browser, Audio, Font, and Asset.

### Permissions

The app may request:

- activity recognition/body sensors for the step tracker;
- notifications for reminders and admin broadcasts;
- gallery access when a user selects/uploads an image;
- camera access where camera-based selection is used.

Keep permission prompts aligned with actual behavior and update store privacy disclosures whenever data collection changes.

### Firebase/Google services

Android notification configuration uses `google-services.json`. This client configuration file is different from a Firebase Admin service-account key.

- Keep `google-services.json` appropriate to the selected Firebase project.
- Never place Firebase Admin SDK service-account JSON in the mobile bundle.
- Store server credentials only in a protected backend/CI secret store.
- Rotate and remove any private key that was ever committed.

## EAS builds

Authenticate and inspect the project:

```bash
npx eas-cli login
npx eas-cli build:configure
```

Create the configured Android production build:

```bash
npx eas-cli build --platform android --profile production
```

For iOS, add an iOS profile/credentials as required and run:

```bash
npx eas-cli build --platform ios --profile production
```

Before a release:

1. Update `version` and Android `versionCode` according to the selected EAS version policy.
2. Configure production `EXPO_PUBLIC_API_URL` in the EAS environment.
3. Confirm package/bundle IDs and notification credentials.
4. Run lint, typecheck, web export, and native smoke tests.
5. Test mobile auth, counter sync, payment test mode, notifications, and force-update behavior.
6. Configure the matching minimum/latest version in the admin dashboard only after the store build is available.

## Static web deployment

```bash
npm run build
```

The export is written to `dist/`. `vercel.json` contains an SPA rewrite for routes. Configure `EXPO_PUBLIC_API_URL` in the build environment before deploying.

Native-only functionality may be unavailable or behave differently on web; test the actual deployment rather than relying only on the Expo dev server.

## Translation guidelines

All shared app copy lives in `constants/translations.ts`.

- Add every new key to both `hi` and `en` objects.
- Access copy through `useLanguage().t(...)` instead of hard-coding screen strings.
- Use **Naam Jap / Jap** in English and **नाम जप / जप** in Hindi.
- Keep route names, API paths, storage keys, and database fields stable even when display copy changes.
- Check home cards, counter sheets, leaderboards, rewards, settings, notifications, and policy pages after copy edits.

## Troubleshooting

### The app still calls the deployed API

Confirm `.env` exists inside `shree-app/`, includes `EXPO_PUBLIC_API_URL`, and restart with `npx expo start --clear`.

### A physical phone cannot reach the API

Use the computer's LAN IP rather than `localhost`, keep both devices on the same network, and check the OS firewall. For remote development, use an HTTPS-accessible development API.

### Metro has stale modules or copy

```bash
rm -rf .expo
npx expo start --clear
```

### Notifications do not arrive

Use a physical device where required, grant permission, verify a valid Expo push token reached the server, and confirm Android/iOS notification credentials for the build profile.

### Step count stays unavailable

Use a device with supported pedometer hardware, grant activity-recognition permission, and test a native build. Browser and some simulators do not expose real step data.

### Razorpay checkout fails

Verify API connectivity, test-mode key pairing, membership plan data, order creation, signature verification, and WebView behavior on the target platform. Never embed `RAZORPAY_KEY_SECRET` in the app.
