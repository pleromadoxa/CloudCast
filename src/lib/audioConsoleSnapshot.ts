import { getSupabase, isSupabaseConfigured } from './supabase';

export interface AudioConsoleSnapshot {
  id: string;
  sessionId: string;
  operatorLabel: string | null;
  masterVolume: number;
  masterMuted: boolean;
  monitorMuted: boolean;
  consoleEnabled: boolean;
  activeScene: string | null;
  selectedChannel: number | null;
  liveInputCount: number;
  mutedChannelCount: number;
  bridgeConnected: boolean;
  capturedAt: string;
}

function mapSnapshot(row: Record<string, unknown>): AudioConsoleSnapshot {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    operatorLabel: row.operator_label ? String(row.operator_label) : null,
    masterVolume: Number(row.master_volume ?? 0),
    masterMuted: Boolean(row.master_muted),
    monitorMuted: Boolean(row.monitor_muted),
    consoleEnabled: Boolean(row.console_enabled),
    activeScene: row.active_scene ? String(row.active_scene) : null,
    selectedChannel: row.selected_channel != null ? Number(row.selected_channel) : null,
    liveInputCount: Number(row.live_input_count ?? 0),
    mutedChannelCount: Number(row.muted_channel_count ?? 0),
    bridgeConnected: Boolean(row.bridge_connected),
    capturedAt: String(row.captured_at),
  };
}

export interface SaveAudioConsoleSnapshotInput {
  sessionId: string;
  operatorKey?: string;
  operatorLabel?: string;
  masterVolume: number;
  masterMuted: boolean;
  monitorMuted: boolean;
  consoleEnabled: boolean;
  activeScene?: string | null;
  selectedChannel?: number | null;
  liveInputCount: number;
  mutedChannelCount: number;
  bridgeConnected: boolean;
}

export async function saveAudioConsoleSnapshot(input: SaveAudioConsoleSnapshotInput): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await getSupabase().rpc('upsert_audio_console_snapshot', {
    p_session_id: input.sessionId,
    p_operator_key: input.operatorKey ?? null,
    p_operator_label: input.operatorLabel ?? null,
    p_master_volume: input.masterVolume,
    p_master_muted: input.masterMuted,
    p_monitor_muted: input.monitorMuted,
    p_console_enabled: input.consoleEnabled,
    p_active_scene: input.activeScene ?? null,
    p_selected_channel: input.selectedChannel ?? null,
    p_live_input_count: input.liveInputCount,
    p_muted_channel_count: input.mutedChannelCount,
    p_bridge_connected: input.bridgeConnected,
  });
}

export async function fetchLatestAudioConsoleSnapshot(
  sessionId: string,
): Promise<AudioConsoleSnapshot | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await getSupabase().rpc('get_latest_audio_console_snapshot', {
    p_session_id: sessionId,
  });
  if (error || !data) return null;
  return mapSnapshot(data as Record<string, unknown>);
}

export function snapshotAgeMinutes(capturedAt: string, nowMs = Date.now()): number {
  return Math.max(0, (nowMs - new Date(capturedAt).getTime()) / 60_000);
}
