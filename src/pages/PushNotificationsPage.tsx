import { useState } from 'react'
import { Send, Bell, Loader2 } from 'lucide-react'
import { sendPushNotification } from '../lib/api'

export function PushNotificationsPage() {
    const [title, setTitle] = useState('')
    const [body, setBody] = useState('')
    const [sending, setSending] = useState(false)
    const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null)
    const [error, setError] = useState('')

    const handleSend = async () => {
        if (!title.trim() || !body.trim()) {
            setError('Title and content are required')
            return
        }
        setError('')
        setResult(null)
        setSending(true)
        try {
            const res = await sendPushNotification(title.trim(), body.trim())
            if (res.success) {
                setResult(res.response)
                setTitle('')
                setBody('')
            } else {
                setError(res.message || 'Failed to send')
            }
        } catch {
            setError('Failed to send notification')
        } finally {
            setSending(false)
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground">Push Notifications</h1>
                <p className="text-muted-foreground text-sm mt-1">Send push notifications to all app users</p>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 space-y-4 max-w-2xl">
                <div className="flex items-center gap-2 text-primary mb-2">
                    <Bell className="w-5 h-5" />
                    <span className="font-semibold">Compose Notification</span>
                </div>

                <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Title</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. श्री जी 🙏"
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm outline-none focus:border-primary"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Content</label>
                    <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder="e.g. जय श्री राधे! आज का नाम जप करना न भूलें।"
                        rows={4}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm outline-none focus:border-primary resize-none"
                    />
                </div>

                {error && (
                    <div className="text-red-500 text-sm border border-red-500/30 bg-red-500/10 rounded-lg px-3 py-2">
                        {error}
                    </div>
                )}

                {result && (
                    <div className="text-green-500 text-sm border border-green-500/30 bg-green-500/10 rounded-lg px-3 py-2">
                        Sent: {result.sent} | Failed: {result.failed} | Total: {result.total}
                    </div>
                )}

                <button
                    onClick={handleSend}
                    disabled={sending}
                    className="flex items-center justify-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 min-w-[160px]"
                >
                    {sending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <>
                            <Send className="w-4 h-4" />
                            <span>Send Notification</span>
                        </>
                    )}
                </button>
            </div>

            {/* Preview */}
            <div className="bg-card border border-border rounded-lg p-6 max-w-2xl">
                <h3 className="text-sm font-semibold text-foreground mb-3">Preview</h3>
                <div className="bg-background border border-border rounded-lg p-4 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <Bell className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                        <p className="font-semibold text-foreground text-sm truncate">
                            {title || 'Notification Title'}
                        </p>
                        <p className="text-muted-foreground text-sm mt-0.5 line-clamp-3">
                            {body || 'Notification content will appear here...'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
