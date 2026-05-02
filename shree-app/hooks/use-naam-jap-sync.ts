import { syncNaamJapCount } from '@/services/api';
import { useCallback, useEffect, useRef } from 'react';

const DEBOUNCE_MS = 350;
const INTERVAL_MS = 15000;

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
    // Use refs to always have latest values (avoids stale closures)
    const stateRef = useRef<SyncState>(state);
    const lastSyncedRef = useRef({ count: -1, malaCount: -1, todayCount: -1, todayMalas: -1 });
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const onSyncResultRef = useRef(onSyncResult);
    const inFlightRef = useRef(false);
    const pendingRef = useRef(false);

    // Keep refs up to date
    useEffect(() => {
        stateRef.current = state;
    }, [state.count, state.malaCount, state.todayCount, state.todayMalas]);

    useEffect(() => {
        onSyncResultRef.current = onSyncResult;
    }, [onSyncResult]);

    const doSync = useCallback(async () => {
        if (!deviceId) return;

        // Coalesce concurrent calls — if one is in flight, mark pending and bail
        if (inFlightRef.current) {
            pendingRef.current = true;
            return;
        }

        const current = stateRef.current;

        // Skip if nothing changed since last sync
        if (
            current.count === lastSyncedRef.current.count &&
            current.malaCount === lastSyncedRef.current.malaCount &&
            current.todayCount === lastSyncedRef.current.todayCount &&
            current.todayMalas === lastSyncedRef.current.todayMalas
        ) return;

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
                onSyncResultRef.current({
                    rank: result.response.rank,
                    totalUsers: result.response.totalUsers,
                });
            }
        } catch {
            // Silent fail
        } finally {
            inFlightRef.current = false;
            // If state changed while we were in-flight, fire one more sync immediately
            if (pendingRef.current) {
                pendingRef.current = false;
                // Fire-and-forget — keeps the chain going
                doSync();
            }
        }
    }, [deviceId]);

    // Debounced sync after each count change
    const debouncedSync = useCallback(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
            doSync();
        }, DEBOUNCE_MS);
    }, [doSync]);

    // Trigger debounced sync on any count change — fires after each tap (~350ms)
    useEffect(() => {
        if (state.count > 0 || state.malaCount > 0 || state.todayCount > 0 || state.todayMalas > 0) {
            debouncedSync();
        }
    }, [state.count, state.malaCount, state.todayCount, state.todayMalas, debouncedSync]);

    // Immediate sync on mala completion (no debounce — feels real-time)
    const lastMalaRef = useRef(state.malaCount);
    useEffect(() => {
        if (state.malaCount > lastMalaRef.current) {
            lastMalaRef.current = state.malaCount;
            doSync();
        }
    }, [state.malaCount, doSync]);

    // Force sync (skip the "nothing changed" check) for unmount
    const forceSyncRef = useRef(() => { });
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
            } catch { }
        };
    }, [deviceId]);

    // Periodic sync as safety net + sync on unmount
    useEffect(() => {
        intervalRef.current = setInterval(doSync, INTERVAL_MS);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            // Sync immediately on unmount so data is not lost
            forceSyncRef.current();
        };
    }, [doSync]);

    // Initial sync after mount
    useEffect(() => {
        if (deviceId) {
            const timer = setTimeout(doSync, 2000);
            return () => clearTimeout(timer);
        }
    }, [deviceId]);

    return { syncNow: doSync };
}
