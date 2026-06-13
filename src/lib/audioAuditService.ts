import { getSupabase, isSupabaseConfigured } from './supabase';

export type AudioAuditEventType =
  | 'console_power'
  | 'master_mute'
  | 'monitor_mute'
  | 'scene_store'
  | 'scene_recall'
  | 'channel_mute'
  | 'channel_solo'
  | 'pgm_bridge_connect'
  | 'pgm_bridge_disconnect'
  | 'show_preset_saved'
  | 'show_preset_loaded'
  | 'source_change'
  | 'show_shared'
  | 'show_imported'
  | 'show_library_promoted'
  | 'ops_digest_sent'
  | 'scene_rundown_start'
  | 'scene_rundown_advance'
  | 'scene_rundown_complete'
  | 'scene_diff_exported'
  | 'fx_diff_exported'
  | 'rundown_shared'
  | 'rundown_imported'
  | 'rundown_library_promoted'
  | 'scene_backup_restored'
  | 'scene_manifest_exported'
  | 'lifecycle_policy_applied'
  | 'channel_inventory_exported'
  | 'rundown_runsheet_exported'
  | 'compliance_bundle_exported'
  | 'auto_lifecycle_applied'
  | 'scheduled_digest_sent';

export interface AudioAuditRow {
  id: string;
  eventType: AudioAuditEventType;
  sessionId: string | null;
  channelIndex: number | null;
  sceneId: string | null;
  label: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
}

export interface LogAudioAuditInput {
  eventType: AudioAuditEventType;
  sessionId?: string | null;
  channelIndex?: number | null;
  sceneId?: string | null;
  label?: string | null;
  meta?: Record<string, unknown>;
}

function mapRow(row: Record<string, unknown>): AudioAuditRow {
  return {
    id: String(row.id),
    eventType: String(row.event_type) as AudioAuditEventType,
    sessionId: row.session_id ? String(row.session_id) : null,
    channelIndex: row.channel_index != null ? Number(row.channel_index) : null,
    sceneId: row.scene_id ? String(row.scene_id) : null,
    label: row.label ? String(row.label) : null,
    meta: (row.meta as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
  };
}

/** Best-effort audit log — never blocks operator workflow. */
export async function logAudioAudit(input: LogAudioAuditInput): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    await getSupabase().rpc('log_audio_audit_event', {
      p_event_type: input.eventType,
      p_session_id: input.sessionId ?? null,
      p_channel_index: input.channelIndex ?? null,
      p_scene_id: input.sceneId ?? null,
      p_label: input.label ?? null,
      p_meta: input.meta ?? {},
    });
  } catch {
    /* offline or migration pending */
  }
}

export async function fetchAudioAuditLog(limit = 100): Promise<AudioAuditRow[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await getSupabase().rpc('list_audio_audit_events', { p_limit: limit });
  if (error) return [];
  return ((data ?? []) as Record<string, unknown>[]).map(mapRow);
}
