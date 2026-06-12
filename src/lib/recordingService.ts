import { getSupabase } from './supabase';
import type { MixerRecording, RecordingStorageUsage } from '../types/recording';

const BUCKET = 'mixer-recordings';

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

  const recordingId = crypto.randomUUID();
  const storagePath = `${user.id}/${recordingId}.webm`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, blob, { contentType: mimeType, upsert: false });
  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await supabase.rpc('register_mixer_recording', {
    p_storage_path: storagePath,
    p_file_name: fileName,
    p_mime_type: mimeType,
    p_size_bytes: blob.size,
    p_duration_sec: null,
    p_session_id: sessionId ?? null,
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => undefined);
    throw new Error(error.message);
  }

  return mapRecording(data as Record<string, unknown>);
}

export async function deleteMixerRecording(id: string): Promise<void> {
  const supabase = getSupabase();
  const { data: storagePath, error } = await supabase.rpc('delete_mixer_recording', { p_id: id });
  if (error) throw new Error(error.message);
  if (storagePath) {
    await supabase.storage.from(BUCKET).remove([String(storagePath)]);
  }
}

export async function getRecordingDownloadUrl(storagePath: string, expiresInSec = 3600): Promise<string> {
  const { data, error } = await getSupabase()
    .storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSec);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Could not create download link');
  return data.signedUrl;
}
