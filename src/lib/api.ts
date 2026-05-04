import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
})

// Add auth token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('admin_token')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
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
    }[]
    dailyActivity: {
        name: string
        malas: number
        users: number
        count: number
    }[]
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
export const getDashboardAnalytics = async () => {
    const response = await api.get('/admin/analytics')
    return response.data as { success: boolean; response: DashboardAnalytics }
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

export default api
