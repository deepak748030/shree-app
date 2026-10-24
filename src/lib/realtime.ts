/**
 * Realtime client for the admin dashboard.
 *
 * Transport: Server-Sent Events (one HTTP/2 stream, native reconnection,
 * zero dependencies). If SSE cannot stay open — corporate proxies, a serverless
 * cold instance that drops long connections, or a bored firewall — the client
 * degrades to version polling: it asks the API for a tiny map of cache
 * versions and fires the same local events when a version moves. The UI code
 * does not know or care which transport is active.
 *
 * The client is a singleton so the whole dashboard shares one connection no
 * matter how many pages subscribe to events.
 */

export type RealtimeStatus = 'idle' | 'connecting' | 'live' | 'polling' | 'offline';

export interface RealtimeEvent {
    id: number;
    topic: string;
    type: string;
    at: string;
    data: Record<string, unknown>;
    /** injected for locally synthesised events (polling fallback) */
    synthetic?: boolean;
}

type EventHandler = (event: RealtimeEvent) => void;
type StatusHandler = (status: RealtimeStatus, info: { retries: number; transport: 'sse' | 'poll' }) => void;

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '/api';
const VERSION_POLL_MS = 15_000;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 20_000;
const MAX_SSE_FAILURES = 3;

class RealtimeClient {
    private source: EventSource | null = null;
    private status: RealtimeStatus = 'idle';
    private transport: 'sse' | 'poll' = 'sse';
    private readonly handlers = new Map<string, Set<EventHandler>>();
    private readonly statusHandlers = new Set<StatusHandler>();
    private readonly topics = new Set<string>();
    private retries = 0;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private pollTimer: ReturnType<typeof setInterval> | null = null;
    private versions: Record<string, number> = {};
    private lastEventId = 0;
    private lastMessageAt = 0;
    private started = false;
    private failures = 0;

    /** Called once after login. Safe to call repeatedly. */
    start(topics: string[] = []) {
        this.addTopics(topics);
        if (this.started) {
            this.ensureConnection();
            return;
        }
        this.started = true;
        this.ensureConnection();
    }

    stop() {
        this.started = false;
        this.closeSource();
        this.stopPolling();
        this.setStatus('idle');
    }

    addTopics(topics: string[]) {
        let changed = false;
        for (const topic of topics) {
            if (!this.topics.has(topic)) {
                this.topics.add(topic);
                changed = true;
            }
        }
        if (changed) this.ensureConnection();
    }

    removeTopics(topics: string[]) {
        let changed = false;
        for (const topic of topics) {
            if (this.topics.delete(topic)) changed = true;
        }
        if (changed) this.ensureConnection();
    }

    subscribe(topics: string | string[], handler: EventHandler) {
        const list = Array.isArray(topics) ? topics : [topics];
        for (const topic of list) {
            if (!this.handlers.has(topic)) this.handlers.set(topic, new Set());
            this.handlers.get(topic)!.add(handler);
        }
        this.addTopics(list);

        return () => {
            for (const topic of list) {
                const set = this.handlers.get(topic);
                if (!set) continue;
                set.delete(handler);
                if (set.size === 0) {
                    this.handlers.delete(topic);
                    this.removeTopics([topic]);
                }
            }
        };
    }

    onStatus(handler: StatusHandler): () => void {
        this.statusHandlers.add(handler);
        handler(this.status, { retries: this.retries, transport: this.transport });
        return () => this.statusHandlers.delete(handler);
    }

    getStatus() {
        return { status: this.status, retries: this.retries, transport: this.transport };
    }

    private setStatus(status: RealtimeStatus) {
        if (this.status === status) return;
        this.status = status;
        for (const handler of this.statusHandlers) {
            try {
                handler(status, { retries: this.retries, transport: this.transport });
            } catch (err) {
                console.error('[realtime] status handler failed', err);
            }
        }
    }

    private ensureConnection() {
        if (!this.started || typeof window === 'undefined') return;
        if (this.transport === 'poll') {
            this.startPolling();
            return;
        }
        if (this.source) return;
        this.connect();
    }

    private closeSource() {
        if (this.source) {
            this.source.onmessage = null;
            this.source.onerror = null;
            this.source.onopen = null;
            try {
                this.source.close();
            } catch {
                /* already closed */
            }
            this.source = null;
        }
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    private connect() {
        if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
            this.startPolling();
            return;
        }
        this.setStatus('connecting');
        const token = localStorage.getItem('admin_token') || '';
        const params = new URLSearchParams();
        if (this.topics.size > 0) params.set('topics', [...this.topics].join(','));
        if (token) params.set('token', token);
        params.set('t', String(Date.now()));

        let source: EventSource;
        try {
            source = new EventSource(`${API_BASE}/realtime/stream?${params.toString()}`);
        } catch (err) {
            console.error('[realtime] EventSource failed to start', err);
            this.scheduleReconnect();
            return;
        }
        this.source = source;

        source.onopen = () => {
            this.retries = 0;
            this.failures = 0;
            this.lastMessageAt = Date.now();
            this.setStatus('live');
        };

        source.onmessage = (message) => {
            this.lastMessageAt = Date.now();
            this.handleRaw(message.data, Number(message.lastEventId) || 0);
        };

        source.onerror = () => {
            // When the browser is between retries we prefer to own the
            // reconnection (backoff + polling fallback), so close it.
            this.closeSource();
            this.failures += 1;
            if (this.failures >= MAX_SSE_FAILURES) {
                console.warn('[realtime] SSE unavailable, switching to version polling');
                this.transport = 'poll';
                this.setStatus('polling');
                this.startPolling();
                return;
            }
            this.setStatus('connecting');
            this.scheduleReconnect();
        };
    }

    private scheduleReconnect() {
        if (!this.started) return;
        this.retries += 1;
        const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** (this.retries - 1));
        const jitter = Math.random() * 300;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, delay + jitter);
    }

    private handleRaw(raw: string, id: number) {
        let event: RealtimeEvent;
        try {
            event = JSON.parse(raw) as RealtimeEvent;
        } catch {
            return;
        }
        if (id) this.lastEventId = id;
        if (event.topic === 'system') {
            if (event.type === 'heartbeat') return;
            if (event.type === 'ready') {
                this.setStatus('live');
                return;
            }
        }
        this.dispatch(event);
    }

    private dispatch(event: RealtimeEvent) {
        const targets = new Set<EventHandler>();
        for (const handler of this.handlers.get(event.topic) || []) targets.add(handler);
        for (const handler of this.handlers.get('*') || []) targets.add(handler);

        for (const handler of targets) {
            try {
                handler(event);
            } catch (err) {
                console.error('[realtime] handler failed', err);
            }
        }
    }

    // ---- polling fallback -------------------------------------------------

    private startPolling() {
        if (this.pollTimer) return;
        this.setStatus('polling');
        void this.checkVersions(true);
        this.pollTimer = setInterval(() => {
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
            void this.checkVersions(false);
        }, VERSION_POLL_MS);
    }

    private stopPolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    private async checkVersions(initial: boolean) {
        try {
            const response = await fetch(`${API_BASE}/realtime/version`, {
                headers: { Accept: 'application/json' },
                cache: 'no-store',
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const payload = await response.json();
            const versions = (payload?.response?.versions || {}) as Record<string, number>;
            const serverTime = payload?.response?.serverTime || new Date().toISOString();

            if (initial) {
                this.versions = versions;
                return;
            }

            const changed: string[] = [];
            for (const [ns, version] of Object.entries(versions)) {
                if (this.versions[ns] !== version) changed.push(ns);
            }
            this.versions = versions;
            if (changed.length > 0) {
                this.setStatus('polling');
                for (const ns of changed) {
                    this.dispatch({
                        id: 0,
                        topic: ns,
                        type: 'version-changed',
                        at: serverTime,
                        data: { version: versions[ns] },
                        synthetic: true,
                    });
                }
            }
        } catch {
            this.setStatus('offline');
        }
    }

    // ---- introspection ----------------------------------------------------

    getInfo() {
        return {
            status: this.status,
            transport: this.transport,
            topics: [...this.topics],
            lastEventId: this.lastEventId,
            connectedForMs: this.lastMessageAt ? Date.now() - this.lastMessageAt : 0,
            retries: this.retries,
        };
    }
}

export const realtime = new RealtimeClient();

/** Namespaces the dashboard depends on by default. */
export const DASHBOARD_TOPICS = [
    'analytics',
    'users',
    'quotes',
    'content',
    'plans',
    'subscriptions',
    'rewards',
    'withdrawals',
    'referrals',
    'settings',
    'versions',
    'notifications',
];

export function startRealtime() {
    // '*' = every topic. The dashboard is admin-only, and the server rejects a
    // wildcard subscription without a valid admin token.
    realtime.start(['*']);
}

export function stopRealtime() {
    realtime.stop();
}
