import { useEffect, useState } from 'react'
import { Loader2, Search, PenLine, Users, Sigma } from 'lucide-react'
import api from '../lib/api'

interface Row {
    _id: string
    deviceId: string
    name: string
    mobile: string
    city: string
    selectedMantra: string
    lifetimeCount: number
    todayCount: number
    lastSyncAt: string
}

export function HandwrittenNaamPage() {
    const [rows, setRows] = useState<Row[]>([])
    const [stats, setStats] = useState<{ totalUsers: number; totalLifetime: number }>({ totalUsers: 0, totalLifetime: 0 })
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [pages, setPages] = useState(1)
    const [sortBy, setSortBy] = useState<'lifetimeCount' | 'lastSyncAt'>('lifetimeCount')

    const load = async () => {
        setLoading(true)
        try {
            const res = await api.get('/handwritten-naam/admin/users', {
                params: { page, limit: 50, search, sortBy, sortOrder: 'desc' },
            })
            if (res.data.success) {
                setRows(res.data.response.items)
                setStats(res.data.response.stats)
                setPages(res.data.response.pagination.pages)
            }
        } finally { setLoading(false) }
    }

    // `load` reads page/sortBy/search; the first effect is keyed on the two
    // values that change without debouncing (search has its own timer).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { load() }, [page, sortBy])
    useEffect(() => {
        const t = setTimeout(() => { setPage(1); load() }, 350)
        return () => clearTimeout(t)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search])

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold">Handwritten Naam</h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Per-user handwritten jap (today & lifetime).</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
                <div className="bg-card border border-border rounded-xl p-3 sm:p-4">
                    <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] sm:text-xs"><Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Total Users</div>
                    <div className="text-lg sm:text-2xl font-bold mt-1">{stats.totalUsers.toLocaleString()}</div>
                </div>
                <div className="bg-card border border-border rounded-xl p-3 sm:p-4">
                    <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] sm:text-xs"><Sigma className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Lifetime Total</div>
                    <div className="text-lg sm:text-2xl font-bold mt-1">{stats.totalLifetime.toLocaleString()}</div>
                </div>
                <div className="bg-card border border-border rounded-xl p-3 sm:p-4 hidden md:block">
                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs"><PenLine className="w-4 h-4" /> Showing</div>
                    <div className="text-2xl font-bold mt-1">{rows.length}</div>
                </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-2.5 sm:p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, mobile, city..."
                        className="flex-1 min-w-0 bg-transparent outline-none text-sm" />
                </div>
                <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
                    className="text-xs px-2 py-1.5 rounded border border-border bg-background">
                    <option value="lifetimeCount">Sort: Lifetime</option>
                    <option value="lastSyncAt">Sort: Last Active</option>
                </select>
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : rows.length === 0 ? (
                    <div className="text-center text-sm text-muted-foreground py-10">No data found.</div>
                ) : (
                    <>
                        {/* Desktop / tablet table */}
                        <div className="hidden sm:block overflow-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                                    <tr>
                                        <th className="text-left px-3 py-2">User</th>
                                        <th className="text-left px-3 py-2">Mobile</th>
                                        <th className="text-left px-3 py-2">City</th>
                                        <th className="text-left px-3 py-2">Mantra</th>
                                        <th className="text-right px-3 py-2">Today</th>
                                        <th className="text-right px-3 py-2">Lifetime</th>
                                        <th className="text-left px-3 py-2">Last Sync</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map(r => (
                                        <tr key={r._id} className="border-t border-border/60 hover:bg-muted/30">
                                            <td className="px-3 py-2">
                                                <div className="font-medium">{r.name}</div>
                                                <div className="text-[10px] text-muted-foreground truncate max-w-[160px]">{r.deviceId}</div>
                                            </td>
                                            <td className="px-3 py-2">{r.mobile || '—'}</td>
                                            <td className="px-3 py-2">{r.city || '—'}</td>
                                            <td className="px-3 py-2 max-w-[200px] truncate">{r.selectedMantra}</td>
                                            <td className="px-3 py-2 text-right font-semibold text-amber-700">{r.todayCount.toLocaleString()}</td>
                                            <td className="px-3 py-2 text-right font-bold text-primary">{r.lifetimeCount.toLocaleString()}</td>
                                            <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(r.lastSyncAt).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile card list */}
                        <div className="sm:hidden divide-y divide-border/60">
                            {rows.map(r => (
                                <div key={r._id} className="p-3 active:bg-muted/40">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="font-semibold text-sm truncate">{r.name || 'Unnamed'}</div>
                                            <div className="text-[10px] text-muted-foreground truncate">{r.mobile || r.deviceId}</div>
                                            {r.city && <div className="text-[11px] text-muted-foreground mt-0.5">📍 {r.city}</div>}
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-base font-extrabold text-primary leading-none">{r.lifetimeCount.toLocaleString()}</div>
                                            <div className="text-[9px] uppercase tracking-wide text-muted-foreground mt-0.5">Lifetime</div>
                                        </div>
                                    </div>
                                    {r.selectedMantra && (
                                        <div className="text-[11px] text-muted-foreground mt-1.5 line-clamp-1">🕉 {r.selectedMantra}</div>
                                    )}
                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40">
                                        <div className="flex items-center gap-1 text-[11px]">
                                            <span className="text-muted-foreground">Today:</span>
                                            <span className="font-semibold text-amber-700">{r.todayCount.toLocaleString()}</span>
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">{new Date(r.lastSyncAt).toLocaleDateString()}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {pages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                        className="px-3 py-1.5 border border-border rounded-lg text-sm disabled:opacity-40">Prev</button>
                    <span className="text-sm text-muted-foreground">Page {page} / {pages}</span>
                    <button disabled={page === pages} onClick={() => setPage(p => p + 1)}
                        className="px-3 py-1.5 border border-border rounded-lg text-sm disabled:opacity-40">Next</button>
                </div>
            )}
        </div>
    )
}
