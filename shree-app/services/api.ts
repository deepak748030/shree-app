export const API_BASE_URL =
    process.env.EXPO_PUBLIC_API_URL || 'https://shree-jii-server.vercel.app/api';

// ─────────────────────────────────────────────────────────────────────────────
// Shared request layer
//
//  • timeout     — a flaky network must never leave the UI spinning forever
//  • retry       — GETs retry once on a network error; writes never retry
//                  (a duplicated sync would corrupt counters)
//  • dedupe      — identical in-flight GETs share one promise
//  • small cache — home content, stats and presets are almost static; caching
//                  them makes tab switches instant and saves mobile data
//  • safe JSON   — HTML error pages / empty bodies never throw mid-render
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS || 12000);
const getCache = new Map<string, { at: number; ttl: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

async function rawFetch(url: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

export async function apiFetch(url: string, init: RequestInit = {}, timeoutMs?: number): Promise<Response> {
    const method = (init.method || 'GET').toUpperCase();
    const attempts = method === 'GET' || method === 'HEAD' ? 2 : 1;
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            const response = await rawFetch(url, init, timeoutMs);
            // Retry only on transient gateway/network failures.
            if (attempts > 1 && attempt < attempts && [502, 503, 504].includes(response.status)) {
                await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
                continue;
            }
            return response;
        } catch (error) {
            lastError = error;
            if (attempt < attempts) {
                await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
            }
        }
    }
    throw lastError instanceof Error ? lastError : new Error('Network request failed');
}

async function readJson<T>(response: Response): Promise<T | null> {
    try {
        const text = await response.text();
        if (!text) return null;
        return JSON.parse(text) as T;
    } catch {
        return null;
    }
}

interface JsonOptions {
    /** cache this GET for N ms (0 = no cache) */
    cacheTtlMs?: number;
    timeoutMs?: number;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
}

/** JSON request helper used by every read path in the app. */
export async function apiJson<T>(path: string, options: JsonOptions = {}): Promise<T | null> {
    const { cacheTtlMs = 0, timeoutMs, method = 'GET', body } = options;
    const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
    const cacheKey = method === 'GET' ? url : '';

    if (cacheKey && cacheTtlMs > 0) {
        const hit = getCache.get(cacheKey);
        if (hit && Date.now() - hit.at < hit.ttl) return hit.data as T;
    }
    if (cacheKey) {
        const existing = inflight.get(cacheKey);
        if (existing) return (await existing) as T | null;
    }

    const init: RequestInit = {
        method,
        headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
    };

    const promise = (async () => {
        const response = await apiFetch(url, init, timeoutMs);
        const data = await readJson<T>(response);
        return data;
    })();

    if (cacheKey) inflight.set(cacheKey, promise as Promise<unknown>);
    try {
        const data = await promise;
        if (cacheKey && cacheTtlMs > 0 && data !== null) {
            getCache.set(cacheKey, { at: Date.now(), ttl: cacheTtlMs, data });
        }
        return data;
    } finally {
        if (cacheKey) inflight.delete(cacheKey);
    }
}

/** Drop cached reads after a write (e.g. after claiming a reward). */
export function invalidateApiCache(prefix?: string) {
    if (!prefix) {
        getCache.clear();
        return;
    }
    for (const key of [...getCache.keys()]) {
        if (key.includes(prefix)) getCache.delete(key);
    }
}


// ============ HOME CONTENT APIs ============

export interface HomeContentResponse {
    _id: string;
    title_hi: string;
    title_en: string;
    subtitle_hi: string;
    subtitle_en: string;
    paragraphs_hi: string[];
    paragraphs_en: string[];
    bannerImages: string[];
    sidebarImage: string;
    updatedAt: string;
}

// ============ GAMES APIs ============

export interface GameLeaderboardEntry {
    rank: number;
    deviceId: string;
    name: string;
    city: string;
    profileImage: string;
    bestScore: number;
    playCount: number;
    updatedAt: string;
}

export interface GameLeaderboardResponse {
    leaderboard: GameLeaderboardEntry[];
    me: {
        rank: number | null;
        bestScore: number;
        lastScore: number;
        playCount: number;
    } | null;
}

export async function submitGameScore(deviceId: string, gameId: string, score: number): Promise<{ success: boolean; isBest?: boolean }> {
    try {
        const res = await fetch(`${API_BASE_URL}/games/score`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId, gameId, score }),
        });
        const data = await res.json();
        return { success: !!data.success, isBest: !!data.isBest };
    } catch {
        return { success: false };
    }
}

export async function fetchGameLeaderboard(gameId: string, deviceId?: string, limit = 50): Promise<GameLeaderboardResponse | null> {
    try {
        const q = new URLSearchParams({ limit: String(limit) });
        if (deviceId) q.set('deviceId', deviceId);
        const res = await fetch(`${API_BASE_URL}/games/${gameId}/leaderboard?${q.toString()}`);
        const data = await res.json();
        if (data.success && data.response) return data.response;
        return null;
    } catch {
        return null;
    }
}

export async function fetchHomeContent(): Promise<HomeContentResponse | null> {
    try {
        // Home content changes rarely: 60s cache + dedupe makes tab switches instant.
        const data = await apiJson<{ success: boolean; response: HomeContentResponse }>('/home-content', {
            cacheTtlMs: 60_000,
        });
        return data?.success && data.response ? data.response : null;
    } catch {
        return null;
    }
}

// ============ DAILY QUOTE APIs ============

export interface DailyQuoteResponse {
    _id: string;
    imageUrl: string;
    date: string;
    isActive: boolean;
}

export async function fetchTodayImage(): Promise<DailyQuoteResponse | null> {
    try {
        const data = await apiJson<{ success: boolean; response: DailyQuoteResponse }>('/daily-quotes/today', {
            cacheTtlMs: 60_000,
        });
        return data?.success && data.response ? data.response : null;
    } catch {
        return null;
    }
}

export async function fetchRecentImages(limit: number = 7): Promise<DailyQuoteResponse[]> {
    try {
        const data = await apiJson<{ success: boolean; response: DailyQuoteResponse[] }>(
            `/daily-quotes/recent?limit=${limit}`,
            { cacheTtlMs: 60_000 }
        );
        return data?.success && data.response ? data.response : [];
    } catch {
        return [];
    }
}

// ============ NAAM JAP APIs ============

export interface NaamJapUser {
    _id?: string;
    deviceId: string;
    mobile: string;
    name: string;
    city: string;
    profileImage?: string;
    totalCount: number;
    totalMalas: number;
    lastSyncAt: string;
}

export interface LeaderboardEntry {
    rank: number;
    name: string;
    city: string;
    malas: number;
    count: number;
}

export interface NaamJapStats {
    allTimeUsers: number;
    allTimeMalas: number;
    weeklyUsers: number;
    weeklyMalas: number;
    monthlyUsers: number;
    monthlyMalas: number;
}

export interface UserRankData {
    user: NaamJapUser;
    rank: number;
    totalUsers: number;
    highestMalaDay: number;
    recentLogs: { date: string; count: number; malas: number }[];
}

export interface SyncResponse {
    user: NaamJapUser;
    rank: number;
    totalUsers: number;
    /** IST date the server attributed this sync to */
    today?: string;
    serverTime?: string;
    /** monotonic realtime sequence for cheap change detection */
    version?: number;
}

// Validate session - check if user still exists and is active
export async function validateSession(mobile: string, deviceId: string): Promise<{ valid: boolean; user?: NaamJapUser }> {
    try {
        const data = await apiJson<{ success: boolean; response: NaamJapUser }>('/naam-jap/validate-session', {
            method: 'POST',
            body: { mobile, deviceId },
        });
        if (data?.success && data.response) {
            return { valid: true, user: data.response };
        }
        return { valid: false };
    } catch {
        // Network error - don't logout, keep cached session
        return { valid: true };
    }
}

// Auth by mobile number
export async function authByMobile(
    mobile: string,
    deviceId: string,
    pushToken?: string | null
): Promise<{ success: boolean; isNewUser?: boolean; response?: NaamJapUser | null; message?: string }> {
    try {
        const data = await apiJson<{ success: boolean; isNewUser?: boolean; response?: NaamJapUser | null; message?: string }>(
            '/naam-jap/auth-mobile',
            { method: 'POST', body: { mobile, deviceId, pushToken: pushToken || undefined } }
        );
        return data ?? { success: false, message: 'Empty response' };
    } catch {
        return { success: false, message: 'Network error' };
    }
}

// Register or update user info
export async function registerNaamJapUser(
    deviceId: string,
    name: string,
    city: string,
    mobile: string,
    pushToken?: string
): Promise<{ success: boolean; response?: any; message?: string }> {
    try {
        const data = await apiJson<{ success: boolean; response?: any; message?: string }>('/naam-jap/register', {
            method: 'POST',
            body: { deviceId, name, city, mobile, pushToken },
        });
        return data ?? { success: false };
    } catch {
        return { success: false };
    }
}

// Update profile (name + optional image)
export async function updateProfile(
    deviceId: string,
    name: string,
    imageUri?: string | null,
): Promise<{ success: boolean; response?: NaamJapUser; message?: string }> {
    try {
        const formData = new FormData();
        formData.append('deviceId', deviceId);
        formData.append('name', name);
        if (imageUri) {
            const filename = imageUri.split('/').pop() || `profile_${Date.now()}.jpg`;
            const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
            const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
            // @ts-ignore - RN FormData file
            formData.append('image', { uri: imageUri, name: filename, type: mime });
        }
        const response = await fetch(`${API_BASE_URL}/naam-jap/profile/update`, {
            method: 'POST',
            body: formData,
        });
        return await response.json();
    } catch {
        return { success: false, message: 'Network error' };
    }
}

// Sync count data to server
export async function syncNaamJapCount(
    deviceId: string,
    totalCount: number,
    totalMalas: number,
    todayCount: number,
    todayMalas: number
): Promise<{ success: boolean; response?: SyncResponse }> {
    try {
        const data = await apiJson<{ success: boolean; response?: SyncResponse }>('/naam-jap/sync', {
            method: 'POST',
            timeoutMs: 10_000,
            body: { deviceId, totalCount, totalMalas, todayCount, todayMalas },
        });
        return data ?? { success: false };
    } catch {
        return { success: false };
    }
}

/**
 * Ultra-cheap change detector (~200 bytes, no aggregation). The counter screen
 * polls this instead of the full profile when it wants to know whether another
 * device changed something.
 */
export async function fetchUserSnapshot(deviceId: string): Promise<{
    totalCount: number;
    totalMalas: number;
    lastSyncAt: string;
    version: number;
    today: string;
} | null> {
    try {
        const data = await apiJson<{ success: boolean; response: any }>(
            `/naam-jap/user/${encodeURIComponent(deviceId)}/snapshot`,
            { timeoutMs: 6000 }
        );
        return data?.success ? data.response : null;
    } catch {
        return null;
    }
}

// Get leaderboard
export async function fetchLeaderboard(
    period: 'all' | 'daily' | 'weekly' | 'monthly' = 'all',
    limit: number = 200
): Promise<LeaderboardEntry[]> {
    try {
        // 10s cache mirrors the server-side cache TTL — nobody sees a stale board.
        const data = await apiJson<{ success: boolean; response: LeaderboardEntry[] }>(
            `/naam-jap/leaderboard?period=${period}&limit=${limit}`,
            { cacheTtlMs: 10_000 }
        );
        return data?.success && data.response ? data.response : [];
    } catch {
        return [];
    }
}

// Get worldwide stats
export async function fetchNaamJapStats(): Promise<NaamJapStats | null> {
    try {
        const data = await apiJson<{ success: boolean; response: NaamJapStats }>('/naam-jap/stats', {
            cacheTtlMs: 30_000,
        });
        return data?.success && data.response ? data.response : null;
    } catch {
        return null;
    }
}

// Get user data + rank
export async function fetchUserData(deviceId: string): Promise<UserRankData | null> {
    try {
        const data = await apiJson<{ success: boolean; response: UserRankData }>(
            `/naam-jap/user/${encodeURIComponent(deviceId)}`
        );
        return data?.success && data.response ? data.response : null;
    } catch {
        return null;
    }
}

// Get user daily data for a specific date (returns 0 if no entry)
export async function fetchUserDailyData(
    deviceId: string,
    date: string
): Promise<{ dailyLog: { date: string; count: number; malas: number }; rank: number; totalUsers: number; user: NaamJapUser } | null> {
    try {
        const data = await apiJson<{
            success: boolean;
            response: { dailyLog: { date: string; count: number; malas: number }; rank: number; totalUsers: number; user: NaamJapUser };
        }>(`/naam-jap/user/${encodeURIComponent(deviceId)}/daily/${date}`);
        return data?.success && data.response ? data.response : null;
    } catch {
        return null;
    }
}

// ============ PRESET IMAGES APIs ============

export interface PresetImageData {
    _id: string;
    imageUrl: string;
    publicId: string;
    isActive: boolean;
    order: number;
}

export async function fetchPresetImages(): Promise<PresetImageData[]> {
    try {
        const data = await apiJson<{ success: boolean; response: PresetImageData[] }>('/preset-images', {
            cacheTtlMs: 5 * 60_000,
        });
        return data?.success && data.response ? data.response : [];
    } catch {
        return [];
    }
}

// ============ STEP TRACKER APIs ============

export async function syncStepData(
    deviceId: string,
    mobile: string,
    todaySteps: number,
    todayDistance: number,
    todayCalories: number,
    dailyGoal: number
): Promise<any> {
    try {
        const response = await fetch(`${API_BASE_URL}/step-tracker/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId, mobile, todaySteps, todayDistance, todayCalories, dailyGoal }),
        });
        return await response.json();
    } catch {
        return { success: false };
    }
}

export async function fetchStepData(deviceId: string): Promise<any> {
    try {
        const response = await fetch(`${API_BASE_URL}/step-tracker/user/${deviceId}`);
        const data = await response.json();
        if (data.success && data.response) {
            return data.response;
        }
        return null;
    } catch {
        return null;
    }
}

// ============ APP VERSION CHECK APIs ============

export interface AppVersionCheck {
    needsUpdate: boolean;
    isForceUpdate: boolean;
    requiredVersion: string;
    playStoreUrl: string;
    appStoreUrl: string;
    updateMessage_hi: string;
    updateMessage_en: string;
}

export async function checkAppVersion(currentVersion: string, platform: string = 'android'): Promise<AppVersionCheck | null> {
    try {
        const response = await fetch(
            `${API_BASE_URL}/app-version/check?platform=${platform}&currentVersion=${currentVersion}`
        );
        const data = await response.json();
        if (data.success && data.response) {
            return data.response;
        }
        return null;
    } catch {
        return null;
    }
}

// ============ DONATION APIs ============

export interface DonationSettingsResponse {
    upiId: string;
    accountNumber: string;
    ifscCode: string;
    accountHolderName: string;
    bankName: string;
    scannerImage: string;
    note_hi: string;
    note_en: string;
    isActive: boolean;
}

export async function fetchDonationSettings(): Promise<DonationSettingsResponse | null> {
    try {
        const response = await fetch(`${API_BASE_URL}/donation`);
        const data = await response.json();
        if (data.success && data.response) {
            return data.response;
        }
        return null;
    } catch {
        return null;
    }
}

// ============ HANDWRITTEN NAAM APIs ============

export interface HandwrittenNaamData {
    lifetimeCount: number;
    todayCount: number;
    selectedMantra: string;
}

export async function fetchHandwrittenNaam(deviceId: string): Promise<HandwrittenNaamData | null> {
    try {
        const response = await fetch(`${API_BASE_URL}/handwritten-naam/${deviceId}`);
        const data = await response.json();
        if (data.success && data.response) {
            return data.response;
        }
        return null;
    } catch {
        return null;
    }
}

export async function incrementHandwrittenNaam(
    deviceId: string,
    increment: number = 1,
    selectedMantra?: string
): Promise<HandwrittenNaamData | null> {
    try {
        const response = await fetch(`${API_BASE_URL}/handwritten-naam/increment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId, increment, selectedMantra }),
        });
        const data = await response.json();
        if (data.success && data.response) {
            return data.response;
        }
        return null;
    } catch {
        return null;
    }
}

export async function updateHandwrittenMantra(
    deviceId: string,
    selectedMantra: string
): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE_URL}/handwritten-naam/mantra`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId, selectedMantra }),
        });
        const data = await response.json();
        return !!data.success;
    } catch {
        return false;
    }
}

// ============ MEMBERSHIP APIs ============

export interface MembershipPlan {
    _id: string;
    name_hi: string;
    name_en: string;
    description_hi: string;
    description_en: string;
    price: number;
    durationMonths: number;
    isLifetime: boolean;
    isBestValue: boolean;
    sortOrder: number;
}

export interface MembershipStatus {
    isActive: boolean;
    planName_hi?: string;
    planName_en?: string;
    isLifetime?: boolean;
    expiresAt?: string;
    paidAt?: string;
}

export interface CreateOrderResponse {
    orderId: string;
    amount: number;
    currency: string;
    keyId: string;
    subscriptionId: string;
    plan: { name_hi: string; name_en: string; price: number };
}

export async function fetchMembershipPlans(): Promise<MembershipPlan[]> {
    try {
        const res = await fetch(`${API_BASE_URL}/membership/plans`);
        const data = await res.json();
        return data.success ? data.response : [];
    } catch {
        return [];
    }
}

export async function fetchMembershipStatus(deviceId: string, mobile?: string | null): Promise<MembershipStatus> {
    try {
        const qs = mobile ? `?mobile=${encodeURIComponent(mobile)}` : '';
        const res = await fetch(`${API_BASE_URL}/membership/status/${deviceId}${qs}`);
        const data = await res.json();
        return data.success ? data.response : { isActive: false };
    } catch {
        return { isActive: false };
    }
}

// Returns null on network/server errors so callers can avoid clobbering a cached active state.
export async function fetchMembershipStatusSafe(deviceId: string, mobile?: string | null): Promise<MembershipStatus | null> {
    try {
        const qs = mobile ? `?mobile=${encodeURIComponent(mobile)}` : '';
        const res = await fetch(`${API_BASE_URL}/membership/status/${deviceId}${qs}`);
        if (!res.ok) return null;
        const data = await res.json();
        if (data && data.success && data.response) return data.response as MembershipStatus;
        return null;
    } catch {
        return null;
    }
}

export async function createMembershipOrder(
    planId: string, deviceId: string, mobile?: string
): Promise<CreateOrderResponse | null> {
    try {
        const res = await fetch(`${API_BASE_URL}/membership/create-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId, deviceId, mobile }),
        });
        const data = await res.json();
        return data.success ? data.response : null;
    } catch {
        return null;
    }
}

export async function verifyMembershipPayment(
    razorpay_order_id: string,
    razorpay_payment_id: string,
    razorpay_signature: string,
    deviceId?: string,
    mobile?: string | null,
): Promise<{ ok: boolean; isLifetime?: boolean; expiresAt?: string }> {
    try {
        const res = await fetch(`${API_BASE_URL}/membership/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ razorpay_order_id, razorpay_payment_id, razorpay_signature, deviceId, mobile }),
        });
        const data = await res.json();
        return { ok: !!data.success, isLifetime: data.response?.isLifetime, expiresAt: data.response?.expiresAt };
    } catch {
        return { ok: false };
    }
}

// ============ REWARDS / WALLET APIs ============

export interface RewardServer {
    _id: string;
    title_hi: string;
    title_en: string;
    description_hi: string;
    description_en: string;
    japTarget: number;
    stepsTarget: number;
    handwrittenTarget: number;
    rewardAmount: number;
    type: 'lifetime' | 'daily';
    icon: string;
    isActive: boolean;
    sortOrder: number;
    currentJap: number;
    currentSteps: number;
    currentHandwritten: number;
    unlocked: boolean;
    claimed: boolean;
}

export interface RewardsListResponse {
    rewards: RewardServer[];
    isMember: boolean;
}

export async function fetchRewards(deviceId: string): Promise<RewardsListResponse | null> {
    try {
        const res = await fetch(`${API_BASE_URL}/rewards?deviceId=${encodeURIComponent(deviceId)}&t=${Date.now()}`, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
        });
        const data = await res.json();
        return data.success ? data.response : null;
    } catch {
        return null;
    }
}

export async function claimReward(
    deviceId: string,
    rewardId: string,
): Promise<{ ok: boolean; amount?: number; balance?: number; message?: string; code?: string }> {
    try {
        const res = await fetch(`${API_BASE_URL}/rewards/claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId, rewardId }),
        });
        const data = await res.json();
        return {
            ok: !!data.success,
            amount: data.response?.amount,
            balance: data.response?.balance,
            message: data.message,
            code: data.code,
        };
    } catch {
        return { ok: false, message: 'Network error' };
    }
}

export interface WalletInfo {
    deviceId: string;
    balance: number;
    totalEarned: number;
    totalWithdrawn: number;
}
export interface WalletTxn {
    _id: string;
    type: 'credit_reward' | 'debit_withdrawal' | 'debit_withdrawal_reverted';
    amount: number;
    rewardTitle?: string;
    note?: string;
    createdAt: string;
}

export async function fetchWallet(deviceId: string): Promise<{ wallet: WalletInfo; transactions: WalletTxn[]; isMember: boolean } | null> {
    try {
        const res = await fetch(`${API_BASE_URL}/rewards/wallet/${deviceId}`);
        const data = await res.json();
        return data.success ? data.response : null;
    } catch {
        return null;
    }
}

export async function requestWithdrawal(
    deviceId: string,
    amount: number,
    upiId: string,
): Promise<{ ok: boolean; balance?: number; message?: string; code?: string }> {
    try {
        const res = await fetch(`${API_BASE_URL}/rewards/wallet/withdraw`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId, amount, upiId }),
        });
        const data = await res.json();
        return { ok: !!data.success, balance: data.response?.balance, message: data.message, code: data.code };
    } catch {
        return { ok: false, message: 'Network error' };
    }
}

export interface WithdrawalEntry {
    _id: string;
    amount: number;
    upiId: string;
    status: 'pending' | 'approved' | 'paid' | 'rejected';
    adminNote?: string;
    createdAt: string;
    paidAt?: string | null;
}

export async function fetchUserWithdrawals(deviceId: string): Promise<WithdrawalEntry[]> {
    try {
        const res = await fetch(`${API_BASE_URL}/rewards/wallet/${deviceId}/withdrawals`);
        const data = await res.json();
        return data.success ? data.response : [];
    } catch {
        return [];
    }
}
// ============ REFERRAL APIs ============

export interface ReferralMilestone {
    count: number;
    rewardAmount: number;
    title_hi: string;
    title_en: string;
    description_hi: string;
    description_en: string;
    isActive: boolean;
}

export interface ReferralSettingsPublic {
    isEnabled: boolean;
    referrerBonus: number;
    refereeBonus: number;
    eligibility: 'members_only' | 'non_members_only' | 'both';
    title_hi: string;
    title_en: string;
    description_hi: string;
    description_en: string;
    howItWorks_hi: string;
    howItWorks_en: string;
    shareMessage_hi: string;
    shareMessage_en: string;
    milestones: ReferralMilestone[];
}

export interface MyReferralCode {
    referralCode: string;
    usageCount: number;
    totalEarned: number;
    hasAppliedCode: boolean;
    appliedCode: string | null;
    claimedMilestones: number[];
}

export interface ApplyReferralResult {
    success: boolean;
    credited?: boolean;
    referrerBonus?: number;
    refereeBonus?: number;
    message?: string;
    reason?: string;
}

export async function fetchReferralSettings(): Promise<ReferralSettingsPublic | null> {
    try {
        const res = await fetch(`${API_BASE_URL}/referrals/settings`);
        const data = await res.json();
        return data.success ? data.response : null;
    } catch {
        return null;
    }
}

export async function fetchMyReferralCode(deviceId: string): Promise<MyReferralCode | null> {
    try {
        const res = await fetch(`${API_BASE_URL}/referrals/my-code/${deviceId}`);
        const data = await res.json();
        return data.success ? data.response : null;
    } catch {
        return null;
    }
}

export async function applyReferralCode(
    deviceId: string,
    referralCode: string,
    mobile?: string,
    name?: string,
): Promise<ApplyReferralResult> {
    try {
        const res = await fetch(`${API_BASE_URL}/referrals/apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId, referralCode, mobile, name }),
        });
        const data = await res.json();
        return {
            success: !!data.success,
            credited: data.response?.credited,
            referrerBonus: data.response?.referrerBonus,
            refereeBonus: data.response?.refereeBonus,
            message: data.message || data.response?.message,
            reason: data.response?.reason,
        };
    } catch {
        return { success: false, message: 'Network error' };
    }
}
