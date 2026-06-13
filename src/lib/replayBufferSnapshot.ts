import { getSupabase, isSupabaseConfigured } from './supabase';
import type { ReplaySourceKind } from '../types/replay';

export interface ReplayBufferSnapshot {
  id: string;
  sessionId: string;
  operatorKey: string | null;
  operatorLabel: string | null;
  sourceKind: string | null;
  bufferSeconds: number;
  chunkCount: number;
  markInSec: number | null;
  markOutSec: number | null;
  markTimecodeIn: string | null;
  markTimecodeOut: string | null;
  houseClockSmpte: string | null;
  isRecording: boolean;
  capturedAt: string;
}

function mapSnapshot(row: Record<string, unknown>): ReplayBufferSnapshot {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    operatorKey: row.operator_key ? String(row.operator_key) : null,
    operatorLabel: row.operator_label ? String(row.operator_label) : null,
    sourceKind: row.source_kind ? String(row.source_kind) : null,
    bufferSeconds: Number(row.buffer_seconds ?? 0),
    chunkCount: Number(row.chunk_count ?? 0),
    markInSec: row.mark_in_sec != null ? Number(row.mark_in_sec) : null,
    markOutSec: row.mark_out_sec != null ? Number(row.mark_out_sec) : null,
    markTimecodeIn: row.mark_timecode_in ? String(row.mark_timecode_in) : null,
    markTimecodeOut: row.mark_timecode_out ? String(row.mark_timecode_out) : null,
    houseClockSmpte: row.house_clock_smpte ? String(row.house_clock_smpte) : null,
    isRecording: Boolean(row.is_recording),
    capturedAt: String(row.captured_at),
  };
}

export interface SaveReplayBufferSnapshotInput {
  sessionId: string;
  operatorKey?: string;
  operatorLabel?: string;
  sourceKind?: ReplaySourceKind;
  bufferSeconds: number;
  chunkCount: number;
  markInSec?: number | null;
  markOutSec?: number | null;
  markTimecodeIn?: string | null;
  markTimecodeOut?: string | null;
  houseClockSmpte?: string | null;
  isRecording: boolean;
}

export async function saveReplayBufferSnapshot(input: SaveReplayBufferSnapshotInput): Promise<void> {
  if (!isSupabaseConfigured()) return;

  await getSupabase().rpc('upsert_replay_buffer_snapshot', {
    p_session_id: input.sessionId,
    p_operator_key: input.operatorKey ?? null,
    p_operator_label: input.operatorLabel ?? null,
    p_source_kind: input.sourceKind ?? null,
    p_buffer_seconds: input.bufferSeconds,
    p_chunk_count: input.chunkCount,
    p_mark_in_sec: input.markInSec ?? null,
    p_mark_out_sec: input.markOutSec ?? null,
    p_mark_timecode_in: input.markTimecodeIn ?? null,
    p_mark_timecode_out: input.markTimecodeOut ?? null,
    p_house_clock_smpte: input.houseClockSmpte ?? null,
    p_is_recording: input.isRecording,
  });
}

export async function fetchLatestReplayBufferSnapshot(
  sessionId: string,
): Promise<ReplayBufferSnapshot | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await getSupabase().rpc('get_latest_replay_buffer_snapshot', {
    p_session_id: sessionId,
  });
  if (error || !data) return null;
  return mapSnapshot(data as Record<string, unknown>);
}

export async function requestStorageQuotaEmailCheck(): Promise<void> {
  if (!isSupabaseConfigured()) return;

  await getSupabase().rpc('check_my_storage_email_alerts');
}

export function snapshotAgeMinutes(capturedAt: string, nowMs = Date.now()): number {
  const ageMs = nowMs - new Date(capturedAt).getTime();
  return Math.max(0, ageMs / 60_000);
}
