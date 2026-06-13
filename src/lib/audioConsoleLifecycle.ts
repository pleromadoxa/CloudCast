import { getSupabase, isSupabaseConfigured } from './supabase';

export interface AudioLifecyclePrefs {
  pruneSnapshotDays: number | null;
  pruneBackupDays: number | null;
  autoApplyOnOpen: boolean;
  lastAppliedAt: string | null;
}

export interface AudioLifecyclePolicyResult {
  prunedSnapshotCount: number;
  prunedBackupCount: number;
}

function mapPrefs(row: Record<string, unknown>): AudioLifecyclePrefs {
  return {
    pruneSnapshotDays: row.prune_snapshot_days != null ? Number(row.prune_snapshot_days) : null,
    pruneBackupDays: row.prune_backup_days != null ? Number(row.prune_backup_days) : null,
    autoApplyOnOpen: Boolean(row.auto_apply_on_open),
    lastAppliedAt: row.last_applied_at ? String(row.last_applied_at) : null,
  };
}

export async function fetchAudioLifecyclePrefs(): Promise<AudioLifecyclePrefs | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await getSupabase().rpc('get_audio_lifecycle_prefs');
  if (error || !data) return null;
  return mapPrefs(data as Record<string, unknown>);
}

export async function saveAudioLifecyclePrefs(prefs: AudioLifecyclePrefs): Promise<AudioLifecyclePrefs> {
  if (!isSupabaseConfigured()) {
    throw new Error('Lifecycle policies require Regal Cloud sign-in.');
  }
  const { data, error } = await getSupabase().rpc('upsert_audio_lifecycle_prefs', {
    p_prune_snapshot_days: prefs.pruneSnapshotDays,
    p_prune_backup_days: prefs.pruneBackupDays,
    p_auto_apply_on_open: prefs.autoApplyOnOpen,
  });
  if (error) throw new Error(error.message);
  return mapPrefs(data as Record<string, unknown>);
}

export async function applyAudioLifecyclePolicy(): Promise<AudioLifecyclePolicyResult> {
  if (!isSupabaseConfigured()) {
    return { prunedSnapshotCount: 0, prunedBackupCount: 0 };
  }
  const { data, error } = await getSupabase().rpc('apply_audio_lifecycle_policy');
  if (error) throw new Error(error.message);
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    prunedSnapshotCount: Number(row.pruned_snapshot_count ?? 0),
    prunedBackupCount: Number(row.pruned_backup_count ?? 0),
  };
}

export async function maybeApplyAudioLifecyclePolicy(): Promise<{
  applied: boolean;
  reason?: string;
  prunedSnapshotCount?: number;
  prunedBackupCount?: number;
}> {
  if (!isSupabaseConfigured()) return { applied: false, reason: 'offline' };
  const { data, error } = await getSupabase().rpc('maybe_apply_audio_lifecycle_policy');
  if (error) return { applied: false, reason: error.message };
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    applied: Boolean(row.applied),
    reason: row.reason ? String(row.reason) : undefined,
    prunedSnapshotCount: row.pruned_snapshot_count != null ? Number(row.pruned_snapshot_count) : undefined,
    prunedBackupCount: row.pruned_backup_count != null ? Number(row.pruned_backup_count) : undefined,
  };
}

export function parsePruneDaysInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 7) return null;
  return Math.floor(n);
}
