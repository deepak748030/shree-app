import { useEffect, useState } from 'react'
import { Loader2, Search, CheckCircle2, XCircle, IndianRupee, BadgeCheck, Clock } from 'lucide-react'
import { listWithdrawals, actOnWithdrawal, type WithdrawalItem } from '../lib/api'

const STATUSES = ['', 'pending', 'approved', 'paid', 'rejected']

export function WithdrawalsPage() {
    const [items, setItems] = useState<WithdrawalItem[]>([])
    const [stats, setStats] = useState<Record<string, { count: number; amount: number }>>({})
    const [loading, setLoading] = useState(true)
    const [busyId, setBusyId] = useState<string | null>(null)
    const [status, setStatus] = useState<string>('pending')
    const [search, setSearch] = useState('')
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    const load = async () => {
        setLoading(true)
        try {
            const res = await listWithdrawals({ status, search })
            if (res.success) {
                setItems(res.response.items)
                setStats(res.response.stats || {})
            }
        } finally { setLoading(false) }
    }
    useEffect(() => { load() }, [status]) // eslint-disable-line

    const act = async (id: string, action: 'approve' | 'paid' | 'reject') => {
        let note = ''
        if (action === 'reject') {
            const n = prompt('Reason for rejection (optional):')
            if (n === null) return
            note = n
        }
        setBusyId(id); setMsg(null)
        try {
            const res = await actOnWithdrawal(id, action, note)
            if (res.success) {
                setMsg({ type: 'success', text: `Marked as ${action === 'paid' ? 'paid' : action === 'approve' ? 'approved' : 'rejected'}.` })
                await load()
            } else {
                setMsg({ type: 'error', text: res.message || 'Action failed.' })
            }
        } catch (e: any) {
            setMsg({ type: 'error', text: e?.response?.data?.message || 'Action failed.' })
        } finally { setBusyId(null) }
    }

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2"><IndianRupee className="w-6 h-6 text-emerald-500" /> Withdrawal Requests</h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Approve or pay user UPI withdrawals from their reward wallet.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Pending" value={`${stats.pending?.count || 0} • ₹${(stats.pending?.amount || 0).toLocaleString('en-IN')}`} icon={<Clock className="w-4 h-4 text-amber-500" />} />
                <Stat label="Approved" value={`${stats.approved?.count || 0} • ₹${(stats.approved?.amount || 0).toLocaleString('en-IN')}`} icon={<BadgeCheck className="w-4 h-4 text-blue-500" />} />
                <Stat label="Paid" value={`${stats.paid?.count || 0} • ₹${(stats.paid?.amount || 0).toLocaleString('en-IN')}`} icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />} />
                <Stat label="Rejected" value={`${stats.rejected?.count || 0} • ₹${(stats.rejected?.amount || 0).toLocaleString('en-IN')}`} icon={<XCircle className="w-4 h-4 text-red-500" />} />
            </div>

            {msg && (
                <div className={`px-4 py-2 rounded-lg text-sm border ${msg.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    {msg.text}
                </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex flex-wrap gap-1">
                    {STATUSES.map(s => (
                        <button key={s || 'all'} onClick={() => setStatus(s)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${status === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-muted'}`}>
                            {s ? s[0].toUpperCase() + s.slice(1) : 'All'}
                        </button>
                    ))}
                </div>
                <div className="flex-1 flex gap-2">
                    <div className="flex-1 relative">
                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                        <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()}
                            placeholder="Search mobile / UPI / name"
                            className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-sm" />
                    </div>
                    <button onClick={load} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">Search</button>
                </div>
            </div>

            <div className="bg-card border border-border rounded-xl overflow-x-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
                ) : items.length === 0 ? (
                    <div className="text-center text-sm text-muted-foreground py-12">No withdrawal requests.</div>
                ) : (
                    <table className="w-full text-sm min-w-[760px]">
                        <thead className="bg-muted/50 text-xs text-muted-foreground">
                            <tr>
                                <th className="text-left px-3 py-2">User</th>
                                <th className="text-left px-3 py-2">UPI</th>
                                <th className="text-right px-3 py-2">Amount</th>
                                <th className="text-left px-3 py-2">Status</th>
                                <th className="text-left px-3 py-2">Requested</th>
                                <th className="text-right px-3 py-2">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map(w => (
                                <tr key={w._id} className="border-t border-border">
                                    <td className="px-3 py-2">
                                        <div className="font-medium">{w.userName || '—'}</div>
                                        <div className="text-xs text-muted-foreground">{w.mobile || '—'}</div>
                                    </td>
                                    <td className="px-3 py-2 font-mono text-xs">{w.upiId}</td>
                                    <td className="px-3 py-2 text-right font-bold">₹{w.amount.toLocaleString('en-IN')}</td>
                                    <td className="px-3 py-2"><StatusPill status={w.status} /></td>
                                    <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(w.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                                    <td className="px-3 py-2 text-right">
                                        <div className="flex gap-1 justify-end flex-wrap">
                                            {w.status === 'pending' && (
                                                <button disabled={busyId === w._id} onClick={() => act(w._id, 'approve')}
                                                    className="px-2 py-1 rounded text-xs bg-blue-600 text-white hover:opacity-90 disabled:opacity-50">Approve</button>
                                            )}
                                            {(w.status === 'pending' || w.status === 'approved') && (
                                                <>
                                                    <button disabled={busyId === w._id} onClick={() => act(w._id, 'paid')}
                                                        className="px-2 py-1 rounded text-xs bg-emerald-600 text-white hover:opacity-90 disabled:opacity-50">Mark Paid</button>
                                                    <button disabled={busyId === w._id} onClick={() => act(w._id, 'reject')}
                                                        className="px-2 py-1 rounded text-xs bg-red-600 text-white hover:opacity-90 disabled:opacity-50">Reject</button>
                                                </>
                                            )}
                                            {busyId === w._id && <Loader2 className="w-3 h-3 animate-spin self-center" />}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}

function StatusPill({ status }: { status: WithdrawalItem['status'] }) {
    const map: Record<string, string> = {
        pending: 'bg-amber-100 text-amber-800 border-amber-300',
        approved: 'bg-blue-100 text-blue-800 border-blue-300',
        paid: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        rejected: 'bg-red-100 text-red-800 border-red-300',
    }
    return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${map[status]}`}>{status}</span>
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
    return (
        <div className="bg-card border border-border rounded-lg p-3">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">{icon}{label}</div>
            <div className="text-base font-bold mt-0.5">{value}</div>
        </div>
    )
}