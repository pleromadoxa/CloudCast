import { getSupabase, isSupabaseConfigured } from './supabase';

export type AudioOpsDigestFrequency = 'manual' | 'daily' | 'weekly';

export interface AudioOpsDigestPrefs {
  enabled: boolean;
  frequency: AudioOpsDigestFrequency;
  lastSentAt: string | null;
}

function mapPrefs(row: Record<string, unknown>): AudioOpsDigestPrefs {
  return {
    enabled: Boolean(row.enabled),
    frequency: String(row.frequency ?? 'manual') as AudioOpsDigestFrequency,
    lastSentAt: row.last_sent_at ? String(row.last_sent_at) : null,
  };
}

export async function fetchAudioOpsDigestPrefs(): Promise<AudioOpsDigestPrefs | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await getSupabase().rpc('get_audio_ops_digest_prefs');
  if (error || !data) return null;
  return mapPrefs(data as Record<string, unknown>);
}

export async function saveAudioOpsDigestPrefs(
  enabled: boolean,
  frequency: AudioOpsDigestFrequency,
): Promise<AudioOpsDigestPrefs> {
  if (!isSupabaseConfigured()) throw new Error('Ops digest requires Regal Cloud sign-in.');
  const { data, error } = await getSupabase().rpc('upsert_audio_ops_digest_prefs', {
    p_enabled: enabled,
    p_frequency: frequency,
  });
  if (error) throw new Error(error.message);
  return mapPrefs(data as Record<string, unknown>);
}

export async function enqueueAudioOpsDigest(): Promise<{ queued: boolean; reason?: string }> {
  if (!isSupabaseConfigured()) throw new Error('Ops digest requires Regal Cloud sign-in.');
  const { data, error } = await getSupabase().rpc('enqueue_audio_ops_digest');
  if (error) throw new Error(error.message);
  const row = (data ?? {}) as Record<string, unknown>;
  return { queued: Boolean(row.queued), reason: row.reason ? String(row.reason) : undefined };
}

/** Sends digest when daily/weekly schedule is due (call on console mount). */
export async function maybeSendScheduledAudioOpsDigest(): Promise<{ queued: boolean; reason?: string }> {
  if (!isSupabaseConfigured()) return { queued: false, reason: 'offline' };
  const { data, error } = await getSupabase().rpc('maybe_send_scheduled_audio_ops_digest');
  if (error) return { queued: false, reason: error.message };
  const row = (data ?? {}) as Record<string, unknown>;
  return { queued: Boolean(row.queued), reason: row.reason ? String(row.reason) : undefined };
}

export function digestFrequencyLabel(frequency: AudioOpsDigestFrequency): string {
  if (frequency === 'daily') return 'Daily';
  if (frequency === 'weekly') return 'Weekly';
  return 'Manual only';
}
