import { useState, useEffect, useRef } from 'react'
import { Save, Upload, Trash2, QrCode, Building2, CreditCard, Loader2 } from 'lucide-react'
import api from '../lib/api'

interface DonationSettingsData {
    _id?: string
    upiId: string
    accountNumber: string
    ifscCode: string
    accountHolderName: string
    bankName: string
    scannerImage: string
    isActive: boolean
    note_hi: string
    note_en: string
}

const defaultData: DonationSettingsData = {
    upiId: '',
    accountNumber: '',
    ifscCode: '',
    accountHolderName: '',
    bankName: '',
    scannerImage: '',
    isActive: true,
    note_hi: '',
    note_en: '',
}

export function DonationSettingsPage() {
    const [data, setData] = useState<DonationSettingsData>(defaultData)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const fileRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        try {
            const res = await api.get('/donation/admin')
            if (res.data.success && res.data.response) {
                setData(res.data.response)
            }
        } catch {
            // use defaults
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        setMessage(null)
        try {
            const res = await api.put('/donation/admin', {
                upiId: data.upiId,
                accountNumber: data.accountNumber,
                ifscCode: data.ifscCode,
                accountHolderName: data.accountHolderName,
                bankName: data.bankName,
                isActive: data.isActive,
                note_hi: data.note_hi,
                note_en: data.note_en,
            })
            if (res.data.success) {
                setMessage({ type: 'success', text: 'Donation settings saved successfully!' })
                setData(res.data.response)
            }
        } catch {
            setMessage({ type: 'error', text: 'Failed to save donation settings.' })
        } finally {
            setSaving(false)
        }
    }

    const handleUploadScanner = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        setMessage(null)
        try {
            const reader = new FileReader()
            reader.onload = async () => {
                try {
                    const res = await api.post('/donation/admin/upload-scanner', {
                        image: reader.result,
                    })
                    if (res.data.success) {
                        setData(prev => ({ ...prev, scannerImage: res.data.response.scannerImage }))
                        setMessage({ type: 'success', text: 'QR/Scanner image uploaded!' })
                    }
                } catch {
                    setMessage({ type: 'error', text: 'Failed to upload scanner image.' })
                } finally {
                    setUploading(false)
                }
            }
            reader.readAsDataURL(file)
        } catch {
            setUploading(false)
            setMessage({ type: 'error', text: 'Failed to read file.' })
        }
        if (fileRef.current) fileRef.current.value = ''
    }

    const handleDeleteScanner = async () => {
        setDeleting(true)
        setMessage(null)
        try {
            const res = await api.delete('/donation/admin/scanner')
            if (res.data.success) {
                setData(prev => ({ ...prev, scannerImage: '' }))
                setMessage({ type: 'success', text: 'Scanner image removed.' })
            }
        } catch {
            setMessage({ type: 'error', text: 'Failed to remove scanner image.' })
        } finally {
            setDeleting(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Donation Settings</h1>
                    <p className="text-sm text-muted-foreground mt-1">Manage UPI, bank details & QR scanner for donations</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-sm text-muted-foreground">Active</span>
                    <input
                        type="checkbox"
                        checked={data.isActive}
                        onChange={(e) => setData(prev => ({ ...prev, isActive: e.target.checked }))}
                        className="w-5 h-5 accent-primary"
                    />
                </label>
            </div>

            {message && (
                <div className={`px-4 py-2 rounded-lg text-sm border ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    {message.text}
                </div>
            )}

            {/* QR Scanner Image */}
            <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                    <QrCode className="w-5 h-5 text-primary" />
                    <h2 className="font-semibold text-foreground">QR / Scanner Image</h2>
                </div>
                {data.scannerImage ? (
                    <div className="flex items-start gap-4">
                        <img
                            src={data.scannerImage}
                            alt="QR Scanner"
                            className="w-48 h-48 object-contain rounded-lg border border-border bg-muted"
                        />
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => fileRef.current?.click()}
                                disabled={uploading}
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
                            >
                                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                {uploading ? '' : 'Change'}
                            </button>
                            <button
                                onClick={handleDeleteScanner}
                                disabled={deleting}
                                className="flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
                            >
                                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                {deleting ? '' : 'Remove'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
                    >
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {uploading ? '' : 'Upload QR Image'}
                    </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" onChange={handleUploadScanner} className="hidden" />
            </div>

            {/* UPI Details */}
            <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                    <CreditCard className="w-5 h-5 text-primary" />
                    <h2 className="font-semibold text-foreground">UPI Details</h2>
                </div>
                <div>
                    <label className="text-sm text-muted-foreground mb-1 block">UPI ID</label>
                    <input
                        type="text"
                        value={data.upiId}
                        onChange={(e) => setData(prev => ({ ...prev, upiId: e.target.value }))}
                        placeholder="e.g. name@upi"
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm outline-none focus:ring-1 focus:ring-primary"
                    />
                </div>
            </div>

            {/* Bank Details */}
            <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Building2 className="w-5 h-5 text-primary" />
                    <h2 className="font-semibold text-foreground">Bank Account Details</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="text-sm text-muted-foreground mb-1 block">Account Holder Name</label>
                        <input
                            type="text"
                            value={data.accountHolderName}
                            onChange={(e) => setData(prev => ({ ...prev, accountHolderName: e.target.value }))}
                            placeholder="Account holder name"
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm outline-none focus:ring-1 focus:ring-primary"
                        />
                    </div>
                    <div>
                        <label className="text-sm text-muted-foreground mb-1 block">Bank Name</label>
                        <input
                            type="text"
                            value={data.bankName}
                            onChange={(e) => setData(prev => ({ ...prev, bankName: e.target.value }))}
                            placeholder="e.g. State Bank of India"
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm outline-none focus:ring-1 focus:ring-primary"
                        />
                    </div>
                    <div>
                        <label className="text-sm text-muted-foreground mb-1 block">Account Number</label>
                        <input
                            type="text"
                            value={data.accountNumber}
                            onChange={(e) => setData(prev => ({ ...prev, accountNumber: e.target.value }))}
                            placeholder="Account number"
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm outline-none focus:ring-1 focus:ring-primary"
                        />
                    </div>
                    <div>
                        <label className="text-sm text-muted-foreground mb-1 block">IFSC Code</label>
                        <input
                            type="text"
                            value={data.ifscCode}
                            onChange={(e) => setData(prev => ({ ...prev, ifscCode: e.target.value.toUpperCase() }))}
                            placeholder="e.g. SBIN0001234"
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm outline-none focus:ring-1 focus:ring-primary"
                        />
                    </div>
                </div>
            </div>

            {/* Note */}
            <div className="bg-card border border-border rounded-xl p-4">
                <h2 className="font-semibold text-foreground mb-3">Donation Note (shown in app)</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="text-sm text-muted-foreground mb-1 block">Note (Hindi)</label>
                        <textarea
                            value={data.note_hi}
                            onChange={(e) => setData(prev => ({ ...prev, note_hi: e.target.value }))}
                            placeholder="दान के लिए संदेश..."
                            rows={3}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm outline-none focus:ring-1 focus:ring-primary resize-none"
                        />
                    </div>
                    <div>
                        <label className="text-sm text-muted-foreground mb-1 block">Note (English)</label>
                        <textarea
                            value={data.note_en}
                            onChange={(e) => setData(prev => ({ ...prev, note_en: e.target.value }))}
                            placeholder="Message for donation..."
                            rows={3}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm outline-none focus:ring-1 focus:ring-primary resize-none"
                        />
                    </div>
                </div>
            </div>

            {/* Save Button */}
            <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 disabled:opacity-50"
            >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {saving ? '' : 'Save Settings'}
            </button>
        </div>
    )
}
