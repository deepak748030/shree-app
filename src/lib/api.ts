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

// Handle auth errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            const token = localStorage.getItem('admin_token')
            const isProfileCheck = error.config?.url?.includes('/admin/me')

            if (!token && !isProfileCheck) {
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
    overview: {
        totalUsers: number
        activeUsers: number
        blockedUsers: number
        totalVendors: number
        activeVendors: number
        blockedVendors: number
        pendingKYC: number
        verifiedVendors: number
        totalOrders: number
        pendingOrders: number
        deliveredOrders: number
        cancelledOrders: number
        totalRevenue: number
        totalDeliveryPartners: number
        activeDeliveryPartners: number
        onlineDeliveryPartners: number
        pendingKycPartners: number
    }
    periodStats: {
        users: number
        vendors: number
        revenue: number
        filter: string
    }
    charts: {
        monthlyGrowth: { name: string; users?: number; orders?: number; revenue?: number }[]
        orderStatusDistribution: { name: string; value: number; color: string }[]
        vendorKycDistribution: { name: string; value: number; color: string }[]
    }
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
export const getDashboardAnalytics = async (filter: 'today' | 'weekly' | 'monthly' | 'yearly' = 'monthly') => {
    const response = await api.get('/admin/analytics', { params: { filter } })
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

export default api
