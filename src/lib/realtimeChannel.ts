import type { RealtimeChannelOptions } from '@supabase/supabase-js';

/** Per-session Supabase Realtime topic — dashboard and mobile must use the same name. */
export const SESSION_CHANNEL_PREFIX = 'cloudcast-';

export function sessionChannel(sessionId: string): string {
  return `${SESSION_CHANNEL_PREFIX}${sessionId}`;
}

/**
 * Resolve the canonical session channel name.
 * DB `realtime_channel` may be empty on legacy rows — always fall back to `cloudcast-{sessionId}`.
 */
export function resolveRealtimeChannelName(
  sessionId: string,
  realtimeChannel?: string | null,
): string {
  const fromDb = realtimeChannel?.trim();
  if (fromDb?.startsWith(SESSION_CHANNEL_PREFIX)) return fromDb;
  if (sessionId) return sessionChannel(sessionId);
  return fromDb ?? '';
}

/** Shared Realtime channel options for dashboard + mobile signaling/presence. */
export function buildSessionChannelConfig(presenceKey: string): RealtimeChannelOptions {
  return {
    config: {
      presence: { key: presenceKey },
      broadcast: { self: false },
    },
  };
}

const DASHBOARD_PRESENCE_STORAGE = 'cloudcast-dashboard-presence';

/** Stable dashboard presence key per session (survives soft reloads within the same tab). */
export function getDashboardPresenceKey(sessionId: string): string {
  const storageKey = `${DASHBOARD_PRESENCE_STORAGE}:${sessionId}`;
  try {
    const existing = sessionStorage.getItem(storageKey);
    if (existing) return existing;
    const id = `dashboard-${crypto.randomUUID().slice(0, 8)}`;
    sessionStorage.setItem(storageKey, id);
    return id;
  } catch {
    return `dashboard-${sessionId.slice(0, 8)}`;
  }
}
