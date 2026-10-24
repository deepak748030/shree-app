/**
 * Shown while a lazily-loaded route chunk is downloading.
 * Deliberately lightweight (no icons, no charts) so it renders in the initial
 * bundle and appears within the first frame.
 */
export function RouteFallback() {
    return (
        <div className="min-h-screen bg-background p-4 lg:p-6">
            <div className="max-w-7xl mx-auto space-y-5">
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <div className="h-6 w-40 skeleton rounded" />
                        <div className="h-3 w-64 skeleton rounded" />
                    </div>
                    <div className="h-9 w-28 skeleton rounded-lg" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-24 rounded-xl border border-border bg-card p-4">
                            <div className="h-3 w-16 skeleton rounded mb-3" />
                            <div className="h-6 w-12 skeleton rounded" />
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="h-72 rounded-xl border border-border bg-card" />
                    <div className="h-72 rounded-xl border border-border bg-card" />
                </div>
            </div>
        </div>
    )
}
