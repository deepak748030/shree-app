const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://your-server-url.vercel.app/api';

// ============ HOME CONTENT APIs ============

export interface HomeContentResponse {
    _id: string;
    title_hi: string;
    title_en: string;
    subtitle_hi: string;
    subtitle_en: string;
    paragraphs_hi: string[];
    paragraphs_en: string[];
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
    name: string;
    city: string;
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

// Register or update user info
export async function registerNaamJapUser(
    deviceId: string,
    name: string,
    city: string,
    pushToken?: string
): Promise<{ success: boolean; response?: any }> {
    try {
        const response = await fetch(`${API_BASE_URL}/naam-jap/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId, name, city, pushToken }),
        });
        return await response.json();
    } catch {
        return { success: false };
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
