/**
 * Tiny stale-while-revalidate data client.
 *
 * Why not React Query? This dashboard ships to a single small bundle where an
 * extra 12 kB of state machine is not worth it — but we still need every
 * property that makes an admin panel feel instant:
 *
 *  • one shared cache → navigating back to a page paints immediately
 *  • request de-duplication → 6 components asking for analytics = 1 request
 *  • stale-while-revalidate → cached data is shown while a background refresh
 *    runs, so the UI never flashes a spinner over data it already has
 *  • topic-aware invalidation → a realtime event invalidates exactly the
 *    queries that depend on it, not the whole cache
 *  • refetch on focus / reconnect → numbers are right when you come back to
 *    the tab, without polling while it is hidden
 *
 * The store is framework agnostic; `src/hooks/useQuery.ts` binds it to React.
 */

export type Unsubscribe = () => void;

export interface QuerySnapshot<T> {
    data: T | undefined;
    error: unknown;
    updatedAt: number;
    isFetching: boolean;
    isStale: boolean;
}

interface Entry<T = unknown> {
    key: string;
    data?: T;
    error: unknown;
    updatedAt: number;
    isFetching: boolean;
    fetcher?: () => Promise<T>;
    staleTime: number;
    topics: string[];
    listeners: Set<() => void>;
    snapshot: QuerySnapshot<T>;
    promise?: Promise<T>;
    refetchInterval?: number;
    timer?: ReturnType<typeof setInterval>;
}

const entries = new Map<string, Entry>();
const topicIndex = new Map<string, Set<string>>();

const EMPTY_SNAPSHOT: QuerySnapshot<never> = Object.freeze({
    data: undefined,
    error: null,
    updatedAt: 0,
    isFetching: false,
    isStale: true,
});

function createEntry(key: string): Entry {
    const entry: Entry = {
        key,
        error: null,
        updatedAt: 0,
        isFetching: false,
        staleTime: 15_000,
        topics: [],
        listeners: new Set(),
        snapshot: { ...EMPTY_SNAPSHOT } as QuerySnapshot<unknown>,
    };
    entries.set(key, entry);
    return entry;
}

function publish(entry: Entry) {
    const isStale = entry.updatedAt === 0 || Date.now() - entry.updatedAt > entry.staleTime;
    entry.snapshot = {
        data: entry.data,
        error: entry.error,
        updatedAt: entry.updatedAt,
        isFetching: entry.isFetching,
        isStale,
    };
    for (const listener of entry.listeners) {
        try {
            listener();
        } catch (err) {
            console.error('[data] listener failed', err);
        }
    }
}

function linkTopics(entry: Entry, topics: string[]) {
    for (const topic of entry.topics) {
        if (topics.includes(topic)) continue;
        topicIndex.get(topic)?.delete(entry.key);
    }
    entry.topics = [...new Set(topics)];
    for (const topic of entry.topics) {
        if (!topicIndex.has(topic)) topicIndex.set(topic, new Set());
        topicIndex.get(topic)!.add(entry.key);
    }
}

export function getSnapshot<T = unknown>(key: string): QuerySnapshot<T> {
    return (entries.get(key)?.snapshot as QuerySnapshot<T>) || (EMPTY_SNAPSHOT as unknown as QuerySnapshot<T>);
}

export function subscribeQuery(key: string, listener: () => void): Unsubscribe {
    const entry = entries.get(key) || createEntry(key);
    entry.listeners.add(listener);
    return () => {
        entry.listeners.delete(listener);
    };
}

export interface FetchOptions<T> {
    key: string;
    fetcher: () => Promise<T>;
    /** ms during which cached data is considered fresh */
    staleTime?: number;
    /** realtime topics that should invalidate this query */
    topics?: string[];
    /** ignore cache freshness and hit the API */
    force?: boolean;
}

async function run(entry: Entry, fetcher: () => Promise<unknown>) {
    if (entry.promise) return entry.promise;
    entry.isFetching = true;
    publish(entry);

    const promise = Promise.resolve()
        .then(fetcher)
        .then((data) => {
            entry.data = data;
            entry.error = null;
            entry.updatedAt = Date.now();
            return data;
        })
        .catch((error) => {
            entry.error = error;
            throw error;
        })
        .finally(() => {
            entry.isFetching = false;
            entry.promise = undefined;
            publish(entry);
        });

    entry.promise = promise;
    return promise;
}

/**
 * Ensure a query is loaded (from cache when fresh). Safe to call from render
 * effects and from realtime handlers — concurrent calls share one promise.
 */
export function loadQuery<T>(options: FetchOptions<T>): Promise<T | undefined> {
    const { key, fetcher, staleTime = 15_000, topics, force = false } = options;
    const entry = (entries.get(key) as Entry<T>) || (createEntry(key) as Entry<T>);

    entry.fetcher = fetcher as () => Promise<T>;
    entry.staleTime = staleTime;
    if (topics) linkTopics(entry, topics);

    const fresh = entry.data !== undefined && Date.now() - entry.updatedAt < staleTime;
    if (fresh && !force) return Promise.resolve(entry.data);

    return run(entry, fetcher as () => Promise<unknown>)
        .then((data) => data as T)
        .catch(() => entry.data as T | undefined);
}

/** Force a background refresh (keeps the previous data on screen). */
export function refreshQuery<T>(options: FetchOptions<T>): Promise<T | undefined> {
    return loadQuery({ ...options, force: true });
}

export function setQueryData<T>(key: string, updater: (previous: T | undefined) => T) {
    const entry = (entries.get(key) as Entry<T>) || (createEntry(key) as Entry<T>);
    entry.data = updater(entry.data);
    entry.error = null;
    entry.updatedAt = Date.now();
    publish(entry);
}

/**
 * Mark queries stale. Entries that are currently mounted are refetched in the
 * background so the person looking at the screen sees fresh numbers within a
 * frame or two; unmounted entries simply reload on next mount.
 */
export function invalidate(
    matcher: (key: string) => boolean,
    options: { refetch?: boolean } = {}
): number {
    const { refetch = true } = options;
    let touched = 0;
    for (const entry of entries.values()) {
        if (!matcher(entry.key)) continue;
        touched += 1;
        entry.updatedAt = 0;
        publish(entry);

        if (refetch && entry.listeners.size > 0 && entry.fetcher) {
            run(entry, entry.fetcher).catch(() => {
                /* surfaced through the snapshot error */
            });
        }
    }
    return touched;
}

export function invalidateTopic(topic: string, options?: { refetch?: boolean }): number {
    const keys = topicIndex.get(topic);
    if (!keys || keys.size === 0) return 0;
    const keySet = new Set(keys);
    return invalidate((key) => keySet.has(key), options);
}

export function invalidateKey(key: string, options?: { refetch?: boolean }) {
    return invalidate((k) => k === key, options);
}

export function invalidateAll(options?: { refetch?: boolean }) {
    return invalidate(() => true, options);
}

export function removeQuery(key: string) {
    const entry = entries.get(key);
    if (!entry) return;
    if (entry.timer) clearInterval(entry.timer);
    for (const topic of entry.topics) topicIndex.get(topic)?.delete(key);
    entries.delete(key);
}

export function setRefetchInterval(key: string, intervalMs: number | undefined, refetch: () => void) {
    const entry = entries.get(key) || createEntry(key);
    if (entry.timer) {
        clearInterval(entry.timer);
        entry.timer = undefined;
    }
    entry.refetchInterval = intervalMs;
    if (intervalMs && intervalMs > 0) {
        entry.timer = setInterval(() => {
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
            refetch();
        }, intervalMs);
    }
}

let installed = false;

/**
 * Refetch stale queries when the tab regains focus or the network comes back.
 * Installed once from `<App/>`.
 */
export function installGlobalListeners() {
    if (installed || typeof window === 'undefined') return;
    installed = true;

    const revalidate = () => {
        for (const entry of entries.values()) {
            if (entry.listeners.size === 0) continue;
            const stale = Date.now() - entry.updatedAt > entry.staleTime;
            if (stale && entry.fetcher) {
                run(entry, entry.fetcher).catch(() => {});
            }
        }
    };

    window.addEventListener('focus', revalidate);
    window.addEventListener('online', revalidate);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') revalidate();
    });
}

/** Diagnostics for the settings page / debugging in production. */
export function cacheStats() {
    let mounted = 0;
    let inflight = 0;
    for (const entry of entries.values()) {
        if (entry.listeners.size > 0) mounted += 1;
        if (entry.promise) inflight += 1;
    }
    return { keys: entries.size, mounted, inflight };
}

export function clearCache() {
    for (const entry of entries.values()) {
        if (entry.timer) clearInterval(entry.timer);
    }
    entries.clear();
    topicIndex.clear();
}
