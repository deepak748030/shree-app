
## Referral System — Plan

Add a referral feature so when a new user enters another user's referral code (e.g. Mohan enters Deepak's code), the referrer gets a bonus credited to their Wallet. Admin can fully configure the system from the dashboard, and admin can see all referral activity.

---

### 1. Server (Express + MongoDB)

**New Models**

`server/models/ReferralSettings.js` (singleton document)
- `isEnabled` (bool)
- `referrerBonus` (number, INR) — bonus given to the person who referred
- `refereeBonus` (number, INR) — optional bonus for the new user who entered code
- `eligibility` ('members_only' | 'non_members_only' | 'both') — who can earn referral bonus
- `title_hi`, `title_en` — heading shown on Share App screen
- `description_hi`, `description_en` — body text
- `howItWorks_hi`, `howItWorks_en` — instructions
- `minActionRequired` ('none' | 'first_jap' | 'membership_purchase') — when bonus credits

`server/models/Referral.js`
- `referralCode` (string, unique, indexed) — auto-generated per user (e.g. SHREE-XXXX)
- `ownerDeviceId` (string, indexed) — who owns this code
- `ownerMobile` (string)
- `usageCount` (number)

`server/models/ReferralUse.js`
- `referralCode` (string, indexed)
- `referrerDeviceId` (string, indexed)
- `refereeDeviceId` (string, unique, indexed) — one referral per new device
- `refereeMobile` (string)
- `status` ('pending' | 'credited' | 'rejected')
- `bonusCredited` (number)
- `creditedAt` (date)
- `note` (string)

**New Routes** — `server/routes/referralRoutes.js` mounted at `/api/referrals`

Public:
- `GET  /settings` — current public-facing settings (text + enabled state)
- `GET  /my-code/:deviceId` — get/create the user's own referral code + stats (uses count, total earned)
- `POST /apply` — body: `{ deviceId, mobile, referralCode }` — validates code, creates ReferralUse, credits referrer's Wallet (respecting eligibility + minActionRequired), creates WalletTransaction with new type `credit_referral`
- `GET  /my-referrals/:deviceId` — list of people who used my code

Admin (JWT protected):
- `GET  /admin/settings`
- `PUT  /admin/settings`
- `GET  /admin/list?status=&page=` — all referral uses with pagination + filter
- `GET  /admin/stats` — totals (codes issued, used, bonus paid)
- `POST /admin/uses/:id/action` — manual approve/reject/recredit

**WalletTransaction model** — add `'credit_referral'` to the enum and a `referralUseId` reference field.

**`server/index.js`** — register the new route file.

---

### 2. Admin Dashboard (`src/`)

New page: `src/pages/ReferralPage.tsx`

Two tabs:
1. **Settings** — form to edit:
   - Enable/disable toggle
   - Eligibility radio (Members only / Non-members only / Both)
   - Min action required
   - Referrer bonus + referee bonus (INR)
   - Title / description / how-it-works (Hindi + English)
2. **Referral History** — table of `ReferralUse` with referrer device, referee device, mobile, code, status, bonus, date, and approve/reject buttons.

Add to `src/App.tsx` routes and to `src/components/DashboardLayout.tsx` sidebar nav (with a Gift icon).

---

### 3. Mobile App (`shree-app/`)

**`shree-app/services/api.ts`** — add helpers:
- `referralAPI.getSettings()`
- `referralAPI.getMyCode(deviceId)`
- `referralAPI.apply({ deviceId, mobile, referralCode })`
- `referralAPI.getMyReferrals(deviceId)`

**`shree-app/app/share-app.tsx`** — extend the existing Share App screen (since the user said "yahi option de dena"):
- Show user's own referral code prominently with a Copy button
- Show admin-configured title / description / how-it-works
- "Have a referral code?" input + Apply button (only if user hasn't already applied one)
- Show stats: "X friends used your code · ₹Y earned"
- Update share message to include the user's referral code so recipients can paste it

**`shree-app/constants/translations.ts`** — add Hindi + English keys for new labels (input placeholder, apply button, success/error toasts, stats labels). Server-driven text (title/description) is shown directly from the API response.

**Eligibility enforcement** — `apply` endpoint checks the referrer's membership status against `eligibility` setting before crediting; if not eligible, the use is logged with status `rejected` and a clear message returned.

---

### Technical details

- Referral code generation: `SHREE-` + 6 uppercase alphanumeric chars; collision-checked on insert.
- A device can apply at most one referral code (enforced by unique index on `refereeDeviceId`).
- A user cannot apply their own code (validated server-side).
- Wallet credit is atomic: `findOneAndUpdate` with `$inc` + create `WalletTransaction` (type `credit_referral`).
- All admin endpoints reuse the existing `authMiddleware` pattern from `rewardRoutes.js`.
- Caching headers `no-store` on public GETs to match existing pattern.

### Files to create
- `server/models/ReferralSettings.js`
- `server/models/Referral.js`
- `server/models/ReferralUse.js`
- `server/routes/referralRoutes.js`
- `src/pages/ReferralPage.tsx`

### Files to edit
- `server/models/WalletTransaction.js` (enum + field)
- `server/index.js` (register route)
- `src/App.tsx` (route)
- `src/components/DashboardLayout.tsx` (nav item)
- `src/lib/api.ts` (admin API methods)
- `shree-app/services/api.ts` (referral helpers)
- `shree-app/app/share-app.tsx` (UI for code, apply input, stats)
- `shree-app/constants/translations.ts` (keys)
