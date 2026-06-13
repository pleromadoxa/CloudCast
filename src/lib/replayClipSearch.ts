import { getSupabase, isSupabaseConfigured } from './supabase';
import type { ReplayCloudClip } from '../types/replay';

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
  };
}

export async function searchReplayClips(
  query: string,
  tag?: string,
  limit = 50,
): Promise<ReplayCloudClip[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await getSupabase().rpc('search_replay_clips', {
    p_query: query.trim() || null,
    p_tag: tag?.trim() || null,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapCloudClip);
}
