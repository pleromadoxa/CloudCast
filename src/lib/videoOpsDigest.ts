import { getSupabase, isSupabaseConfigured } from './supabase';

export type VideoOpsDigestFrequency = 'manual' | 'daily' | 'weekly';

export interface VideoOpsDigestPrefs {
  enabled: boolean;
  frequency: VideoOpsDigestFrequency;
  lastSentAt: string | null;
}

function mapPrefs(row: Record<string, unknown>): VideoOpsDigestPrefs {
  return {
    enabled: Boolean(row.enabled),
    frequency: String(row.frequency ?? 'manual') as VideoOpsDigestFrequency,
    lastSentAt: row.last_sent_at ? String(row.last_sent_at) : null,
  };
}

export async function fetchVideoOpsDigestPrefs(): Promise<VideoOpsDigestPrefs | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await getSupabase().rpc('get_video_ops_digest_prefs');
  if (error || !data) return null;
  return mapPrefs(data as Record<string, unknown>);
}

export async function saveVideoOpsDigestPrefs(
  enabled: boolean,
  frequency: VideoOpsDigestFrequency,
): Promise<VideoOpsDigestPrefs> {
  if (!isSupabaseConfigured()) throw new Error('Ops digest requires Regal Cloud sign-in.');
  const { data, error } = await getSupabase().rpc('upsert_video_ops_digest_prefs', {
    p_enabled: enabled,
    p_frequency: frequency,
  });
  if (error) throw new Error(error.message);
  return mapPrefs(data as Record<string, unknown>);
}

export async function enqueueVideoOpsDigest(): Promise<{ queued: boolean; reason?: string }> {
  if (!isSupabaseConfigured()) throw new Error('Ops digest requires Regal Cloud sign-in.');
  const { data, error } = await getSupabase().rpc('enqueue_video_ops_digest');
  if (error) throw new Error(error.message);
  const row = (data ?? {}) as Record<string, unknown>;
  return { queued: Boolean(row.queued), reason: row.reason ? String(row.reason) : undefined };
}

/** Sends digest when daily/weekly schedule is due (call on dashboard mount). */
export async function maybeSendScheduledVideoOpsDigest(): Promise<{ queued: boolean; reason?: string }> {
  if (!isSupabaseConfigured()) return { queued: false, reason: 'offline' };
  const { data, error } = await getSupabase().rpc('maybe_send_scheduled_video_ops_digest');
  if (error) return { queued: false, reason: error.message };
  const row = (data ?? {}) as Record<string, unknown>;
  return { queued: Boolean(row.queued), reason: row.reason ? String(row.reason) : undefined };
}

export function digestFrequencyLabel(frequency: VideoOpsDigestFrequency): string {
  if (frequency === 'daily') return 'Daily';
  if (frequency === 'weekly') return 'Weekly';
  return 'Manual only';
}
