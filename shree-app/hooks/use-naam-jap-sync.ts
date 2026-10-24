import { syncNaamJapCount } from '@/services/api';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

// Debounce after each tap so a fast-counting user produces ~3 requests/sec at
// worst, never one per tap.
const DEBOUNCE_MS = 350;
// Idle safety-net sync. Slows down when the screen is idle so a phone in a
// pocket is not burning battery hitting the API every 15 seconds.
const ACTIVE_INTERVAL_MS = 15_000;
const IDLE_INTERVAL_MS = 60_000;
// Failure backoff: 2s, 4s, 8s … capped, so a flaky network recovers quickly but
// does not hammer the server.
const BACKOFF_BASE_MS = 2_000;
const BACKOFF_MAX_MS = 60_000;

interface SyncState {
    count: number;
    malaCount: number;
    todayCount: number;
    todayMalas: number;
}

interface SyncResult {
    rank: number | null;
    totalUsers: number | null;
}

export function useNaamJapSync(
    deviceId: string | null,
    state: SyncState,
    onSyncResult: (result: SyncResult) => void
) {
    // Refs keep the callbacks stable and always up to date (no stale closures).
    const stateRef = useRef<SyncState>(state);
    const lastSyncedRef = useRef({ count: -1, malaCount: -1, todayCount: -1, todayMalas: -1 });
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const onSyncResultRef = useRef(onSyncResult);
    const inFlightRef = useRef(false);
    const pendingRef = useRef(false);
    const failuresRef = useRef(0);
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const appStateRef = useRef<AppStateStatus>(AppState.currentState);
    const lastActivityRef = useRef(Date.now());
    // Assigned below; declared first so timers can always call the latest sync.
    const doSyncRef = useRef<() => Promise<void>>(async () => {});

    useEffect(() => {
        stateRef.current = state;
    }, [state.count, state.malaCount, state.todayCount, state.todayMalas]);

    useEffect(() => {
        onSyncResultRef.current = onSyncResult;
    }, [onSyncResult]);

    const scheduleRetry = useCallback(() => {
        if (!deviceId) return;
        failuresRef.current += 1;
        const delay = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** (failuresRef.current - 1));
        const jitter = Math.random() * 400;
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            if (appStateRef.current === 'active') void doSyncRef.current();
        }, delay + jitter);
    }, [deviceId]);

    const doSync = useCallback(async () => {
        if (!deviceId) return;

        // Coalesce: if a request is already in flight, remember that another
        // sync is needed and return. We never drop a count change.
        if (inFlightRef.current) {
            pendingRef.current = true;
            return;
        }

        const current = stateRef.current;
        if (
            current.count === lastSyncedRef.current.count &&
            current.malaCount === lastSyncedRef.current.malaCount &&
            current.todayCount === lastSyncedRef.current.todayCount &&
            current.todayMalas === lastSyncedRef.current.todayMalas
        ) {
            return;
        }

        inFlightRef.current = true;
        try {
            const result = await syncNaamJapCount(
                deviceId,
                current.count,
                current.malaCount,
                current.todayCount,
                current.todayMalas
            );

            if (result.success && result.response) {
                lastSyncedRef.current = {
                    count: current.count,
                    malaCount: current.malaCount,
                    todayCount: current.todayCount,
                    todayMalas: current.todayMalas,
                };
                failuresRef.current = 0;
                onSyncResultRef.current({
                    rank: result.response.rank,
                    totalUsers: result.response.totalUsers,
                });
            } else {
                // Keep the local counters dirty → the next tick retries.
                scheduleRetry();
            }
        } catch {
            scheduleRetry();
        } finally {
            inFlightRef.current = false;
            if (pendingRef.current) {
                pendingRef.current = false;
                void doSync();
            }
        }
    }, [deviceId, scheduleRetry]);

    // keep a stable reference for timers and retries
    useEffect(() => {
        doSyncRef.current = doSync;
    }, [doSync]);

    // Debounced sync after each count change.
    const debouncedSync = useCallback(() => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            void doSync();
        }, DEBOUNCE_MS);
    }, [doSync]);

    useEffect(() => {
        if (state.count > 0 || state.malaCount > 0 || state.todayCount > 0 || state.todayMalas > 0) {
            lastActivityRef.current = Date.now();
            debouncedSync();
        }
    }, [state.count, state.malaCount, state.todayCount, state.todayMalas, debouncedSync]);

    // Immediate sync when a mala completes — the rank update feels instant.
    const lastMalaRef = useRef(state.malaCount);
    useEffect(() => {
        if (state.malaCount > lastMalaRef.current) {
            lastMalaRef.current = state.malaCount;
            void doSync();
        }
    }, [state.malaCount, doSync]);

    // Force sync that ignores the "nothing changed" check (used on background).
    const forceSyncRef = useRef(async () => {});
    useEffect(() => {
        forceSyncRef.current = async () => {
            if (!deviceId) return;
            const current = stateRef.current;
            try {
                await syncNaamJapCount(
                    deviceId,
                    current.count,
                    current.malaCount,
                    current.todayCount,
                    current.todayMalas
                );
                lastSyncedRef.current = {
                    count: current.count,
                    malaCount: current.malaCount,
                    todayCount: current.todayCount,
                    todayMalas: current.todayMalas,
                };
            } catch {
                // Nothing else we can do while the app is being backgrounded —
                // the next foreground sync will catch up.
            }
        };
    }, [deviceId]);

    // Adaptive interval: fast while the user is counting, slow when idle.
    const startInterval = useCallback(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        const idle = Date.now() - lastActivityRef.current > 2 * 60_000;
        const delay = idle ? IDLE_INTERVAL_MS : ACTIVE_INTERVAL_MS;
        intervalRef.current = setInterval(() => {
            if (appStateRef.current !== 'active') return;
            void doSync();
        }, delay);
    }, [doSync]);

    useEffect(() => {
        startInterval();
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
            // Flush on unmount so no tap is lost when leaving the screen.
            void forceSyncRef.current();
        };
    }, [startInterval]);

    // Pause in the background, flush on the way out, sync on return.
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (next) => {
            const previous = appStateRef.current;
            appStateRef.current = next;
            if (next === 'active' && previous !== 'active') {
                void doSync();
            }
            if ((next === 'background' || next === 'inactive') && previous === 'active') {
                void forceSyncRef.current();
            }
        });
        return () => subscription.remove();
    }, [doSync]);

    // Initial sync shortly after mount (gives auth a moment to settle).
    useEffect(() => {
        if (!deviceId) return;
        const timer = setTimeout(() => {
            void doSync();
        }, 1200);
        return () => clearTimeout(timer);
    }, [deviceId, doSync]);

    return { syncNow: doSync, forceSync: () => forceSyncRef.current() };
}
