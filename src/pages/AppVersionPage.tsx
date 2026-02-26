import { useState, useEffect } from 'react'
import api from '../lib/api'
import { Settings, Save, Smartphone, AlertTriangle } from 'lucide-react'

interface AppVersionConfig {
    _id?: string
    platform: string
    requiredVersion: string
    playStoreUrl: string
    appStoreUrl: string
    updateMessage_hi: string
    updateMessage_en: string
    isForceUpdate: boolean
}

const defaultConfig: AppVersionConfig = {
    platform: 'android',
    requiredVersion: '1.0.0',
    playStoreUrl: '',
    appStoreUrl: '',
    updateMessage_hi: 'कृपया ऐप को अपडेट करें।',
    updateMessage_en: 'Please update the app to continue.',
    isForceUpdate: true,
}

export function AppVersionPage() {
    const [config, setConfig] = useState<AppVersionConfig>({ ...defaultConfig })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    useEffect(() => {
        fetchConfig()
    }, [])

    const fetchConfig = async () => {
        try {
            const res = await api.get('/app-version')
            const configs = res.data.response || []
            const android = configs.find((c: AppVersionConfig) => c.platform === 'android')
            if (android) setConfig(android)
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
            await api.post('/app-version', config)
            setMessage({ type: 'success', text: 'App version config saved successfully!' })
            setTimeout(() => setMessage(null), 3000)
        } catch {
            setMessage({ type: 'error', text: 'Failed to save config' })
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl">
                    <Smartphone className="w-6 h-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">App Version Control</h1>
                    <p className="text-sm text-muted-foreground">
                        Force users to update when a new version is available on Play Store
                    </p>
                </div>
            </div>

            {message && (
                <div className={`p-4 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                    {message.text}
                </div>
            )}

            {/* Config Card */}
            <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
                <div className="flex items-center gap-2 text-foreground font-semibold text-lg">
                    <Settings className="w-5 h-5" />
                    Android Configuration
                </div>

                {/* Required Version */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                        Required Minimum Version <span className="text-red-400">*</span>
                    </label>
                    <input
                        type="text"
                        value={config.requiredVersion}
                        onChange={(e) => setConfig({ ...config, requiredVersion: e.target.value })}
                        placeholder="e.g. 1.0.1"
                        className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <p className="text-xs text-muted-foreground">
                        Users with a version lower than this will be forced to update
                    </p>
                </div>

                {/* Play Store URL */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Play Store URL</label>
                    <input
                        type="url"
                        value={config.playStoreUrl}
                        onChange={(e) => setConfig({ ...config, playStoreUrl: e.target.value })}
                        placeholder="https://play.google.com/store/apps/details?id=com.shreejii.app"
                        className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                </div>

                {/* Update Messages */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Update Message (Hindi)</label>
                        <textarea
                            value={config.updateMessage_hi}
                            onChange={(e) => setConfig({ ...config, updateMessage_hi: e.target.value })}
                            rows={3}
                            className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Update Message (English)</label>
                        <textarea
                            value={config.updateMessage_en}
                            onChange={(e) => setConfig({ ...config, updateMessage_en: e.target.value })}
                            rows={3}
                            className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                        />
                    </div>
                </div>

                {/* Force Update Toggle */}
                <div className="flex items-center justify-between p-4 bg-background rounded-xl border border-border">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                        <div>
                            <p className="text-sm font-medium text-foreground">Force Update</p>
                            <p className="text-xs text-muted-foreground">
                                If enabled, users cannot skip the update
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setConfig({ ...config, isForceUpdate: !config.isForceUpdate })}
                        className={`relative w-12 h-6 rounded-full transition-colors ${config.isForceUpdate ? 'bg-primary' : 'bg-muted'}`}
                    >
                        <span
                            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${config.isForceUpdate ? 'translate-x-6' : 'translate-x-0'}`}
                        />
                    </button>
                </div>

                {/* Save Button */}
                <button
                    onClick={handleSave}
                    disabled={saving || !config.requiredVersion}
                    className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Configuration'}
                </button>
            </div>

            {/* Info Card */}
            <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
                <h3 className="font-semibold text-foreground">How it works</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Set the minimum required version (e.g. <code className="text-primary">1.0.1</code>)</li>
                    <li>• When app opens, it checks if current version is lower than required</li>
                    <li>• If outdated, a full-screen update prompt blocks the app</li>
                    <li>• User must update from Play Store to continue using the app</li>
                    <li>• After publishing a new version on Play Store, update the version here</li>
                </ul>
            </div>
        </div>
    )
}
