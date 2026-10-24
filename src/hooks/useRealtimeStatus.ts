import { useEffect, useState } from 'react'
import { realtime, type RealtimeStatus } from '../lib/realtime'

interface Info {
    retries: number
    transport: 'sse' | 'poll'
}

/**
 * Live connection badge state. Subscribes to the singleton client, so ten
 * components can use it without creating ten connections.
 */
export function useRealtimeStatus() {
    const [status, setStatus] = useState<RealtimeStatus>(realtime.getStatus().status)
    const [info, setInfo] = useState<Info>({
        retries: realtime.getStatus().retries,
        transport: realtime.getStatus().transport,
    })

    useEffect(() => {
        const unsubscribe = realtime.onStatus((next, detail) => {
            setStatus(next)
            setInfo({ retries: detail.retries, transport: detail.transport })
        })
        return unsubscribe
    }, [])

    const isLive = status === 'live'
    const label =
        status === 'live'
            ? 'Live'
            : status === 'polling'
                ? 'Polling'
                : status === 'connecting'
                    ? 'Connecting'
                    : status === 'offline'
                        ? 'Offline'
                        : 'Paused'

    return { status, label, isLive, transport: info.transport, retries: info.retries }
}
