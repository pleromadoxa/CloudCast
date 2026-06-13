import { getSupabase, isSupabaseConfigured } from './supabase';
import type { ReplayCloudClip } from '../types/replay';

export type ReplayClipLifecycleStatus = 'active' | 'archived';

export interface ReplayLifecyclePrefs {
  autoArchiveDays: number | null;
  autoDeleteArchivedDays: number | null;
}

export interface ReplayLifecyclePolicyResult {
  archivedCount: number;
  deleteCandidateIds: string[];
}

function mapPrefs(row: Record<string, unknown>): ReplayLifecyclePrefs {
  return {
    autoArchiveDays: row.auto_archive_days != null ? Number(row.auto_archive_days) : null,
    autoDeleteArchivedDays: row.auto_delete_archived_days != null ? Number(row.auto_delete_archived_days) : null,
  };
}

function mapCloudClip(row: Record<string, unknown>): ReplayCloudClip {
  const tagsRaw = row.tags;
  const tags = Array.isArray(tagsRaw) ? tagsRaw.map(String) : [];
  return {
    id: String(row.id),
    userId: String(row.user_id),
    storagePath: String(row.storage_path),
    fileName: String(row.file_name),
    mimeType: String(row.mime_type ?? 'video/webm'),
    sizeBytes: Number(row.size_bytes ?? 0),
    durationSec: row.duration_sec != null ? Number(row.duration_sec) : null,
    inSec: row.in_sec != null ? Number(row.in_sec) : null,
    outSec: row.out_sec != null ? Number(row.out_sec) : null,
    sourceDeviceId: row.source_device_id ? String(row.source_device_id) : null,
    bankIndex: row.bank_index != null ? Number(row.bank_index) : null,
    label: row.label ? String(row.label) : null,
    tags,
    timecodeIn: row.timecode_in ? String(row.timecode_in) : null,
    timecodeOut: row.timecode_out ? String(row.timecode_out) : null,
    frameRate: row.frame_rate != null ? Number(row.frame_rate) : null,
    createdAt: String(row.created_at),
    lifecycleStatus: String(row.lifecycle_status ?? 'active') as ReplayClipLifecycleStatus,
    archivedAt: row.archived_at ? String(row.archived_at) : null,
  };
}

export async function fetchReplayLifecyclePrefs(): Promise<ReplayLifecyclePrefs | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await getSupabase().rpc('get_replay_lifecycle_prefs');
  if (error || !data) return null;
  return mapPrefs(data as Record<string, unknown>);
}

export async function saveReplayLifecyclePrefs(prefs: ReplayLifecyclePrefs): Promise<ReplayLifecyclePrefs> {
  if (!isSupabaseConfigured()) {
    throw new Error('Lifecycle policies require Regal Cloud sign-in.');
  }

  const { data, error } = await getSupabase().rpc('upsert_replay_lifecycle_prefs', {
    p_auto_archive_days: prefs.autoArchiveDays,
    p_auto_delete_archived_days: prefs.autoDeleteArchivedDays,
  });
  if (error) throw new Error(error.message);
  return mapPrefs(data as Record<string, unknown>);
}

export async function setReplayClipLifecycle(
  clipId: string,
  status: ReplayClipLifecycleStatus,
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const { error } = await getSupabase().rpc('set_replay_clip_lifecycle', {
    p_id: clipId,
    p_status: status,
  });
  if (error) throw new Error(error.message);
}

export async function applyReplayLifecyclePolicy(): Promise<ReplayLifecyclePolicyResult> {
  if (!isSupabaseConfigured()) {
    return { archivedCount: 0, deleteCandidateIds: [] };
  }

  const { data, error } = await getSupabase().rpc('apply_replay_lifecycle_policy');
  if (error) throw new Error(error.message);
  const row = (data ?? {}) as Record<string, unknown>;
  const idsRaw = row.delete_candidate_ids;
  const deleteCandidateIds = Array.isArray(idsRaw) ? idsRaw.map(String) : [];
  return {
    archivedCount: Number(row.archived_count ?? 0),
    deleteCandidateIds,
  };
}

export async function fetchReplayClipsByLifecycle(
  status: ReplayClipLifecycleStatus | null = 'active',
): Promise<ReplayCloudClip[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await getSupabase().rpc('list_user_replay_clips', {
    p_lifecycle_status: status,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapCloudClip);
}

export function parseArchiveDaysInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 7) return null;
  return Math.floor(n);
}

export function parseDeleteDaysInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 30) return null;
  return Math.floor(n);
}
