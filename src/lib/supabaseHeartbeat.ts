import { getSupabase, isSupabaseConfigured } from './supabase';

export interface HeartbeatResult {
  ok: boolean;
  at?: string;
  pingCount?: number;
  error?: string;
}

/** Lightweight DB ping — keeps free-tier Supabase projects from pausing due to inactivity. */
export async function pingSupabase(source = 'client'): Promise<HeartbeatResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'Supabase is not configured.' };
  }

  try {
    const { data, error } = await getSupabase().rpc('cloudcast_heartbeat', { p_source: source });

    if (error) {
      return { ok: false, error: error.message };
    }

    const payload = data as { ok?: boolean; at?: string; ping_count?: number } | null;
    return {
      ok: Boolean(payload?.ok),
      at: payload?.at,
      pingCount: payload?.ping_count,
      error: payload?.ok ? undefined : 'Heartbeat returned unexpected response.',
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Heartbeat request failed.',
    };
  }
}
