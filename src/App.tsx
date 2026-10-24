import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { RouteFallback } from './components/RouteFallback'
import { LoginPage } from './pages/LoginPage'
import { installGlobalListeners } from './lib/dataClient'
import { startRealtime, stopRealtime } from './lib/realtime'
import { bridgeRealtime, unbridgeRealtime } from './lib/realtimeBridge'

// Route-level code splitting: the login screen ships in the initial bundle,
// every dashboard page (and the heavy recharts dependency) is fetched on
// demand and cached by the browser afterwards. First paint drops from the
// whole dashboard to ~1 route chunk.
const DashboardLayout = lazy(() =>
    import('./components/DashboardLayout').then((m) => ({ default: m.DashboardLayout }))
)
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const DailyQuotesPage = lazy(() => import('./pages/DailyQuotesPage').then((m) => ({ default: m.DailyQuotesPage })))
const NaamJapUsersPage = lazy(() =>
    import('./pages/NaamJapUsersPage').then((m) => ({ default: m.NaamJapUsersPage }))
)
const HomeContentPage = lazy(() => import('./pages/HomeContentPage').then((m) => ({ default: m.HomeContentPage })))
const PushNotificationsPage = lazy(() =>
    import('./pages/PushNotificationsPage').then((m) => ({ default: m.PushNotificationsPage }))
)
const PresetImagesPage = lazy(() =>
    import('./pages/PresetImagesPage').then((m) => ({ default: m.PresetImagesPage }))
)
const AppVersionPage = lazy(() => import('./pages/AppVersionPage').then((m) => ({ default: m.AppVersionPage })))
const DonationSettingsPage = lazy(() =>
    import('./pages/DonationSettingsPage').then((m) => ({ default: m.DonationSettingsPage }))
)
const MembershipPlansPage = lazy(() =>
    import('./pages/MembershipPlansPage').then((m) => ({ default: m.MembershipPlansPage }))
)
const SubscriptionsPage = lazy(() =>
    import('./pages/SubscriptionsPage').then((m) => ({ default: m.SubscriptionsPage }))
)
const HandwrittenNaamPage = lazy(() =>
    import('./pages/HandwrittenNaamPage').then((m) => ({ default: m.HandwrittenNaamPage }))
)
const RewardsPage = lazy(() => import('./pages/RewardsPage').then((m) => ({ default: m.RewardsPage })))
const WithdrawalsPage = lazy(() =>
    import('./pages/WithdrawalsPage').then((m) => ({ default: m.WithdrawalsPage }))
)
const ReferralPage = lazy(() => import('./pages/ReferralPage').then((m) => ({ default: m.ReferralPage })))
const TermsConditionsPage = lazy(() =>
    import('./pages/TermsConditionsPage').then((m) => ({ default: m.TermsConditionsPage }))
)
const PrivacyPolicyPage = lazy(() =>
    import('./pages/PrivacyPolicyPage').then((m) => ({ default: m.PrivacyPolicyPage }))
)
const DeleteAccountPage = lazy(() =>
    import('./pages/DeleteAccountPage').then((m) => ({ default: m.DeleteAccountPage }))
)

/** Wires the realtime stream + cache to the current session. */
function LiveSession() {
    const { isAuthenticated } = useAuth()

    useEffect(() => {
        installGlobalListeners()
    }, [])

    useEffect(() => {
        if (!isAuthenticated) {
            stopRealtime()
            unbridgeRealtime()
            return
        }
        startRealtime()
        bridgeRealtime()
        return () => {
            // Keep the connection across route changes; only tear down on logout.
        }
    }, [isAuthenticated])

    return null
}

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <LiveSession />
                <Suspense fallback={<RouteFallback />}>
                    <Routes>
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/terms-conditions" element={<TermsConditionsPage />} />
                        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                        <Route path="/delete-account" element={<DeleteAccountPage />} />
                        <Route
                            path="/"
                            element={
                                <ProtectedRoute>
                                    <DashboardLayout />
                                </ProtectedRoute>
                            }
                        >
                            <Route index element={<DashboardPage />} />
                            <Route path="home-content" element={<HomeContentPage />} />
                            <Route path="daily-quotes" element={<DailyQuotesPage />} />
                            <Route path="naam-jap-users" element={<NaamJapUsersPage />} />
                            <Route path="push-notifications" element={<PushNotificationsPage />} />
                            <Route path="preset-images" element={<PresetImagesPage />} />
                            <Route path="app-version" element={<AppVersionPage />} />
                            <Route path="donation-settings" element={<DonationSettingsPage />} />
                            <Route path="membership-plans" element={<MembershipPlansPage />} />
                            <Route path="subscriptions" element={<SubscriptionsPage />} />
                            <Route path="handwritten-naam" element={<HandwrittenNaamPage />} />
                            <Route path="rewards" element={<RewardsPage />} />
                            <Route path="withdrawals" element={<WithdrawalsPage />} />
                            <Route path="referrals" element={<ReferralPage />} />
                            <Route path="settings" element={<SettingsPage />} />
                        </Route>
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </Suspense>
            </AuthProvider>
        </BrowserRouter>
    )
}

export default App
