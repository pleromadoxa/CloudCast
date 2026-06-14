import { getSupabase, isSupabaseConfigured } from './supabase';

export interface VideoProgramSnapshot {
  id: string;
  sessionId: string;
  operatorLabel: string | null;
  pstDeviceId: string | null;
  pstDeviceLabel: string | null;
  pgmDeviceId: string | null;
  pgmDeviceLabel: string | null;
  isOnAir: boolean;
  isRecording: boolean;
  transitionType: string | null;
  outputMode: string | null;
  liveInputCount: number;
  replayOnPgm: boolean;
  replayLabel: string | null;
  capturedAt: string;
}

function mapSnapshot(row: Record<string, unknown>): VideoProgramSnapshot {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    operatorLabel: row.operator_label ? String(row.operator_label) : null,
    pstDeviceId: row.pst_device_id ? String(row.pst_device_id) : null,
    pstDeviceLabel: row.pst_device_label ? String(row.pst_device_label) : null,
    pgmDeviceId: row.pgm_device_id ? String(row.pgm_device_id) : null,
    pgmDeviceLabel: row.pgm_device_label ? String(row.pgm_device_label) : null,
    isOnAir: Boolean(row.is_on_air),
    isRecording: Boolean(row.is_recording),
    transitionType: row.transition_type ? String(row.transition_type) : null,
    outputMode: row.output_mode ? String(row.output_mode) : null,
    liveInputCount: Number(row.live_input_count ?? 0),
    replayOnPgm: Boolean(row.replay_on_pgm),
    replayLabel: row.replay_label ? String(row.replay_label) : null,
    capturedAt: String(row.captured_at),
  };
}

export interface SaveVideoProgramSnapshotInput {
  sessionId: string;
  operatorKey?: string;
  operatorLabel?: string;
  pstDeviceId?: string | null;
  pstDeviceLabel?: string | null;
  pgmDeviceId?: string | null;
  pgmDeviceLabel?: string | null;
  isOnAir: boolean;
  isRecording: boolean;
  transitionType?: string | null;
  outputMode?: string | null;
  liveInputCount: number;
  replayOnPgm: boolean;
  replayLabel?: string | null;
}

export async function saveVideoProgramSnapshot(input: SaveVideoProgramSnapshotInput): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await getSupabase().rpc('upsert_video_program_snapshot', {
    p_session_id: input.sessionId,
    p_operator_key: input.operatorKey ?? null,
    p_operator_label: input.operatorLabel ?? null,
    p_pst_device_id: input.pstDeviceId ?? null,
    p_pst_device_label: input.pstDeviceLabel ?? null,
    p_pgm_device_id: input.pgmDeviceId ?? null,
    p_pgm_device_label: input.pgmDeviceLabel ?? null,
    p_is_on_air: input.isOnAir,
    p_is_recording: input.isRecording,
    p_transition_type: input.transitionType ?? null,
    p_output_mode: input.outputMode ?? null,
    p_live_input_count: input.liveInputCount,
    p_replay_on_pgm: input.replayOnPgm,
    p_replay_label: input.replayLabel ?? null,
  });
}

export async function fetchLatestVideoProgramSnapshot(
  sessionId: string,
): Promise<VideoProgramSnapshot | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await getSupabase().rpc('get_latest_video_program_snapshot', {
    p_session_id: sessionId,
  });
  if (error || !data) return null;
  return mapSnapshot(data as Record<string, unknown>);
}

export function snapshotAgeMinutes(capturedAt: string, nowMs = Date.now()): number {
  return Math.max(0, (nowMs - new Date(capturedAt).getTime()) / 60_000);
}
