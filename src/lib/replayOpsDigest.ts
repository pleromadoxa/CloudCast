import { getSupabase, isSupabaseConfigured } from './supabase';

export type ReplayOpsDigestFrequency = 'manual' | 'daily' | 'weekly';

export interface ReplayOpsDigestPrefs {
  enabled: boolean;
  frequency: ReplayOpsDigestFrequency;
  lastSentAt: string | null;
}

function mapPrefs(row: Record<string, unknown>): ReplayOpsDigestPrefs {
  return {
    enabled: Boolean(row.enabled),
    frequency: String(row.frequency ?? 'manual') as ReplayOpsDigestFrequency,
    lastSentAt: row.last_sent_at ? String(row.last_sent_at) : null,
  };
}

export async function fetchReplayOpsDigestPrefs(): Promise<ReplayOpsDigestPrefs | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await getSupabase().rpc('get_replay_ops_digest_prefs');
  if (error || !data) return null;
  return mapPrefs(data as Record<string, unknown>);
}

export async function saveReplayOpsDigestPrefs(
  enabled: boolean,
  frequency: ReplayOpsDigestFrequency,
): Promise<ReplayOpsDigestPrefs> {
  if (!isSupabaseConfigured()) {
    throw new Error('Ops digest requires Regal Cloud sign-in.');
  }

  const { data, error } = await getSupabase().rpc('upsert_replay_ops_digest_prefs', {
    p_enabled: enabled,
    p_frequency: frequency,
  });
  if (error) throw new Error(error.message);
  return mapPrefs(data as Record<string, unknown>);
}

export interface ReplayOpsDigestResult {
  queued: boolean;
  reason?: string;
}

export async function enqueueReplayOpsDigest(): Promise<ReplayOpsDigestResult> {
  if (!isSupabaseConfigured()) {
    throw new Error('Ops digest requires Regal Cloud sign-in.');
  }

  const { data, error } = await getSupabase().rpc('enqueue_replay_ops_digest');
  if (error) throw new Error(error.message);
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    queued: Boolean(row.queued),
    reason: row.reason ? String(row.reason) : undefined,
  };
}

export function digestFrequencyLabel(frequency: ReplayOpsDigestFrequency): string {
  switch (frequency) {
    case 'daily':
      return 'Daily';
    case 'weekly':
      return 'Weekly';
    default:
      return 'Manual only';
  }
}
