import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import {
    getSnapshot,
    loadQuery,
    setRefetchInterval,
    subscribeQuery,
    type QuerySnapshot,
} from '../lib/dataClient'

export interface UseQueryOptions<T> {
    /** stable, unique cache key, e.g. `analytics:overview` */
    key: string
    fetcher: () => Promise<T>
    /** realtime topics that should invalidate this query */
    topics?: string[]
    /** how long cached data counts as fresh (ms) */
    staleTime?: number
    /** extra safety-net polling while mounted (ms, 0 = off) */
    refetchInterval?: number
    enabled?: boolean
    /** keep the previous key's data while a new key loads (search/pagination) */
    keepPreviousData?: boolean
}

export interface UseQueryResult<T> {
    data: T | undefined
    error: unknown
    /** true only on the very first load with nothing cached */
    isInitialLoading: boolean
    isFetching: boolean
    isStale: boolean
    updatedAt: number
    refetch: () => Promise<T | undefined>
}

/**
 * React binding for the shared data client.
 *
 * - paints cached data instantly, then revalidates in the background
 * - de-duplicates requests across components
 * - refetches automatically when a realtime event touches one of its topics
 */
export function useQuery<T>({
    key,
    fetcher,
    topics,
    staleTime = 15_000,
    refetchInterval,
    enabled = true,
    keepPreviousData = false,
}: UseQueryOptions<T>): UseQueryResult<T> {
    const snapshot: QuerySnapshot<T> = useSyncExternalStore(
        useCallback((listener) => subscribeQuery(key, listener), [key]),
        () => getSnapshot<T>(key),
        () => getSnapshot<T>(key)
    )

    // Keep the last successful payload around for paginated/filtered views so
    // the table never collapses to a skeleton between pages.
    const previousData = useRef<T | undefined>(undefined)
    if (snapshot.data !== undefined) previousData.current = snapshot.data

    const fetcherRef = useRef(fetcher)
    fetcherRef.current = fetcher

    const topicsKey = useMemo(() => (topics ? topics.join(',') : ''), [topics])

    const run = useCallback(
        (force: boolean) =>
            loadQuery<T>({
                key,
                fetcher: () => fetcherRef.current(),
                topics: topicsKey ? topicsKey.split(',') : undefined,
                staleTime,
                force,
            }),
        [key, staleTime, topicsKey]
    )

    useEffect(() => {
        if (!enabled) return
        void run(false)
    }, [enabled, run])

    useEffect(() => {
        if (!enabled || !refetchInterval) {
            setRefetchInterval(key, undefined, () => {})
            return
        }
        setRefetchInterval(key, refetchInterval, () => {
            void run(true)
        })
        return () => setRefetchInterval(key, undefined, () => {})
    }, [enabled, key, refetchInterval, run])

    const data = snapshot.data ?? (keepPreviousData ? previousData.current : undefined)

    return {
        data,
        error: snapshot.error,
        isInitialLoading: enabled && data === undefined && snapshot.isFetching,
        isFetching: snapshot.isFetching,
        isStale: snapshot.isStale,
        updatedAt: snapshot.updatedAt,
        refetch: () => run(true),
    }
}
