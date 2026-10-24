/**
 * Connects the realtime event stream to the data cache.
 *
 * Every incoming event invalidates exactly the queries tagged with that topic
 * (they refetch in the background while the old data stays on screen). After a
 * reconnect we invalidate everything once, because events that happened while
 * the socket was down can never arrive.
 */
import { invalidateAll, invalidateTopic } from './dataClient'
import { realtime, type RealtimeStatus } from './realtime'

let unsubscribeEvents: (() => void) | null = null
let unsubscribeStatus: (() => void) | null = null
let lastStatus: RealtimeStatus = 'idle'

export function bridgeRealtime() {
    if (unsubscribeEvents) return

    unsubscribeEvents = realtime.subscribe('*', (event) => {
        if (event.topic === 'system') {
            if (event.type === 'cache-flushed') invalidateAll({ refetch: true })
            return
        }
        invalidateTopic(event.topic, { refetch: true })
    })

    unsubscribeStatus = realtime.onStatus((status) => {
        const wasDisconnected = lastStatus === 'polling' || lastStatus === 'offline' || lastStatus === 'connecting'
        if (wasDisconnected && (status === 'live' || status === 'polling')) {
            // Catch up on everything that changed while we were away.
            invalidateAll({ refetch: true })
        }
        lastStatus = status
    })
}

export function unbridgeRealtime() {
    unsubscribeEvents?.()
    unsubscribeStatus?.()
    unsubscribeEvents = null
    unsubscribeStatus = null
    lastStatus = 'idle'
}
