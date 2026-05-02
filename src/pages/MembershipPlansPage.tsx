import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Loader2, Save, X, Crown, Star } from 'lucide-react'
import api from '../lib/api'

interface Plan {
    _id?: string
    name_hi: string
    name_en: string
    description_hi: string
    description_en: string
    price: number
    durationMonths: number
    isLifetime: boolean
    isActive: boolean
    isBestValue: boolean
    sortOrder: number
}

const empty: Plan = {
    name_hi: '', name_en: '', description_hi: '', description_en: '',
    price: 99, durationMonths: 1, isLifetime: false, isActive: true, isBestValue: false, sortOrder: 0,
}

export function MembershipPlansPage() {
    const [plans, setPlans] = useState<Plan[]>([])
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState<Plan | null>(null)
    const [saving, setSaving] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    const load = async () => {
        try {
            const res = await api.get('/membership/admin/plans')
            if (res.data.success) setPlans(res.data.response)
        } finally {
            setLoading(false)
        }
    }
    useEffect(() => { load() }, [])

    const save = async () => {
        if (!editing) return
        if (!editing.name_hi || !editing.name_en || !editing.price || !editing.durationMonths) {
            setMsg({ type: 'error', text: 'Name (Hindi/English), price and duration are required.' }); return
        }
        setSaving(true); setMsg(null)
        try {
            if (editing._id) {
                await api.put(`/membership/admin/plans/${editing._id}`, editing)
            } else {
                await api.post('/membership/admin/plans', editing)
            }
            setEditing(null); await load()
            setMsg({ type: 'success', text: 'Plan saved.' })
        } catch {
            setMsg({ type: 'error', text: 'Failed to save plan.' })
        } finally { setSaving(false) }
    }

    const remove = async (id: string) => {
        if (!confirm('Delete this plan?')) return
        setDeletingId(id)
        try { await api.delete(`/membership/admin/plans/${id}`); await load() }
        finally { setDeletingId(null) }
    }

    if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold">Membership Plans</h1>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">Create plans with price (₹) and duration in months.</p>
                </div>
                <button onClick={() => setEditing({ ...empty })}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 w-full sm:w-auto">
                    <Plus className="w-4 h-4" /> Add Plan
                </button>
            </div>

            {msg && (
                <div className={`px-4 py-2 rounded-lg text-sm border ${msg.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    {msg.text}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {plans.length === 0 && <div className="col-span-full text-center text-sm text-muted-foreground py-10">No plans yet. Click "Add Plan".</div>}
                {plans.map(p => (
                    <div key={p._id} className="bg-card border border-border rounded-xl p-4 relative">
                        {p.isBestValue && (
                            <div className="absolute -top-2 right-3 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"><Star className="w-3 h-3" /> BEST</div>
                        )}
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <div className="flex items-center gap-1.5">
                                    {p.isLifetime && <Crown className="w-4 h-4 text-amber-600" />}
                                    <h3 className="font-bold">{p.name_en}</h3>
                                </div>
                                <p className="text-xs text-muted-foreground">{p.name_hi}</p>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                                {p.isActive ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                        <div className="mt-2 text-2xl font-extrabold text-primary">₹{p.price}</div>
                        <div className="text-xs text-muted-foreground">{p.isLifetime ? 'Lifetime' : `${p.durationMonths} month${p.durationMonths > 1 ? 's' : ''}`}</div>
                        {p.description_en && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{p.description_en}</p>}
                        <div className="flex gap-2 mt-3">
                            <button onClick={() => setEditing(p)} className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-muted">
                                <Pencil className="w-3 h-3" /> Edit
                            </button>
                            <button onClick={() => p._id && remove(p._id)} disabled={deletingId === p._id}
                                className="flex items-center justify-center gap-1 px-3 py-1.5 bg-destructive text-destructive-foreground rounded-lg text-xs hover:opacity-90 disabled:opacity-50">
                                {deletingId === p._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {editing && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:p-4">
                    <div className="bg-card rounded-t-2xl sm:rounded-2xl border border-border w-full sm:max-w-2xl max-h-[92vh] overflow-auto">
                        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
                            <h2 className="font-bold">{editing._id ? 'Edit Plan' : 'New Plan'}</h2>
                            <button onClick={() => setEditing(null)} className="p-1 rounded hover:bg-muted"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-muted-foreground">Name (Hindi) *</label>
                                <input value={editing.name_hi} onChange={e => setEditing({ ...editing, name_hi: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" placeholder="मासिक" />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground">Name (English) *</label>
                                <input value={editing.name_en} onChange={e => setEditing({ ...editing, name_en: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" placeholder="Monthly" />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground">Price (₹) *</label>
                                <input type="number" min={1} value={editing.price} onChange={e => setEditing({ ...editing, price: Number(e.target.value) })}
                                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground">Duration (months) *</label>
                                <input type="number" min={1} value={editing.durationMonths} onChange={e => setEditing({ ...editing, durationMonths: Number(e.target.value) })}
                                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs text-muted-foreground">Description (Hindi)</label>
                                <textarea value={editing.description_hi} onChange={e => setEditing({ ...editing, description_hi: e.target.value })}
                                    rows={2} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs text-muted-foreground">Description (English)</label>
                                <textarea value={editing.description_en} onChange={e => setEditing({ ...editing, description_en: e.target.value })}
                                    rows={2} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none" />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground">Sort Order</label>
                                <input type="number" value={editing.sortOrder} onChange={e => setEditing({ ...editing, sortOrder: Number(e.target.value) })}
                                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
                            </div>
                            <div className="flex flex-col gap-2 pt-5">
                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.isActive} onChange={e => setEditing({ ...editing, isActive: e.target.checked })} className="accent-primary" /> Active</label>
                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.isLifetime} onChange={e => setEditing({ ...editing, isLifetime: e.target.checked })} className="accent-primary" /> Lifetime plan</label>
                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.isBestValue} onChange={e => setEditing({ ...editing, isBestValue: e.target.checked })} className="accent-primary" /> Best value badge</label>
                            </div>
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
