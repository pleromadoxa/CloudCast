import { getSupabase, isSupabaseConfigured } from './supabase';
import { USER_MSG } from './userMessaging';
import type { MixerRecording, RecordingStorageUsage } from '../types/recording';

const LEGACY_BUCKET = 'mixer-recordings';

type R2Action = 'presign-upload' | 'presign-download' | 'delete';

interface R2PresignUploadResult {
  uploadUrl: string;
  storagePath: string;
}

async function invokeCloudcastR2<T>(action: R2Action, body: Record<string, unknown>): Promise<T> {
  if (!isSupabaseConfigured()) {
    throw new Error(USER_MSG.cloudStorageUnavailable);
  }

  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('You must be signed in to use cloud recordings.');
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

function mapRecording(row: Record<string, unknown>): MixerRecording {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    sessionId: row.session_id ? String(row.session_id) : null,
    storagePath: String(row.storage_path),
    fileName: String(row.file_name),
    mimeType: String(row.mime_type ?? 'video/webm'),
    sizeBytes: Number(row.size_bytes ?? 0),
    durationSec: row.duration_sec != null ? Number(row.duration_sec) : null,
    createdAt: String(row.created_at),
  };
}

export async function fetchRecordingStorageUsage(): Promise<RecordingStorageUsage> {
  const { data, error } = await getSupabase().rpc('get_recording_storage_usage');
  if (error) throw new Error(error.message);
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    usedBytes: Number(row.used_bytes ?? 0),
    quotaBytes: Number(row.quota_bytes ?? 0),
    remainingBytes: Number(row.remaining_bytes ?? 0),
  };
}

export async function fetchUserRecordings(): Promise<MixerRecording[]> {
  const { data, error } = await getSupabase().rpc('list_user_recordings');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapRecording);
}

export async function uploadMixerRecording(
  blob: Blob,
  fileName: string,
  mimeType: string,
  sessionId?: string | null,
): Promise<MixerRecording> {
  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('You must be signed in to save recordings.');

  const presigned = await invokeCloudcastR2<R2PresignUploadResult>('presign-upload', {
    mime_type: mimeType,
    size_bytes: blob.size,
  });

  const uploadRes = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body: blob,
  });
  if (!uploadRes.ok) {
    throw new Error(`${USER_MSG.cloudStorageUploadFailed} (${uploadRes.status})`);
  }

  const { data, error } = await supabase.rpc('register_mixer_recording', {
    p_storage_path: presigned.storagePath,
    p_file_name: fileName,
    p_mime_type: mimeType,
    p_size_bytes: blob.size,
    p_duration_sec: null,
    p_session_id: sessionId ?? null,
  });
  if (error) {
    await invokeCloudcastR2('delete', { storage_path: presigned.storagePath }).catch(() => undefined);
    throw new Error(error.message);
  }

  return mapRecording(data as Record<string, unknown>);
}

export async function deleteMixerRecording(id: string): Promise<void> {
  const supabase = getSupabase();
  const { data: storagePath, error } = await supabase.rpc('delete_mixer_recording', { p_id: id });
  if (error) throw new Error(error.message);
  if (!storagePath) return;

  const path = String(storagePath);
  try {
    await invokeCloudcastR2('delete', { storage_path: path });
  } catch {
    await supabase.storage.from(LEGACY_BUCKET).remove([path]).catch(() => undefined);
  }
}

export async function getRecordingDownloadUrl(storagePath: string, expiresInSec = 3600): Promise<string> {
  try {
    const { url } = await invokeCloudcastR2<{ url: string }>('presign-download', {
      storage_path: storagePath,
      file_name: storagePath.split('/').pop() ?? 'recording.webm',
    });
    if (url) return url;
  } catch {
    // Fall back to legacy Supabase Storage recordings
  }

  const { data, error } = await getSupabase()
    .storage
    .from(LEGACY_BUCKET)
    .createSignedUrl(storagePath, expiresInSec);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Could not create download link');
  return data.signedUrl;
}
