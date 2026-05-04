import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Loader2, Save, X, Trophy, IndianRupee, Footprints, Sparkles } from 'lucide-react'
import {
    listRewardsAdmin, createReward, updateReward, deleteReward, type RewardItem,
} from '../lib/api'

const empty: RewardItem = {
    title_hi: '', title_en: '', description_hi: '', description_en: '',
    japTarget: 108, stepsTarget: 1000, rewardAmount: 10,
    type: 'lifetime', icon: 'trophy', isActive: true, sortOrder: 0,
}

export function RewardsPage() {
    const [items, setItems] = useState<RewardItem[]>([])
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState<RewardItem | null>(null)
    const [saving, setSaving] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    const load = async () => {
        try {
            const res = await listRewardsAdmin()
            if (res.success) setItems(res.response)
        } finally { setLoading(false) }
    }
    useEffect(() => { load() }, [])

    const save = async () => {
        if (!editing) return
        if (!editing.title_hi || !editing.title_en) {
            setMsg({ type: 'error', text: 'Title (Hindi & English) required.' }); return
        }
        if (editing.japTarget < 0 || editing.stepsTarget < 0 || editing.rewardAmount < 0) {
            setMsg({ type: 'error', text: 'Targets and reward amount must be 0 or more.' }); return
        }
        setSaving(true); setMsg(null)
        try {
            if (editing._id) await updateReward(editing._id, editing)
            else await createReward(editing)
            setEditing(null); await load()
            setMsg({ type: 'success', text: 'Reward saved.' })
        } catch {
            setMsg({ type: 'error', text: 'Failed to save reward.' })
        } finally { setSaving(false) }
    }

    const remove = async (id: string) => {
        if (!confirm('Delete this reward? Existing claims and wallet credits remain.')) return
        setDeletingId(id)
        try { await deleteReward(id); await load() }
        finally { setDeletingId(null) }
    }

    if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>

    const totalPayout = items.reduce((s, r) => s + (r.totalPayout || 0), 0)
    const totalClaims = items.reduce((s, r) => s + (r.claimCount || 0), 0)

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2"><Trophy className="w-6 h-6 text-amber-500" /> Rewards</h1>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">Set target (Jap + Steps both required) and a ₹ amount. Members unlock & claim into wallet.</p>
                </div>
                <button onClick={() => setEditing({ ...empty })}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 w-full sm:w-auto">
                    <Plus className="w-4 h-4" /> Add Reward
                </button>
            </div>

            {msg && (
                <div className={`px-4 py-2 rounded-lg text-sm border ${msg.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    {msg.text}
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Active rewards" value={items.filter(i => i.isActive).length} />
                <Stat label="Total rewards" value={items.length} />
                <Stat label="Total claims" value={totalClaims} />
                <Stat label="Total payout" value={`₹${totalPayout.toLocaleString('en-IN')}`} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.length === 0 && <div className="col-span-full text-center text-sm text-muted-foreground py-10">No rewards yet. Click "Add Reward".</div>}
                {items.map(r => (
                    <div key={r._id} className="bg-card border border-border rounded-xl p-4 relative">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                    <h3 className="font-bold truncate">{r.title_en}</h3>
                                </div>
                                <p className="text-xs text-muted-foreground truncate">{r.title_hi}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${r.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                                    {r.isActive ? 'Active' : 'Inactive'}
                                </span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${r.type === 'daily' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                    {r.type === 'daily' ? 'Daily' : 'Lifetime'}
                                </span>
                            </div>
                        </div>
                        <div className="mt-3 flex items-center gap-1 text-2xl font-extrabold text-primary">
                            <IndianRupee className="w-5 h-5" />{r.rewardAmount}
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                                <Trophy className="w-3.5 h-3.5" /> {r.japTarget.toLocaleString('en-IN')} jap
                            </div>
                            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-green-50 text-green-700 border border-green-200">
                                <Footprints className="w-3.5 h-3.5" /> {r.stepsTarget.toLocaleString('en-IN')} steps
                            </div>
                        </div>
                        {r.description_en && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{r.description_en}</p>}
                        <div className="mt-2 text-[11px] text-muted-foreground">
                            {r.claimCount || 0} claim(s) · ₹{(r.totalPayout || 0).toLocaleString('en-IN')} paid
                        </div>
                        <div className="flex gap-2 mt-3">
                            <button onClick={() => setEditing(r)} className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-muted">
                                <Pencil className="w-3 h-3" /> Edit
                            </button>
                            <button onClick={() => r._id && remove(r._id)} disabled={deletingId === r._id}
                                className="flex items-center justify-center gap-1 px-3 py-1.5 bg-destructive text-destructive-foreground rounded-lg text-xs hover:opacity-90 disabled:opacity-50">
                                {deletingId === r._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {editing && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:p-4">
                    <div className="bg-card rounded-t-2xl sm:rounded-2xl border border-border w-full sm:max-w-2xl max-h-[92vh] overflow-auto">
                        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
                            <h2 className="font-bold">{editing._id ? 'Edit Reward' : 'New Reward'}</h2>
                            <button onClick={() => setEditing(null)} className="p-1 rounded hover:bg-muted"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Field label="Title (Hindi) *">
                                <input value={editing.title_hi} onChange={e => setEditing({ ...editing, title_hi: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" placeholder="भक्त" />
                            </Field>
                            <Field label="Title (English) *">
                                <input value={editing.title_en} onChange={e => setEditing({ ...editing, title_en: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" placeholder="Devotee" />
                            </Field>
                            <Field label="Jap target *">
                                <input type="number" min={0} value={editing.japTarget} onChange={e => setEditing({ ...editing, japTarget: Number(e.target.value) })}
                                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
                            </Field>
                            <Field label="Steps target *">
                                <input type="number" min={0} value={editing.stepsTarget} onChange={e => setEditing({ ...editing, stepsTarget: Number(e.target.value) })}
                                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
                            </Field>
                            <Field label="Reward amount (₹) *">
                                <input type="number" min={0} value={editing.rewardAmount} onChange={e => setEditing({ ...editing, rewardAmount: Number(e.target.value) })}
                                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
                            </Field>
                            <Field label="Type">
                                <select value={editing.type} onChange={e => setEditing({ ...editing, type: e.target.value as 'daily' | 'lifetime' })}
                                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
                                    <option value="lifetime">Lifetime (one-time, total counts)</option>
                                    <option value="daily">Daily (resets every day)</option>
                                </select>
                            </Field>
                            <div className="md:col-span-2">
                                <Field label="Description (Hindi)">
                                    <textarea value={editing.description_hi} onChange={e => setEditing({ ...editing, description_hi: e.target.value })}
                                        rows={2} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none" placeholder="108 बार जप व 1000 कदम पूरे करें" />
                                </Field>
                            </div>
                            <div className="md:col-span-2">
                                <Field label="Description (English)">
                                    <textarea value={editing.description_en} onChange={e => setEditing({ ...editing, description_en: e.target.value })}
                                        rows={2} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none" placeholder="Complete 108 jap and 1,000 steps" />
                                </Field>
                            </div>
                            <Field label="Sort Order">
                                <input type="number" value={editing.sortOrder} onChange={e => setEditing({ ...editing, sortOrder: Number(e.target.value) })}
                                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
                            </Field>
                            <div className="flex flex-col gap-2 pt-5">
                                <label className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={editing.isActive} onChange={e => setEditing({ ...editing, isActive: e.target.checked })} className="accent-primary" /> Active
                                </label>
                            </div>
                        </div>
                        <div className="px-4 pb-3 text-xs text-muted-foreground">
                            Note: Both jap and steps targets must be reached to unlock. Only paid members can claim. ₹ amount is credited to user's wallet.
                        </div>
                        <div className="p-4 border-t border-border flex justify-end gap-2 sticky bottom-0 bg-card">
                            <button onClick={() => setEditing(null)} className="px-4 py-2 border border-border rounded-lg text-sm">Cancel</button>
                            <button onClick={save} disabled={saving}
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {saving ? '' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="text-xs text-muted-foreground">{label}</label>
            {children}
        </div>
    )
}

function Stat({ label, value }: { label: string; value: number | string }) {
    return (
        <div className="bg-card border border-border rounded-lg p-3">
            <div className="text-[11px] text-muted-foreground">{label}</div>
            <div className="text-lg font-bold">{value}</div>
        </div>
    )
}