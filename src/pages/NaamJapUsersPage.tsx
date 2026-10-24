import { useEffect, useMemo, useState } from 'react'
import {
    Search,
    Users,
    Hash,
    Trophy,
    Activity,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    Radio,
    X,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useQuery } from '../hooks/useQuery'
import { useRealtimeStatus } from '../hooks/useRealtimeStatus'
import { getNaamJapAdminStats, getNaamJapUsers, type NaamJapAdminStats, type NaamJapUserData } from '../lib/api'

interface UsersResponse {
    users: NaamJapUserData[]
    pagination: { page: number; limit: number; total: number; pages: number }
}

const PAGE_SIZE = 50

/** Debounce keystrokes so typing does not fire a request per character. */
function useDebounced<T>(value: T, delay = 300): T {
    const [debounced, setDebounced] = useState(value)
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay)
        return () => clearTimeout(timer)
    }, [value, delay])
    return debounced
}

export function NaamJapUsersPage() {
    const [searchInput, setSearchInput] = useState('')
    const search = useDebounced(searchInput.trim(), 300)
    const [page, setPage] = useState(1)
    const [sortBy, setSortBy] = useState('totalMalas')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
    const { isLive, label } = useRealtimeStatus()

    // Reset to page 1 whenever the query changes (not on every render).
    useEffect(() => {
        setPage(1)
    }, [search, sortBy, sortOrder])

    const usersQuery = useQuery<UsersResponse>({
        key: `users:list:${page}:${PAGE_SIZE}:${search}:${sortBy}:${sortOrder}`,
        fetcher: async () => {
            const response = await getNaamJapUsers(page, search, sortBy, sortOrder)
            return response.response
        },
        topics: ['users'],
        staleTime: 10_000,
        keepPreviousData: true,
    })

    const statsQuery = useQuery<NaamJapAdminStats>({
        key: 'users:stats',
        fetcher: async () => {
            const response = await getNaamJapAdminStats()
            return response.response
        },
        topics: ['users', 'stats'],
        staleTime: 15_000,
        refetchInterval: 60_000,
    })

    const stats = statsQuery.data
    const users = usersQuery.data?.users || []
    const total = usersQuery.data?.pagination.total || 0
    const totalPages = usersQuery.data?.pagination.pages || 1
    const isRefreshing = usersQuery.isFetching || statsQuery.isFetching

    const handleSort = (field: string) => {
        if (sortBy === field) {
            setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))
        } else {
            setSortBy(field)
            setSortOrder('desc')
        }
    }

    const formatNumber = (n: number) => (n || 0).toLocaleString('en-IN')
    const formatDate = (d: string) =>
        d
            ? new Date(d).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
              })
            : '—'

    const statCards = useMemo(
        () => [
            { icon: Users, label: 'Total Users', value: stats?.totalUsers || 0 },
            { icon: Hash, label: 'Total Malas', value: stats?.totalMalas || 0 },
            { icon: Trophy, label: 'Total Count', value: stats?.totalCount || 0 },
            { icon: Activity, label: 'Active Today', value: stats?.todayActiveUsers || 0 },
            { icon: Users, label: 'New This Week', value: stats?.newUsersThisWeek || 0 },
        ],
        [stats]
    )

    return (
        <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-foreground">Naam Jap Users</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Live view of every devotee — updates itself as they count
                    </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span
                        className={cn(
                            'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border',
                            isLive
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-muted text-muted-foreground border-border'
                        )}
                    >
                        <Radio className={cn('w-3.5 h-3.5', isLive && 'animate-pulse')} />
                        {label}
                    </span>
                    <button
                        onClick={() => {
                            void usersQuery.refetch()
                            void statsQuery.refetch()
                        }}
                        disabled={isRefreshing}
                        className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm disabled:opacity-70"
                    >
                        <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {statCards.map((stat) => (
                    <div key={stat.label} className="bg-card border border-border rounded-xl p-3 sm:p-4">
                        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                            <stat.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span className="text-[10px] sm:text-xs font-medium truncate">{stat.label}</span>
                        </div>
                        <p className="text-lg sm:text-2xl font-bold text-foreground tabular-nums">
                            {formatNumber(stat.value)}
                        </p>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                    type="text"
                    placeholder="Search by name, city or mobile…"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="w-full pl-10 pr-9 py-2.5 bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                />
                {searchInput && (
                    <button
                        onClick={() => setSearchInput('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted text-muted-foreground"
                        aria-label="Clear search"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* Users Table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
                {usersQuery.isInitialLoading ? (
                    <div className="p-4 space-y-3">
                        {Array.from({ length: 10 }).map((_, i) => (
                            <div key={i} className="h-10 skeleton rounded" />
                        ))}
                    </div>
                ) : users.length === 0 ? (
                    <div className="text-center py-20 text-muted-foreground">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                        <p className="text-lg font-medium">
                            {search ? 'No users match this search' : 'No users found'}
                        </p>
                        <p className="text-sm">
                            {search ? 'Try a different name, city or mobile' : 'Users appear here once they start using Naam Jap'}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className={cn('overflow-x-auto transition-opacity', usersQuery.isFetching && 'opacity-70')}>
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-border bg-muted/50">
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">#</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                                            <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-foreground">
                                                Name {sortBy === 'name' && (sortOrder === 'desc' ? '↓' : '↑')}
                                            </button>
                                        </th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">City</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Mobile</th>
                                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                                            <button onClick={() => handleSort('totalMalas')} className="flex items-center gap-1 ml-auto hover:text-foreground">
                                                Malas {sortBy === 'totalMalas' && (sortOrder === 'desc' ? '↓' : '↑')}
                                            </button>
                                        </th>
                                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                                            <button onClick={() => handleSort('totalCount')} className="flex items-center gap-1 ml-auto hover:text-foreground">
                                                Count {sortBy === 'totalCount' && (sortOrder === 'desc' ? '↓' : '↑')}
                                            </button>
                                        </th>
                                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                                            <button onClick={() => handleSort('lastSyncAt')} className="flex items-center gap-1 ml-auto hover:text-foreground">
                                                Last Sync {sortBy === 'lastSyncAt' && (sortOrder === 'desc' ? '↓' : '↑')}
                                            </button>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {users.map((user, index) => (
                                        <tr key={user._id} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-4 py-3 text-sm text-muted-foreground">
                                                {(page - 1) * PAGE_SIZE + index + 1}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    {user.profileImage ? (
                                                        <img
                                                            src={user.profileImage}
                                                            alt=""
                                                            loading="lazy"
                                                            className="w-7 h-7 rounded-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
                                                            {(user.name || '?').charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <p className="text-sm font-medium text-foreground">{user.name}</p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-muted-foreground">{user.city}</td>
                                            <td className="px-4 py-3 text-sm text-muted-foreground tabular-nums">
                                                {user.mobile || '—'}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-semibold text-foreground text-right tabular-nums">
                                                {formatNumber(user.totalMalas)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-muted-foreground text-right tabular-nums">
                                                {formatNumber(user.totalCount)}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground text-right whitespace-nowrap">
                                                {formatDate(user.lastSyncAt)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-3 sm:px-4 py-3 border-t border-border">
                            <p className="text-xs sm:text-sm text-muted-foreground">
                                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of{' '}
                                {formatNumber(total)}
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    aria-label="Previous page"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="text-sm text-foreground font-medium px-2 tabular-nums">
                                    {page} / {totalPages}
                                </span>
                                <button
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={page >= totalPages}
                                    className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    aria-label="Next page"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
