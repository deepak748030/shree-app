import { useEffect, useState } from 'react'
import { Loader2, Save, Gift, Search, ChevronLeft, ChevronRight, Check, X } from 'lucide-react'
import {
    getReferralSettings, updateReferralSettings, listReferralUses, getReferralStats,
    actOnReferralUse, type ReferralSettingsData, type ReferralUseItem,
} from '../lib/api'

export function ReferralPage() {
    const [tab, setTab] = useState<'settings' | 'history'>('settings')
    const [settings, setSettings] = useState<ReferralSettingsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    const [uses, setUses] = useState<ReferralUseItem[]>([])
    const [page, setPage] = useState(1)
    const [pages, setPages] = useState(1)
    const [statusFilter, setStatusFilter] = useState('')
    const [search, setSearch] = useState('')
    const [stats, setStats] = useState({ totalCodes: 0, totalUses: 0, totalPayout: 0 })
    const [historyLoading, setHistoryLoading] = useState(false)

    const load = async () => {
        try {
            const [s, st] = await Promise.all([getReferralSettings(), getReferralStats()])
            if (s.success) setSettings(s.response)
            if (st.success) setStats(st.response)
        } finally { setLoading(false) }
    }

    const loadHistory = async () => {
        setHistoryLoading(true)
        try {
            const res = await listReferralUses({ page, status: statusFilter, search })
            if (res.success) {
                setUses(res.response.items)
                setPages(res.response.pagination.pages)
            }
        } finally { setHistoryLoading(false) }
    }

    useEffect(() => { load() }, [])
    useEffect(() => { if (tab === 'history') loadHistory() }, [tab, page, statusFilter])

    const save = async () => {
        if (!settings) return
        setSaving(true); setMsg(null)
        try {
            await updateReferralSettings(settings)
            setMsg({ type: 'success', text: 'Settings saved.' })
        } catch {
            setMsg({ type: 'error', text: 'Failed to save settings.' })
        } finally { setSaving(false) }
    }

    const onAction = async (id: string, action: 'credit' | 'reject') => {
        try {
            await actOnReferralUse(id, action)
            await loadHistory()
            await load()
        } catch {
            setMsg({ type: 'error', text: 'Action failed.' })
        }
    }

    if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2"><Gift className="w-6 h-6 text-pink-500" /> Referral Program</h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Reward users for inviting friends. Track every referral and credit bonuses to wallets.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Codes issued" value={stats.totalCodes} />
                <Stat label="Total referrals" value={stats.totalUses} />
                <Stat label="Total payout" value={`₹${stats.totalPayout.toLocaleString('en-IN')}`} />
                <Stat label="Status" value={settings?.isEnabled ? 'Enabled' : 'Disabled'} />
            </div>

            <div className="flex gap-2 border-b border-border">
                {(['settings', 'history'] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px ${tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                        {t}
                    </button>
                ))}
            </div>

            {msg && (
                <div className={`px-4 py-2 rounded-lg text-sm border ${msg.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    {msg.text}
                </div>
            )}

            {tab === 'settings' && settings && (
                <div className="bg-card border border-border rounded-xl p-4 space-y-4">
                    <label className="flex items-center gap-2 text-sm font-medium">
                        <input type="checkbox" checked={settings.isEnabled} onChange={e => setSettings({ ...settings, isEnabled: e.target.checked })} className="accent-primary" />
                        Enable referral program
                    </label>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Field label="Referrer bonus (₹)">
                            <input type="number" min={0} value={settings.referrerBonus}
                                onChange={e => setSettings({ ...settings, referrerBonus: Number(e.target.value) })}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
                            <p className="text-[11px] text-muted-foreground mt-1">Credited to the person who shared the code.</p>
                        </Field>
                        <Field label="Referee bonus (₹)">
                            <input type="number" min={0} value={settings.refereeBonus}
                                onChange={e => setSettings({ ...settings, refereeBonus: Number(e.target.value) })}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
                            <p className="text-[11px] text-muted-foreground mt-1">Optional welcome bonus for the new user. Set 0 to disable.</p>
                        </Field>
                    </div>

                    <Field label="Eligibility (who can earn referral bonus)">
                        <div className="flex flex-wrap gap-2">
                            {([
                                { v: 'both', l: 'Both (members & non-members)' },
                                { v: 'members_only', l: 'Members only' },
                                { v: 'non_members_only', l: 'Non-members only' },
                            ] as const).map(opt => (
                                <button key={opt.v} type="button"
                                    onClick={() => setSettings({ ...settings, eligibility: opt.v })}
                                    className={`px-3 py-2 rounded-lg text-xs font-medium border ${settings.eligibility === opt.v ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-muted'}`}>
                                    {opt.l}
                                </button>
                            ))}
                        </div>
                    </Field>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Field label="Title (Hindi)">
                            <input value={settings.title_hi} onChange={e => setSettings({ ...settings, title_hi: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
                        </Field>
                        <Field label="Title (English)">
                            <input value={settings.title_en} onChange={e => setSettings({ ...settings, title_en: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
                        </Field>
                        <Field label="Description (Hindi)">
                            <textarea rows={2} value={settings.description_hi} onChange={e => setSettings({ ...settings, description_hi: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none" />
                        </Field>
                        <Field label="Description (English)">
                            <textarea rows={2} value={settings.description_en} onChange={e => setSettings({ ...settings, description_en: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none" />
                        </Field>
                        <Field label="How it works (Hindi)">
                            <textarea rows={3} value={settings.howItWorks_hi} onChange={e => setSettings({ ...settings, howItWorks_hi: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none" />
                        </Field>
                        <Field label="How it works (English)">
                            <textarea rows={3} value={settings.howItWorks_en} onChange={e => setSettings({ ...settings, howItWorks_en: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none" />
                        </Field>
                    </div>

                    <div className="flex justify-end">
                        <button onClick={save} disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Save settings
                        </button>
                    </div>
                </div>
            )}

            {tab === 'history' && (
                <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex flex-wrap gap-1">
                            {(['', 'credited', 'rejected', 'pending'] as const).map(s => (
                                <button key={s || 'all'} onClick={() => { setStatusFilter(s); setPage(1) }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border capitalize ${statusFilter === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-muted'}`}>
                                    {s || 'All'}
                                </button>
                            ))}
                        </div>
                        <div className="flex-1 flex gap-2">
                            <div className="flex-1 relative">
                                <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                                <input value={search} onChange={e => setSearch(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { setPage(1); loadHistory() } }}
                                    placeholder="Search code, mobile or name (press Enter)"
                                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-sm" />
                            </div>
                        </div>
                    </div>

                    {historyLoading ? (
                        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                    ) : (
                        <div className="bg-card border border-border rounded-xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50 text-xs text-muted-foreground">
                                        <tr>
                                            <th className="px-3 py-2 text-left">When</th>
                                            <th className="px-3 py-2 text-left">Code</th>
                                            <th className="px-3 py-2 text-left">Referrer</th>
                                            <th className="px-3 py-2 text-left">Referee</th>
                                            <th className="px-3 py-2 text-left">Status</th>
                                            <th className="px-3 py-2 text-right">Bonus</th>
                                            <th className="px-3 py-2 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {uses.length === 0 && (
                                            <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No referrals yet.</td></tr>
                                        )}
                                        {uses.map(u => (
                                            <tr key={u._id} className="border-t border-border">
                                                <td className="px-3 py-2 text-xs">{new Date(u.createdAt).toLocaleString('en-IN')}</td>
                                                <td className="px-3 py-2 font-mono text-xs">{u.referralCode}</td>
                                                <td className="px-3 py-2 text-xs">
                                                    <div>{u.referrerMobile || '—'}</div>
                                                    <div className="text-muted-foreground truncate max-w-[140px]">{u.referrerDeviceId}</div>
                                                </td>
                                                <td className="px-3 py-2 text-xs">
                                                    <div>{u.refereeName || '—'} {u.refereeMobile && `· ${u.refereeMobile}`}</div>
                                                    <div className="text-muted-foreground truncate max-w-[140px]">{u.refereeDeviceId}</div>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${u.status === 'credited' ? 'bg-green-100 text-green-700' : u.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                        {u.status}
                                                    </span>
                                                    {u.note && <div className="text-[10px] text-muted-foreground mt-1">{u.note}</div>}
                                                </td>
                                                <td className="px-3 py-2 text-right">₹{u.bonusCredited}</td>
                                                <td className="px-3 py-2 text-right">
                                                    {u.status !== 'credited' && (
                                                        <button onClick={() => onAction(u._id, 'credit')} title="Credit" className="p-1 rounded hover:bg-green-100 text-green-700"><Check className="w-4 h-4" /></button>
                                                    )}
                                                    {u.status !== 'rejected' && (
                                                        <button onClick={() => onAction(u._id, 'reject')} title="Reject" className="p-1 rounded hover:bg-red-100 text-red-700"><X className="w-4 h-4" /></button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {pages > 1 && (
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Page {page} of {pages}</span>
                            <div className="flex gap-2">
                                <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="p-2 border border-border rounded-lg disabled:opacity-40 hover:bg-muted"><ChevronLeft className="w-4 h-4" /></button>
                                <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="p-2 border border-border rounded-lg disabled:opacity-40 hover:bg-muted"><ChevronRight className="w-4 h-4" /></button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function Stat({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="bg-card border border-border rounded-xl p-3">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-xl font-bold mt-1">{value}</div>
        </div>
    )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
            {children}
        </div>
    )
}
