import { getSupabase, isSupabaseConfigured } from './supabase';
import { USER_MSG } from './userMessaging';
import type { ReplayCloudClip, ReplayStorageUsage } from '../types/replay';

type R2ReplayAction = 'replay-presign-upload' | 'replay-presign-download' | 'replay-delete';

interface R2PresignUploadResult {
  uploadUrl: string;
  storagePath: string;
  clipId: string;
}

async function invokeReplayR2<T>(action: R2ReplayAction, body: Record<string, unknown>): Promise<T> {
  if (!isSupabaseConfigured()) {
    throw new Error(USER_MSG.cloudStorageUnavailable);
  }

  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('You must be signed in to use Regal Cloud Clips.');
  }

  const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
  const res = await fetch(`${base}/functions/v1/cloudcast-r2`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
    },
    body: JSON.stringify({ action, ...body }),
  });

  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(String(payload.error ?? `${USER_MSG.cloudStorageRequestFailed} (${res.status})`));
  }
  return payload as T;
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
    lifecycleStatus: String(row.lifecycle_status ?? 'active') as ReplayCloudClip['lifecycleStatus'],
    archivedAt: row.archived_at ? String(row.archived_at) : null,
  };
}

export async function fetchReplayStorageUsage(): Promise<ReplayStorageUsage> {
  const { data, error } = await getSupabase().rpc('get_replay_storage_usage');
  if (error) throw new Error(error.message);
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    usedBytes: Number(row.used_bytes ?? 0),
    quotaBytes: Number(row.quota_bytes ?? 0),
    remainingBytes: Number(row.remaining_bytes ?? 0),
    clipCount: Number(row.clip_count ?? 0),
    totalUsedBytes: row.total_used_bytes != null ? Number(row.total_used_bytes) : undefined,
  };
}

export async function fetchUserReplayClips(lifecycleStatus: 'active' | 'archived' | null = 'active'): Promise<ReplayCloudClip[]> {
  const { data, error } = await getSupabase().rpc('list_user_replay_clips', {
    p_lifecycle_status: lifecycleStatus,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapCloudClip);
}

export async function uploadReplayClip(
  blob: Blob,
  fileName: string,
  mimeType: string,
  meta: {
    durationSec?: number;
    inSec?: number;
    outSec?: number;
    sourceDeviceId?: string;
    bankIndex?: number;
    label?: string;
    tags?: string[];
    timecodeIn?: string;
    timecodeOut?: string;
    frameRate?: number;
  } = {},
): Promise<ReplayCloudClip> {
  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('You must be signed in to save replay clips.');

  const presigned = await invokeReplayR2<R2PresignUploadResult>('replay-presign-upload', {
    mime_type: mimeType,
    size_bytes: blob.size,
    clip_id: crypto.randomUUID(),
  });

  const uploadRes = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body: blob,
  });
  if (!uploadRes.ok) {
    throw new Error(`${USER_MSG.cloudStorageUploadFailed} (${uploadRes.status})`);
  }

  const { data, error } = await supabase.rpc('register_replay_clip', {
    p_storage_path: presigned.storagePath,
    p_file_name: fileName,
    p_mime_type: mimeType,
    p_size_bytes: blob.size,
    p_duration_sec: meta.durationSec ?? null,
    p_in_sec: meta.inSec ?? null,
    p_out_sec: meta.outSec ?? null,
    p_source_device_id: meta.sourceDeviceId ?? null,
    p_bank_index: meta.bankIndex ?? null,
    p_label: meta.label ?? null,
    p_tags: meta.tags ?? [],
    p_timecode_in: meta.timecodeIn ?? null,
    p_timecode_out: meta.timecodeOut ?? null,
    p_frame_rate: meta.frameRate ?? 30,
  });
  if (error) {
    await invokeReplayR2('replay-delete', { storage_path: presigned.storagePath }).catch(() => undefined);
    throw new Error(error.message);
  }

  return mapCloudClip(data as Record<string, unknown>);
}

export async function deleteReplayClip(id: string): Promise<void> {
  const supabase = getSupabase();
  const { data: storagePath, error } = await supabase.rpc('delete_replay_clip', { p_id: id });
  if (error) throw new Error(error.message);
  if (!storagePath) return;

  await invokeReplayR2('replay-delete', { storage_path: String(storagePath) }).catch(() => undefined);
}

export async function getReplayClipDownloadUrl(storagePath: string, fileName?: string): Promise<string> {
  const { url } = await invokeReplayR2<{ url: string }>('replay-presign-download', {
    storage_path: storagePath,
    file_name: fileName ?? storagePath.split('/').pop() ?? 'replay-clip.webm',
  });
  if (!url) throw new Error('Could not create download link');
  return url;
}

export async function downloadReplayClipBlob(clip: ReplayCloudClip): Promise<Blob> {
  const url = await getReplayClipDownloadUrl(clip.storagePath, clip.fileName);
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not download replay clip from Regal Cloud.');
  return res.blob();
}

export function downloadBlobLocally(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
