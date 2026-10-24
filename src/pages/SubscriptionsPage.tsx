import { useEffect, useMemo, useState } from 'react'
import {
    Loader2,
    Search,
    PauseCircle,
    PlayCircle,
    XCircle,
    Crown,
    BadgeCheck,
    Clock,
    AlertTriangle,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    X,
} from 'lucide-react'
import {
    listSubscriptions,
    pauseSubscription,
    resumeSubscription,
    cancelSubscription,
    SubscriptionItem,
    SubscriptionsResponse,
} from '../lib/api'

const STATUSES: { value: string; label: string }[] = [
    { value: '', label: 'All' },
    { value: 'paid', label: 'Active (Paid)' },
    { value: 'paused', label: 'Paused' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'created', label: 'Pending' },
    { value: 'failed', label: 'Failed' },
    { value: 'refunded', label: 'Refunded' },
]

const fmtDate = (d?: string | null) => {
    if (!d) return '-'
    const dt = new Date(d)
    return dt.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const fmtAmount = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`

const statusBadge = (s: SubscriptionItem) => {
    const map: Record<string, string> = {
        paid: 'bg-green-100 text-green-700 border-green-200',
        paused: 'bg-amber-100 text-amber-700 border-amber-200',
        cancelled: 'bg-red-100 text-red-700 border-red-200',
        created: 'bg-blue-100 text-blue-700 border-blue-200',
        failed: 'bg-red-100 text-red-700 border-red-200',
        refunded: 'bg-purple-100 text-purple-700 border-purple-200',
    }
    let label: string = s.status
    if (s.status === 'paid' && s.isExpired) {
        return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-gray-100 text-gray-600 border-gray-200">Expired</span>
    }
    if (s.status === 'paid') label = 'Active'
    return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border capitalize ${map[s.status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>{label}</span>
}

export function SubscriptionsPage() {
    const [data, setData] = useState<SubscriptionsResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [page, setPage] = useState(1)
    const [status, setStatus] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [search, setSearch] = useState('')
    const [actionId, setActionId] = useState<string | null>(null)
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [cancelTarget, setCancelTarget] = useState<SubscriptionItem | null>(null)
    const [cancelReason, setCancelReason] = useState('')
    const [detail, setDetail] = useState<SubscriptionItem | null>(null)

    const load = async (showSpinner = true) => {
        if (showSpinner) setLoading(true)
        else setRefreshing(true)
        try {
            const res = await listSubscriptions({ page, status, search })
            if (res.success) setData(res.response)
        } catch {
            setMsg({ type: 'error', text: 'Failed to load subscriptions' })
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    // The dependency list is exactly the set of values `load` reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { load() }, [page, status, search])

    useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(null), 3500); return () => clearTimeout(t) } }, [msg])

    const onSearch = (e: React.FormEvent) => {
        e.preventDefault()
        setPage(1)
        setSearch(searchInput.trim())
    }

    const handlePause = async (s: SubscriptionItem) => {
        if (!confirm(`Pause subscription for ${s.userName || s.mobile || s.deviceId}?`)) return
        setActionId(s._id)
        try {
            const res = await pauseSubscription(s._id)
            if (res.success) {
                setMsg({ type: 'success', text: 'Subscription paused.' })
                load(false)
            } else setMsg({ type: 'error', text: res.message || 'Failed' })
        } catch (e: any) {
            setMsg({ type: 'error', text: e?.response?.data?.message || 'Failed to pause' })
        } finally { setActionId(null) }
    }

    const handleResume = async (s: SubscriptionItem) => {
        setActionId(s._id)
        try {
            const res = await resumeSubscription(s._id)
            if (res.success) {
                setMsg({ type: 'success', text: 'Subscription resumed.' })
                load(false)
            } else setMsg({ type: 'error', text: res.message || 'Failed' })
        } catch (e: any) {
            setMsg({ type: 'error', text: e?.response?.data?.message || 'Failed to resume' })
        } finally { setActionId(null) }
    }

    const confirmCancel = async () => {
        if (!cancelTarget) return
        setActionId(cancelTarget._id)
        try {
            const res = await cancelSubscription(cancelTarget._id, cancelReason)
            if (res.success) {
                setMsg({ type: 'success', text: 'Subscription cancelled.' })
                setCancelTarget(null); setCancelReason('')
                load(false)
            } else setMsg({ type: 'error', text: res.message || 'Failed' })
        } catch (e: any) {
            setMsg({ type: 'error', text: e?.response?.data?.message || 'Failed to cancel' })
        } finally { setActionId(null) }
    }

    const totalRevenuePaise = useMemo(() => {
        if (!data) return 0
        return Object.entries(data.stats.byStatus).reduce((sum, [k, v]) => k === 'paid' ? sum + v.amount : sum, 0)
    }, [data])

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                        <Crown className="w-6 h-6 text-amber-500" /> Subscriptions
                    </h1>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">View who purchased a membership, pause or cancel any subscription.</p>
                </div>
                <button
                    onClick={() => load(false)}
                    disabled={refreshing}
                    className="flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted disabled:opacity-50 w-full sm:w-auto"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard icon={<BadgeCheck className="w-5 h-5 text-green-600" />} label="Active (Paid)" value={data?.stats.byStatus.paid?.count || 0} />
                <StatCard icon={<PauseCircle className="w-5 h-5 text-amber-600" />} label="Paused" value={data?.stats.byStatus.paused?.count || 0} />
                <StatCard icon={<XCircle className="w-5 h-5 text-red-600" />} label="Cancelled" value={data?.stats.byStatus.cancelled?.count || 0} />
                <StatCard icon={<Crown className="w-5 h-5 text-amber-500" />} label="Total Revenue" value={fmtAmount(totalRevenuePaise)} />
            </div>

            {msg && (
                <div className={`px-4 py-2 rounded-lg text-sm border ${msg.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    {msg.text}
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-2">
                <form onSubmit={onSearch} className="flex-1 relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Search by mobile, device ID, order ID, payment ID..."
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-sm"
                    />
                </form>
                <select
                    value={status}
                    onChange={(e) => { setStatus(e.target.value); setPage(1) }}
                    className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
                >
                    {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : !data || data.items.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-16 border border-dashed border-border rounded-xl">
                    No subscriptions found.
                </div>
            ) : (
                <>
                    {/* Desktop table */}
                    <div className="hidden lg:block bg-card border border-border rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                                <tr>
                                    <th className="text-left px-4 py-3">User</th>
                                    <th className="text-left px-4 py-3">Plan</th>
                                    <th className="text-left px-4 py-3">Amount</th>
                                    <th className="text-left px-4 py-3">Status</th>
                                    <th className="text-left px-4 py-3">Purchased</th>
                                    <th className="text-left px-4 py-3">Expires</th>
                                    <th className="text-right px-4 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.items.map(s => (
                                    <tr key={s._id} className="border-t border-border hover:bg-muted/30 cursor-pointer" onClick={() => setDetail(s)}>
                                        <td className="px-4 py-3">
                                            <div className="font-medium">{s.userName || '—'}</div>
                                            <div className="text-xs text-muted-foreground">{s.mobile || s.deviceId.slice(0, 12) + '…'}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1">
                                                {s.planSnapshot?.isLifetime && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                                                <span>{s.planSnapshot?.name_en || '—'}</span>
                                            </div>
                                            <div className="text-xs text-muted-foreground">{s.planSnapshot?.isLifetime ? 'Lifetime' : `${s.planSnapshot?.durationMonths || 0} mo`}</div>
                                        </td>
                                        <td className="px-4 py-3 font-semibold">{fmtAmount(s.amount)}</td>
                                        <td className="px-4 py-3">{statusBadge(s)}</td>
                                        <td className="px-4 py-3 text-xs">{fmtDate(s.paidAt || s.createdAt)}</td>
                                        <td className="px-4 py-3 text-xs">{s.planSnapshot?.isLifetime ? '∞' : fmtDate(s.expiresAt)}</td>
                                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                            <RowActions
                                                sub={s}
                                                actionId={actionId}
                                                onPause={() => handlePause(s)}
                                                onResume={() => handleResume(s)}
                                                onCancel={() => { setCancelTarget(s); setCancelReason('') }}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="lg:hidden space-y-2">
                        {data.items.map(s => (
                            <div key={s._id} className="bg-card border border-border rounded-xl p-3" onClick={() => setDetail(s)}>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="font-medium truncate">{s.userName || s.mobile || s.deviceId.slice(0, 12)}</div>
                                        <div className="text-xs text-muted-foreground truncate">{s.mobile}</div>
                                    </div>
                                    {statusBadge(s)}
                                </div>
                                <div className="flex items-center justify-between mt-2 text-xs">
                                    <div className="flex items-center gap-1">
                                        {s.planSnapshot?.isLifetime && <Crown className="w-3 h-3 text-amber-500" />}
                                        <span>{s.planSnapshot?.name_en} · {fmtAmount(s.amount)}</span>
                                    </div>
                                    <span className="text-muted-foreground">{s.planSnapshot?.isLifetime ? 'Lifetime' : fmtDate(s.expiresAt)}</span>
                                </div>
                                <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                                    <RowActions
                                        sub={s}
                                        actionId={actionId}
                                        onPause={() => handlePause(s)}
                                        onResume={() => handleResume(s)}
                                        onCancel={() => { setCancelTarget(s); setCancelReason('') }}
                                        full
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Pagination */}
                    {data.pagination.pages > 1 && (
                        <div className="flex items-center justify-between mt-3">
                            <span className="text-xs text-muted-foreground">
                                Page {data.pagination.page} of {data.pagination.pages} · {data.pagination.total} total
                            </span>
                            <div className="flex gap-2">
                                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-2 border border-border rounded-lg disabled:opacity-40 hover:bg-muted"><ChevronLeft className="w-4 h-4" /></button>
                                <button disabled={page >= data.pagination.pages} onClick={() => setPage(p => p + 1)} className="p-2 border border-border rounded-lg disabled:opacity-40 hover:bg-muted"><ChevronRight className="w-4 h-4" /></button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Cancel Modal */}
            {cancelTarget && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-card rounded-2xl border border-border w-full max-w-md p-5">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                            <h2 className="font-bold">Cancel Subscription</h2>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            This will immediately end access for <span className="font-medium text-foreground">{cancelTarget.userName || cancelTarget.mobile || cancelTarget.deviceId.slice(0, 12)}</span>. This action cannot be undone.
                        </p>
                        <textarea
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            placeholder="Reason (optional)"
                            rows={3}
                            className="w-full mt-3 px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none"
                        />
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => { setCancelTarget(null); setCancelReason('') }} className="px-4 py-2 border border-border rounded-lg text-sm">Keep it</button>
                            <button onClick={confirmCancel} disabled={actionId === cancelTarget._id} className="flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                                {actionId === cancelTarget._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                                Cancel Subscription
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {detail && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:p-4">
                    <div className="bg-card rounded-t-2xl sm:rounded-2xl border border-border w-full sm:max-w-lg max-h-[92vh] overflow-auto">
                        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
                            <h2 className="font-bold flex items-center gap-2"><Crown className="w-4 h-4 text-amber-500" /> Subscription Detail</h2>
                            <button onClick={() => setDetail(null)} className="p-1 rounded hover:bg-muted"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-4 space-y-3 text-sm">
                            <Row label="User" value={detail.userName || '—'} />
                            <Row label="City" value={detail.userCity || '—'} />
                            <Row label="Mobile" value={detail.mobile || '—'} />
                            <Row label="Device ID" value={detail.deviceId} mono />
                            <Row label="Plan" value={`${detail.planSnapshot?.name_en} / ${detail.planSnapshot?.name_hi}`} />
                            <Row label="Duration" value={detail.planSnapshot?.isLifetime ? 'Lifetime' : `${detail.planSnapshot?.durationMonths} months`} />
                            <Row label="Amount" value={fmtAmount(detail.amount)} />
                            <Row label="Status" value={<>{statusBadge(detail)}</>} />
                            <Row label="Order ID" value={detail.razorpayOrderId} mono />
                            <Row label="Payment ID" value={detail.razorpayPaymentId || '—'} mono />
                            <Row label="Purchased" value={fmtDate(detail.paidAt || detail.createdAt)} />
                            <Row label="Starts" value={fmtDate(detail.startsAt)} />
                            <Row label="Expires" value={detail.planSnapshot?.isLifetime ? '∞ Lifetime' : fmtDate(detail.expiresAt)} />
                            {detail.pausedAt && <Row label="Paused at" value={fmtDate(detail.pausedAt)} />}
                            {detail.cancelledAt && <Row label="Cancelled at" value={fmtDate(detail.cancelledAt)} />}
                            {detail.cancelReason && <Row label="Cancel reason" value={detail.cancelReason} />}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
    return (
        <div className="bg-card border border-border rounded-xl p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
            <div className="mt-1 text-xl font-bold">{value}</div>
        </div>
    )
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
    return (
        <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">{label}</span>
            <span className={`text-right break-all ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
        </div>
    )
}

function RowActions({
    sub, actionId, onPause, onResume, onCancel, full,
}: {
    sub: SubscriptionItem
    actionId: string | null
    onPause: () => void
    onResume: () => void
    onCancel: () => void
    full?: boolean
}) {
    const isLoading = actionId === sub._id
    const canPause = sub.status === 'paid'
    const canResume = sub.status === 'paused'
    const canCancel = sub.status !== 'cancelled' && sub.status !== 'failed' && sub.status !== 'refunded'

    const btn = `flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition disabled:opacity-40 ${full ? 'flex-1' : ''}`

    return (
        <div className={`flex gap-1.5 ${full ? '' : 'justify-end'}`}>
            {canPause && (
                <button disabled={isLoading} onClick={onPause} className={`${btn} border-amber-200 text-amber-700 hover:bg-amber-50`}>
                    {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <PauseCircle className="w-3.5 h-3.5" />} Pause
                </button>
            )}
            {canResume && (
                <button disabled={isLoading} onClick={onResume} className={`${btn} border-green-200 text-green-700 hover:bg-green-50`}>
                    {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />} Resume
                </button>
            )}
            {canCancel && (
                <button disabled={isLoading} onClick={onCancel} className={`${btn} border-red-200 text-red-700 hover:bg-red-50`}>
                    <XCircle className="w-3.5 h-3.5" /> Cancel
                </button>
            )}
            {!canPause && !canResume && !canCancel && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> No actions</span>
            )}
        </div>
    )
}
