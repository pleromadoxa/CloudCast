import { getSupabase, isSupabaseConfigured } from './supabase';

export type VideoAuditEventType =
  | 'cut'
  | 'take'
  | 'send_to_pgm'
  | 'on_air_start'
  | 'on_air_stop'
  | 'recording_start'
  | 'recording_stop'
  | 'preset_saved'
  | 'preset_loaded'
  | 'preset_shared'
  | 'preset_imported'
  | 'preset_library_promoted'
  | 'ops_digest_sent'
  | 'scheduled_digest_sent';

export interface VideoAuditRow {
  id: string;
  eventType: VideoAuditEventType;
  sessionId: string | null;
  deviceId: string | null;
  label: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
}

export interface LogVideoAuditInput {
  eventType: VideoAuditEventType;
  sessionId?: string | null;
  deviceId?: string | null;
  label?: string | null;
  meta?: Record<string, unknown>;
}

function mapRow(row: Record<string, unknown>): VideoAuditRow {
  return {
    id: String(row.id),
    eventType: String(row.event_type) as VideoAuditEventType,
    sessionId: row.session_id ? String(row.session_id) : null,
    deviceId: row.device_id ? String(row.device_id) : null,
    label: row.label ? String(row.label) : null,
    meta: (row.meta as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
  };
}

/** Best-effort audit log — never blocks operator workflow. */
export async function logVideoAudit(input: LogVideoAuditInput): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    await getSupabase().rpc('log_video_audit_event', {
      p_event_type: input.eventType,
      p_session_id: input.sessionId ?? null,
      p_device_id: input.deviceId ?? null,
      p_label: input.label ?? null,
      p_meta: input.meta ?? {},
    });
  } catch {
    /* offline or migration pending */
  }
}

export async function fetchVideoAuditLog(limit = 100): Promise<VideoAuditRow[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await getSupabase().rpc('list_video_audit_events', { p_limit: limit });
  if (error) return [];
  return ((data ?? []) as Record<string, unknown>[]).map(mapRow);
}
