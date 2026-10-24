import { useMemo } from 'react'
import {
    Users,
    Hash,
    Trophy,
    Activity,
    TrendingUp,
    TrendingDown,
    RefreshCw,
    Quote,
    Image as ImageIcon,
    Crown,
    Wallet,
    IndianRupee,
    Radio,
    Gauge,
    Clock,
} from 'lucide-react'
import {
    Area,
    AreaChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'
import { cn } from '../lib/utils'
import { useQuery } from '../hooks/useQuery'
import { useRealtimeStatus } from '../hooks/useRealtimeStatus'
import { getDashboardAnalytics, type DashboardAnalytics } from '../lib/api'

const CHART_COLORS = {
    malas: '#8b5cf6',
    users: '#3b82f6',
    count: '#22c55e',
}

interface StatCardProps {
    title: string
    value: number | string
    icon: React.ElementType
    color: string
    isLoading?: boolean
    hint?: string
    delta?: number | null
    deltaLabel?: string
}

function StatCardSkeleton() {
    return (
        <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-start justify-between">
                <div className="space-y-3 flex-1">
                    <div className="h-3 w-20 skeleton rounded" />
                    <div className="h-7 w-16 skeleton rounded" />
                    <div className="h-2.5 w-24 skeleton rounded" />
                </div>
                <div className="h-9 w-9 skeleton rounded-lg" />
            </div>
        </div>
    )
}

function StatCard({ title, value, icon: Icon, color, isLoading, hint, delta, deltaLabel }: StatCardProps) {
    if (isLoading) return <StatCardSkeleton />
    const displayValue = typeof value === 'number' ? value.toLocaleString('en-IN') : value
    const hasDelta = typeof delta === 'number' && Number.isFinite(delta)
    const positive = hasDelta && (delta as number) >= 0

    return (
        <div className="bg-card border border-border rounded-xl p-4 transition-all hover:shadow-lg hover:border-primary/30">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide truncate">
                        {title}
                    </p>
                    <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{displayValue}</p>
                    {(hint || hasDelta) && (
                        <div className="flex items-center gap-1.5 mt-1.5 text-[11px]">
                            {hasDelta && (
                                <span
                                    className={cn(
                                        'inline-flex items-center gap-0.5 font-semibold',
                                        positive ? 'text-emerald-400' : 'text-rose-400'
                                    )}
                                >
                                    {positive ? (
                                        <TrendingUp className="w-3 h-3" />
                                    ) : (
                                        <TrendingDown className="w-3 h-3" />
                                    )}
                                    {Math.abs(delta as number)}%
                                </span>
                            )}
                            <span className="text-muted-foreground truncate">
                                {hasDelta ? deltaLabel : hint}
                            </span>
                        </div>
                    )}
                </div>
                <div className={cn('p-2 rounded-lg shrink-0', color)}>
                    <Icon className="w-4 h-4" />
                </div>
            </div>
        </div>
    )
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                <p className="text-sm text-muted-foreground mb-1">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <p key={index} className="text-sm font-medium" style={{ color: entry.color }}>
                        {entry.name}: {Number(entry.value).toLocaleString('en-IN')}
                    </p>
                ))}
            </div>
        )
    }
    return null
}

function timeAgo(timestamp: number) {
    if (!timestamp) return 'never'
    const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000))
    if (seconds < 5) return 'just now'
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.round(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    return `${Math.round(minutes / 60)}h ago`
}

export function DashboardPage() {
    const { status, label, isLive } = useRealtimeStatus()

    const { data: analytics, error, isInitialLoading, isFetching, updatedAt, refetch } = useQuery<DashboardAnalytics>({
        key: 'analytics:overview',
        fetcher: async () => {
            const response = await getDashboardAnalytics()
            return response.response
        },
        topics: ['analytics', 'users', 'quotes', 'subscriptions', 'withdrawals', 'rewards'],
        staleTime: 20_000,
        // Safety net only: realtime events normally drive refreshes.
        refetchInterval: 60_000,
    })

    const errorMessage = useMemo(() => {
        if (!error) return ''
        const anyError = error as any
        return (
            anyError?.response?.data?.message ||
            anyError?.message ||
            'Unable to reach the API. Check the server and VITE_API_URL.'
        )
    }, [error])

    const naamJapStats: StatCardProps[] = [
        {
            title: 'Total Users',
            value: analytics?.naamJap?.totalUsers || 0,
            icon: Users,
            color: 'bg-primary/10 text-primary',
            hint: `${(analytics?.naamJap?.newUsersToday || 0).toLocaleString('en-IN')} new today`,
        },
        {
            title: 'Total Malas',
            value: analytics?.naamJap?.totalMalas || 0,
            icon: Hash,
            color: 'bg-emerald-500/10 text-emerald-400',
            hint: `${(analytics?.naamJap?.todayMalas || 0).toLocaleString('en-IN')} today`,
        },
        {
            title: 'Total Jap Count',
            value: analytics?.naamJap?.totalCount || 0,
            icon: Trophy,
            color: 'bg-blue-500/10 text-blue-400',
            hint: `${(analytics?.naamJap?.avgMalasPerActiveUser || 0).toLocaleString('en-IN')} malas / active user`,
        },
        {
            title: 'Active Today',
            value: analytics?.naamJap?.todayActiveUsers || 0,
            icon: Activity,
            color: 'bg-green-500/10 text-green-400',
            delta:
                analytics?.naamJap?.yesterdayActiveUsers && analytics.naamJap.yesterdayActiveUsers > 0
                    ? Math.round(
                          (((analytics.naamJap.todayActiveUsers || 0) - analytics.naamJap.yesterdayActiveUsers) /
                              analytics.naamJap.yesterdayActiveUsers) *
                              100
                      )
                    : null,
            deltaLabel: 'vs yesterday',
        },
        {
            title: 'New This Week',
            value: analytics?.naamJap?.newUsersThisWeek || 0,
            icon: TrendingUp,
            color: 'bg-purple-500/10 text-purple-400',
            hint: 'last 7 days',
        },
    ]

    const businessStats: StatCardProps[] = [
        {
            title: 'Active Members',
            value: analytics?.membership?.activeMembers || 0,
            icon: Crown,
            color: 'bg-amber-500/10 text-amber-400',
            hint: `${analytics?.membership?.lifetimeMembers || 0} lifetime`,
        },
        {
            title: 'Revenue (month)',
            value: `₹${(analytics?.membership?.revenueThisMonth || 0).toLocaleString('en-IN')}`,
            icon: IndianRupee,
            color: 'bg-emerald-500/10 text-emerald-400',
            hint: `₹${(analytics?.membership?.revenue || 0).toLocaleString('en-IN')} all time`,
        },
        {
            title: 'Pending Payouts',
            value: analytics?.money?.pendingWithdrawals?.count || 0,
            icon: Wallet,
            color: 'bg-orange-500/10 text-orange-400',
            hint: `₹${(analytics?.money?.pendingWithdrawals?.amount || 0).toLocaleString('en-IN')} to release`,
        },
        {
            title: 'Wallet Balance',
            value: `₹${(analytics?.money?.wallet?.balance || 0).toLocaleString('en-IN')}`,
            icon: Gauge,
            color: 'bg-sky-500/10 text-sky-400',
            hint: `${analytics?.money?.wallet?.users || 0} wallets`,
        },
    ]

    const quotesStats: StatCardProps[] = [
        {
            title: 'Total Quotes',
            value: analytics?.dailyQuotes?.total || 0,
            icon: ImageIcon,
            color: 'bg-amber-500/10 text-amber-400',
        },
        {
            title: 'Active Quotes',
            value: analytics?.dailyQuotes?.active || 0,
            icon: Quote,
            color: 'bg-orange-500/10 text-orange-400',
        },
    ]

    const activity = analytics?.dailyActivity || []
    const loading = isInitialLoading

    return (
        <div className="animate-fade-in space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-foreground">Dashboard</h1>
                    <p className="text-muted-foreground text-sm mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>Welcome back to Shree Jii Admin</span>
                        <span className="text-border">•</span>
                        <span className="inline-flex items-center gap-1 text-xs">
                            <Clock className="w-3 h-3" />
                            updated {timeAgo(updatedAt)}
                        </span>
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <span
                        className={cn(
                            'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border',
                            isLive
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : status === 'polling'
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                    : 'bg-muted text-muted-foreground border-border'
                        )}
                        title={`Realtime transport: ${status}`}
                    >
                        <Radio className={cn('w-3.5 h-3.5', isLive && 'animate-pulse')} />
                        {label}
                    </span>
                    <button
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-70 text-sm"
                    >
                        <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                </div>
            </div>

            {errorMessage && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex items-center justify-between gap-3">
                    <span>{errorMessage}</span>
                    <button onClick={() => refetch()} className="underline whitespace-nowrap">
                        Retry
                    </button>
                </div>
            )}

            {/* Naam Jap Stats */}
            <div>
                <h2 className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 sm:mb-3">
                    Naam Jap Overview
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
                    {naamJapStats.map((stat) => (
                        <StatCard key={stat.title} {...stat} isLoading={loading} />
                    ))}
                </div>
            </div>

            {/* Business stats */}
            <div>
                <h2 className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 sm:mb-3">
                    Membership & Rewards
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                    {businessStats.map((stat) => (
                        <StatCard key={stat.title} {...stat} isLoading={loading} />
                    ))}
                </div>
            </div>

            {/* Charts & Top Users */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-card border border-border rounded-xl p-3 sm:p-5">
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                        <h3 className="text-sm sm:text-base font-semibold text-foreground">
                            Daily Activity (Last 7 Days)
                        </h3>
                        {typeof analytics?.naamJap?.dayOverDayTrend === 'number' && (
                            <span
                                className={cn(
                                    'text-xs font-semibold',
                                    (analytics.naamJap.dayOverDayTrend as number) >= 0
                                        ? 'text-emerald-400'
                                        : 'text-rose-400'
                                )}
                            >
                                {(analytics.naamJap.dayOverDayTrend as number) >= 0 ? '+' : ''}
                                {analytics.naamJap.dayOverDayTrend}% vs yesterday
                            </span>
                        )}
                    </div>
                    {loading ? (
                        <div className="h-[280px] skeleton rounded" />
                    ) : activity.some((d) => d.malas > 0 || d.users > 0) ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <AreaChart data={activity} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="malasGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={CHART_COLORS.malas} stopOpacity={0.45} />
                                        <stop offset="100%" stopColor={CHART_COLORS.malas} stopOpacity={0.02} />
                                    </linearGradient>
                                    <linearGradient id="usersGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={CHART_COLORS.users} stopOpacity={0.4} />
                                        <stop offset="100%" stopColor={CHART_COLORS.users} stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
                                <Area
                                    type="monotone"
                                    dataKey="malas"
                                    name="Malas"
                                    stroke={CHART_COLORS.malas}
                                    strokeWidth={2}
                                    fill="url(#malasGradient)"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="users"
                                    name="Active Users"
                                    stroke={CHART_COLORS.users}
                                    strokeWidth={2}
                                    fill="url(#usersGradient)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                            No activity data yet
                        </div>
                    )}
                </div>

                <div className="bg-card border border-border rounded-xl p-3 sm:p-5">
                    <h3 className="text-sm sm:text-base font-semibold text-foreground mb-3 sm:mb-4">Top 10 Users</h3>
                    {loading ? (
                        <div className="h-[280px] skeleton rounded" />
                    ) : analytics?.topUsers && analytics.topUsers.length > 0 ? (
                        <div className="overflow-auto max-h-[280px]">
                            <table className="w-full">
                                <thead className="sticky top-0 bg-card">
                                    <tr className="border-b border-border">
                                        <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">#</th>
                                        <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Name</th>
                                        <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">City</th>
                                        <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Malas</th>
                                        <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Count</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {analytics.topUsers.map((user) => (
                                        <tr key={`${user.rank}-${user.name}`} className="hover:bg-muted/30 transition-colors">
                                            <td className="py-2 px-2 text-sm text-muted-foreground">{user.rank}</td>
                                            <td className="py-2 px-2 text-sm font-medium text-foreground">{user.name}</td>
                                            <td className="py-2 px-2 text-sm text-muted-foreground">{user.city}</td>
                                            <td className="py-2 px-2 text-sm font-semibold text-foreground text-right tabular-nums">
                                                {(user.malas || 0).toLocaleString('en-IN')}
                                            </td>
                                            <td className="py-2 px-2 text-sm text-muted-foreground text-right tabular-nums">
                                                {(user.count || 0).toLocaleString('en-IN')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                            <div className="text-center">
                                <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                                <p>No users yet</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Daily quotes */}
            <div>
                <h2 className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 sm:mb-3">
                    Daily Quotes
                </h2>
                <div className="grid grid-cols-2 gap-2 sm:gap-3 max-w-md">
                    {quotesStats.map((stat) => (
                        <StatCard key={stat.title} {...stat} isLoading={loading} />
                    ))}
                </div>
            </div>
        </div>
    )
}
