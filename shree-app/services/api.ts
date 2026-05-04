const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://shree-jii-server.vercel.app/api';

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

export async function fetchHomeContent(): Promise<HomeContentResponse | null> {
    try {
        const response = await fetch(`${API_BASE_URL}/home-content`);
        const data = await response.json();
        if (data.success && data.response) {
            return data.response;
        }
        return null;
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
        const response = await fetch(`${API_BASE_URL}/daily-quotes/today`);
        const data = await response.json();
        if (data.success && data.response) {
            return data.response;
        }
        return null;
    } catch {
        return null;
    }
}

export async function fetchRecentImages(limit: number = 7): Promise<DailyQuoteResponse[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/daily-quotes/recent?limit=${limit}`);
        const data = await response.json();
        if (data.success && data.response) {
            return data.response;
        }
        return [];
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
}

// Validate session - check if user still exists and is active
export async function validateSession(mobile: string, deviceId: string): Promise<{ valid: boolean; user?: NaamJapUser }> {
    try {
        const response = await fetch(`${API_BASE_URL}/naam-jap/validate-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mobile, deviceId }),
        });
        const data = await response.json();
        if (data.success && data.response) {
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
        const response = await fetch(`${API_BASE_URL}/naam-jap/auth-mobile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mobile, deviceId, pushToken: pushToken || undefined }),
        });
        return await response.json();
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
        const response = await fetch(`${API_BASE_URL}/naam-jap/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId, name, city, mobile, pushToken }),
        });
        return await response.json();
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
        const response = await fetch(`${API_BASE_URL}/naam-jap/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId, totalCount, totalMalas, todayCount, todayMalas }),
        });
        return await response.json();
    } catch {
        return { success: false };
    }
}

// Get leaderboard
export async function fetchLeaderboard(
    period: 'all' | 'daily' | 'weekly' | 'monthly' = 'all',
    limit: number = 200
): Promise<LeaderboardEntry[]> {
    try {
        const response = await fetch(
            `${API_BASE_URL}/naam-jap/leaderboard?period=${period}&limit=${limit}`
        );
        const data = await response.json();
        if (data.success && data.response) {
            return data.response;
        }
        return [];
    } catch {
        return [];
    }
}

// Get worldwide stats
export async function fetchNaamJapStats(): Promise<NaamJapStats | null> {
    try {
        const response = await fetch(`${API_BASE_URL}/naam-jap/stats`);
        const data = await response.json();
        if (data.success && data.response) {
            return data.response;
        }
        return null;
    } catch {
        return null;
    }
}

// Get user data + rank
export async function fetchUserData(deviceId: string): Promise<UserRankData | null> {
    try {
        const response = await fetch(`${API_BASE_URL}/naam-jap/user/${deviceId}`);
        const data = await response.json();
        if (data.success && data.response) {
            return data.response;
        }
        return null;
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
        const response = await fetch(`${API_BASE_URL}/naam-jap/user/${deviceId}/daily/${date}`);
        const data = await response.json();
        if (data.success && data.response) {
            return data.response;
        }
        return null;
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
        const response = await fetch(`${API_BASE_URL}/preset-images`);
        const data = await response.json();
        if (data.success && data.response) {
            return data.response;
        }
        return [];
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

export async function fetchMembershipStatus(deviceId: string): Promise<MembershipStatus> {
    try {
        const res = await fetch(`${API_BASE_URL}/membership/status/${deviceId}`);
        const data = await res.json();
        return data.success ? data.response : { isActive: false };
    } catch {
        return { isActive: false };
    }
}

// Returns null on network/server errors so callers can avoid clobbering a cached active state.
export async function fetchMembershipStatusSafe(deviceId: string): Promise<MembershipStatus | null> {
    try {
        const res = await fetch(`${API_BASE_URL}/membership/status/${deviceId}`);
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
): Promise<{ ok: boolean; isLifetime?: boolean; expiresAt?: string }> {
    try {
        const res = await fetch(`${API_BASE_URL}/membership/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ razorpay_order_id, razorpay_payment_id, razorpay_signature }),
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
    rewardAmount: number;
    type: 'lifetime' | 'daily';
    icon: string;
    isActive: boolean;
    sortOrder: number;
    currentJap: number;
    currentSteps: number;
    unlocked: boolean;
    claimed: boolean;
}

export interface RewardsListResponse {
    rewards: RewardServer[];
    isMember: boolean;
}

export async function fetchRewards(deviceId: string): Promise<RewardsListResponse | null> {
    try {
        const res = await fetch(`${API_BASE_URL}/rewards?deviceId=${encodeURIComponent(deviceId)}`);
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