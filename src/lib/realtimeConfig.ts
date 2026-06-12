import type { RealtimeClientOptions } from '@supabase/realtime-js';

/** Push/join timeout — Supabase default 10s is too aggressive on slow or waking networks. */
export const REALTIME_PUSH_TIMEOUT_MS = 25_000;

/** Phoenix heartbeat interval (library default is 30s). */
export const REALTIME_HEARTBEAT_INTERVAL_MS = 25_000;

/** How often the dashboard probes session channel health. */
export const REALTIME_HEALTH_CHECK_MS = 20_000;

/** Minimum gap between proactive recovery passes (heartbeat + health poll). */
export const REALTIME_RECOVER_COOLDOWN_MS = 4_000;

type RecoveryListener = () => void;
const recoveryListeners = new Set<RecoveryListener>();
let lastRecoveryNotifyAt = 0;

/** Register a handler when the Realtime transport reports timeout/disconnect. */
export function onRealtimeRecoveryNeeded(listener: RecoveryListener): () => void {
  recoveryListeners.add(listener);
  return () => recoveryListeners.delete(listener);
}

export function notifyRealtimeRecoveryNeeded(): void {
  const now = Date.now();
  if (now - lastRecoveryNotifyAt < REALTIME_RECOVER_COOLDOWN_MS) return;
  lastRecoveryNotifyAt = now;
  for (const listener of recoveryListeners) {
    listener();
  }
}

export function realtimeRetryDelayMs(attempt: number, fast = false): number {
  if (fast) return 2_000;
  return Math.min(30_000, 1000 * 2 ** Math.min(Math.max(attempt, 1), 6));
}

export function buildRealtimeClientOptions(): RealtimeClientOptions {
  return {
    params: { eventsPerSecond: 50 },
    timeout: REALTIME_PUSH_TIMEOUT_MS,
    heartbeatIntervalMs: REALTIME_HEARTBEAT_INTERVAL_MS,
    reconnectAfterMs: (tries) => realtimeRetryDelayMs(tries + 1),
    worker: typeof Worker !== 'undefined',
    heartbeatCallback: (status) => {
      if (status === 'timeout' || status === 'disconnected') {
        notifyRealtimeRecoveryNeeded();
      }
    },
  };
}
