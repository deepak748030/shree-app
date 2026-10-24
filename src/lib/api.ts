import axios from 'axios'

/**
 * Base URL resolution
 *  - `VITE_API_URL` wins when set (production / custom deployments)
 *  - otherwise a relative `/api` is used, which the Vite dev server proxies to
 *    the local API. That keeps the dashboard same-origin in dev and previews
 *    (no CORS, no localhost URLs leaking into the browser).
 */
export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '/api'

const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 20000)

const api = axios.create({
    baseURL: API_URL,
    timeout: REQUEST_TIMEOUT_MS,
    headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
    },
    // Keep connections warm; the browser reuses them for subsequent calls.
    transitional: { clarifyTimeoutError: true },
})

// Add auth token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('admin_token')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

// Retry idempotent requests once on a transient network failure. Never retries
// POST/PUT/DELETE, because a duplicate write is worse than a visible error.
api.interceptors.response.use(undefined, async (error) => {
    const config = error?.config as (typeof error.config & { __retried?: boolean }) | undefined
    const method = (config?.method || 'get').toLowerCase()
    const isNetworkError = !error.response && !!config
    const isTimeout = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'

    if (config && !config.__retried && (method === 'get' || method === 'head') && (isNetworkError || isTimeout)) {
        config.__retried = true
        await new Promise((resolve) => setTimeout(resolve, 350))
        return api(config)
    }
    return Promise.reject(error)
})

// Handle auth errors - auto logout on 401/403
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
            localStorage.removeItem('admin_token')
            localStorage.removeItem('admin_user')
            sessionStorage.clear()
            // Redirect to login if not already there
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login'
            }
        }
        return Promise.reject(error)
    }
)

export interface Admin {
    _id: string
    name: string
    email: string
    avatar: string
    role: string
}

export interface DashboardAnalytics {
    naamJap: {
        totalUsers: number
        totalMalas: number
        totalCount: number
        todayActiveUsers: number
        newUsersThisWeek: number
        // additive fields from the optimised analytics service
        yesterdayActiveUsers?: number
        newUsersToday?: number
        activeMilestoneUsers?: number
        todayMalas?: number
        todayCount?: number
        last7DaysMalas?: number
        dayOverDayTrend?: number | null
        avgMalasPerActiveUser?: number
    }
    dailyQuotes: {
        total: number
        active: number
    }
    topUsers: {
        rank: number
        name: string
        city: string
        malas: number
        count: number
        profileImage?: string
    }[]
    dailyActivity: {
        name: string
        malas: number
        users: number
        count: number
        date?: string
    }[]
    membership?: {
        activeMembers: number
        paidSubscriptions: number
        lifetimeMembers: number
        revenue: number
        revenueThisMonth: number
    }
    money?: {
        pendingWithdrawals: { count: number; amount: number }
        paidWithdrawals: { count: number; amount: number }
        rejectedWithdrawals: { count: number; amount: number }
        wallet: { users: number; balance: number; totalEarned: number; totalWithdrawn: number }
        rewardClaims: number
        handwritten: { users: number; lifetimeCount: number }
    }
    generatedAt?: string
    today?: string
    source?: 'memory' | 'shared' | 'fresh'
    cachedForMs?: number
}

// Auth APIs
export const adminLogin = async (email: string, password: string) => {
    const response = await api.post('/admin/login', { email, password })
    return response.data
}

export const getAdminProfile = async () => {
    const response = await api.get('/admin/me')
    return response.data
}

export const setupAdmin = async () => {
    const response = await api.post('/admin/setup')
    return response.data
}

// Dashboard APIs
export const getDashboardAnalytics = async (force = false) => {
    const response = await api.get('/admin/analytics', { params: force ? { force: 1 } : undefined })
    return response.data as { success: boolean; response: DashboardAnalytics }
}

/** Latency profile (p50/p95 per route) + cache/hub stats. */
export const getSystemMetrics = async () => {
    const response = await api.get('/system/metrics')
    return response.data as {
        success: boolean
        response: {
            uptimeSeconds: number
            memory: { rssMb: number; heapUsedMb: number }
            totals: { requests: number; avgMs: number }
            slowest: { route: string; count: number; avgMs: number; p50Ms: number; p95Ms: number; maxMs: number; errors: number }[]
        }
    }
}

/** Drop a cache namespace after a manual data fix. */
export const flushCache = async (namespaces?: string[]) => {
    const response = await api.post('/system/cache/flush', { namespaces: namespaces?.join(',') })
    return response.data
}

// Admin Settings APIs
export interface AdminActivity {
    admin: Admin
    activity: {
        lastLogin: string
        accountCreated: string
        stats: {
            totalOrders: number
            totalUsers: number
            totalCoupons: number
            totalCategories: number
            totalBanners: number
            totalDeliveryPartners: number
        }
    }
}

export const updateAdminProfile = async (data: { name?: string; email?: string; avatar?: string }) => {
    const response = await api.put('/admin/profile', data)
    return response.data
}

export const updateAdminPassword = async (currentPassword: string, newPassword: string) => {
    const response = await api.put('/admin/password', { currentPassword, newPassword })
    return response.data
}

export const getAdminActivity = async () => {
    const response = await api.get('/admin/activity')
    return response.data
}

// Daily Quotes APIs (image-only)
export interface DailyQuoteData {
    _id: string
    imageUrl: string
    date: string
    isActive: boolean
    createdAt: string
    updatedAt: string
}

// Home Content APIs
export interface HomeContentData {
    _id?: string
    title_hi: string
    title_en: string
    subtitle_hi: string
    subtitle_en: string
    paragraphs_hi: string[]
    paragraphs_en: string[]
    updatedAt?: string
}

export const getHomeContent = async () => {
    const response = await api.get('/home-content')
    return response.data as { success: boolean; response: HomeContentData | null }
}

export const saveHomeContent = async (data: Omit<HomeContentData, '_id' | 'updatedAt'>) => {
    const response = await api.post('/home-content', data)
    return response.data
}

export const getDailyQuotes = async (page: number = 1) => {
    const response = await api.get('/daily-quotes', { params: { page, limit: 20 } })
    return response.data as {
        success: boolean
        response: {
            quotes: DailyQuoteData[]
            pagination: { page: number; limit: number; total: number; pages: number }
        }
    }
}

export const uploadDailyQuoteImage = async (file: File) => {
    const formData = new FormData()
    formData.append('image', file)
    const response = await api.post('/daily-quotes/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data as { success: boolean; response: { imageUrl: string; publicId: string } }
}

export const createDailyQuote = async (data: { imageUrl: string; date: string }) => {
    const response = await api.post('/daily-quotes', data)
    return response.data
}

export const updateDailyQuote = async (id: string, data: Partial<DailyQuoteData>) => {
    const response = await api.put(`/daily-quotes/${id}`, data)
    return response.data
}

export const deleteDailyQuote = async (id: string) => {
    const response = await api.delete(`/daily-quotes/${id}`)
    return response.data
}

export const getTodayQuote = async () => {
    const response = await api.get('/daily-quotes/today')
    return response.data as { success: boolean; response: DailyQuoteData | null }
}

// Naam Jap Admin APIs
export interface NaamJapUserData {
    _id: string
    name: string
    city: string
    mobile?: string
    profileImage?: string
    totalCount: number
    totalMalas: number
    lastSyncAt: string
    createdAt: string
}

export interface NaamJapAdminStats {
    totalUsers: number
    totalMalas: number
    totalCount: number
    todayActiveUsers: number
    newUsersThisWeek: number
}

export const getNaamJapUsers = async (page: number = 1, search: string = '', sortBy: string = 'totalMalas', sortOrder: string = 'desc') => {
    const response = await api.get('/naam-jap/admin/users', { params: { page, limit: 50, search, sortBy, sortOrder } })
    return response.data as {
        success: boolean
        response: {
            users: NaamJapUserData[]
            pagination: { page: number; limit: number; total: number; pages: number }
        }
    }
}

export const getNaamJapAdminStats = async () => {
    const response = await api.get('/naam-jap/admin/stats')
    return response.data as { success: boolean; response: NaamJapAdminStats }
}

// Push Notification APIs
export const sendPushNotification = async (title: string, body: string) => {
    const response = await api.post('/notifications/send', { title, body })
    return response.data as { success: boolean; message?: string; response: { sent: number; failed: number; total: number } }
}

// Subscriptions (Admin)
export interface SubscriptionItem {
    _id: string
    deviceId: string
    mobile: string
    userName?: string
    userCity?: string
    planSnapshot?: {
        name_hi?: string
        name_en?: string
        price?: number
        durationMonths?: number
        isLifetime?: boolean
    }
    razorpayOrderId: string
    razorpayPaymentId?: string
    amount: number
    currency: string
    status: 'created' | 'paid' | 'failed' | 'refunded' | 'paused' | 'cancelled'
    startsAt?: string | null
    expiresAt?: string | null
    paidAt?: string | null
    pausedAt?: string | null
    cancelledAt?: string | null
    cancelReason?: string
    createdAt: string
    computedActive?: boolean
    isExpired?: boolean
}

export interface SubscriptionsResponse {
    items: SubscriptionItem[]
    pagination: { page: number; limit: number; total: number; pages: number }
    stats: {
        byStatus: Record<string, { count: number; amount: number }>
        activeOnPage: number
    }
}

export const listSubscriptions = async (params: { page?: number; status?: string; search?: string } = {}) => {
    const response = await api.get('/membership/admin/subscriptions', {
        params: { page: params.page || 1, limit: 50, status: params.status || '', search: params.search || '' },
    })
    return response.data as { success: boolean; response: SubscriptionsResponse }
}

export const pauseSubscription = async (id: string) => {
    const response = await api.post(`/membership/admin/subscriptions/${id}/pause`)
    return response.data
}

export const resumeSubscription = async (id: string) => {
    const response = await api.post(`/membership/admin/subscriptions/${id}/resume`)
    return response.data
}

export const cancelSubscription = async (id: string, reason?: string) => {
    const response = await api.post(`/membership/admin/subscriptions/${id}/cancel`, { reason })
    return response.data
}

// Rewards (Admin)
export interface RewardItem {
    _id?: string
    title_hi: string
    title_en: string
    description_hi: string
    description_en: string
    japTarget: number
    stepsTarget: number
    handwrittenTarget: number
    rewardAmount: number
    type: 'lifetime' | 'daily'
    icon: string
    isActive: boolean
    sortOrder: number
    claimCount?: number
    totalPayout?: number
}

export const listRewardsAdmin = async () => {
    const response = await api.get('/rewards/admin/list')
    return response.data as { success: boolean; response: RewardItem[] }
}
export const createReward = async (data: Partial<RewardItem>) => {
    const response = await api.post('/rewards/admin', data)
    return response.data
}
export const updateReward = async (id: string, data: Partial<RewardItem>) => {
    const response = await api.put(`/rewards/admin/${id}`, data)
    return response.data
}
export const deleteReward = async (id: string) => {
    const response = await api.delete(`/rewards/admin/${id}`)
    return response.data
}

// Withdrawals (Admin)
export interface WithdrawalItem {
    _id: string
    deviceId: string
    mobile: string
    userName: string
    amount: number
    upiId: string
    status: 'pending' | 'approved' | 'paid' | 'rejected'
    adminNote: string
    processedAt: string | null
    paidAt: string | null
    createdAt: string
}

export const listWithdrawals = async (params: { page?: number; status?: string; search?: string } = {}) => {
    const response = await api.get('/rewards/admin/withdrawals', {
        params: { page: params.page || 1, limit: 50, status: params.status || '', search: params.search || '' },
    })
    return response.data as {
        success: boolean
        response: {
            items: WithdrawalItem[]
            pagination: { page: number; limit: number; total: number; pages: number }
            stats: Record<string, { count: number; amount: number }>
        }
    }
}

export const actOnWithdrawal = async (id: string, action: 'approve' | 'paid' | 'reject', note?: string) => {
    const response = await api.post(`/rewards/admin/withdrawals/${id}/action`, { action, note })
    return response.data
}


// ===== Referrals (Admin) =====
export interface ReferralMilestone {
    count: number
    rewardAmount: number
    title_hi: string
    title_en: string
    description_hi: string
    description_en: string
    isActive: boolean
}

export interface ReferralSettingsData {
    isEnabled: boolean
    referrerBonus: number
    refereeBonus: number
    eligibility: 'members_only' | 'non_members_only' | 'both'
    title_hi: string
    title_en: string
    description_hi: string
    description_en: string
    howItWorks_hi: string
    howItWorks_en: string
    shareMessage_hi: string
    shareMessage_en: string
    milestones: ReferralMilestone[]
}

export interface ReferralUseItem {
    _id: string
    referralCode: string
    referrerDeviceId: string
    referrerMobile: string
    refereeDeviceId: string
    refereeMobile: string
    refereeName: string
    status: 'pending' | 'credited' | 'rejected'
    bonusCredited: number
    refereeBonusCredited: number
    creditedAt: string | null
    note: string
    createdAt: string
}

export const getReferralSettings = async () => {
    const response = await api.get('/referrals/admin/settings')
    return response.data as { success: boolean; response: ReferralSettingsData }
}
export const updateReferralSettings = async (data: Partial<ReferralSettingsData>) => {
    const response = await api.put('/referrals/admin/settings', data)
    return response.data
}
export const listReferralUses = async (params: { page?: number; status?: string; search?: string } = {}) => {
    const response = await api.get('/referrals/admin/list', {
        params: { page: params.page || 1, limit: 50, status: params.status || '', search: params.search || '' },
    })
    return response.data as {
        success: boolean
        response: {
            items: ReferralUseItem[]
            pagination: { page: number; limit: number; total: number; pages: number }
            stats: Record<string, { count: number; amount: number }>
        }
    }
}
export const getReferralStats = async () => {
    const response = await api.get('/referrals/admin/stats')
    return response.data as { success: boolean; response: { totalCodes: number; totalUses: number; totalPayout: number } }
}
export const actOnReferralUse = async (id: string, action: 'credit' | 'reject', note?: string) => {
    const response = await api.post(`/referrals/admin/uses/${id}/action`, { action, note })
    return response.data
}

export default api
