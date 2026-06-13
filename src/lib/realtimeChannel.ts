import type { RealtimeChannel, RealtimeChannelOptions } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from './supabase';

/** Fully tear down a Realtime channel before reusing its topic name. */
export async function removeRealtimeChannel(channel: RealtimeChannel | null): Promise<void> {
  if (!channel) return;
  if (isSupabaseConfigured()) {
    await getSupabase().removeChannel(channel);
    return;
  }
  await channel.unsubscribe();
}

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

/** Find an active Supabase Realtime channel for a session topic, if any. */
export function findSessionChannel(
  sessionId: string,
  realtimeChannel?: string | null,
): RealtimeChannel | undefined {
  const channelName = resolveRealtimeChannelName(sessionId, realtimeChannel);
  const topic = `realtime:${channelName}`;
  return getSupabase().getChannels().find((c) => c.topic === topic);
}

/**
 * Remove any Realtime channel registered under the session topic.
 * Supabase returns an existing joined channel from `channel()` — presence handlers
 * cannot be attached after subscribe, so signaling must start from a clean topic.
 */
export async function removeSessionChannelByName(
  sessionId: string,
  realtimeChannel?: string | null,
): Promise<void> {
  await removeRealtimeChannel(findSessionChannel(sessionId, realtimeChannel) ?? null);
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
