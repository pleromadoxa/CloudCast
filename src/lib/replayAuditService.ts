import { getSupabase, isSupabaseConfigured } from './supabase';

export type ReplayAuditEventType =
  | 'buffer_start'
  | 'buffer_stall_recovered'
  | 'mark_in'
  | 'mark_out'
  | 'clip_saved'
  | 'pgm_push'
  | 'pgm_return'
  | 'cloud_sync'
  | 'precise_export'
  | 'rundown_start'
  | 'rundown_advance'
  | 'rundown_template_saved'
  | 'quota_warning'
  | 'buffer_snapshot_saved'
  | 'rundown_shared'
  | 'rundown_imported'
  | 'quota_email_requested'
  | 'rundown_library_promoted'
  | 'lifecycle_policy_applied'
  | 'ops_digest_sent'
  | 'clip_archived'
  | 'clip_purged';

export interface ReplayAuditRow {
  id: string;
  eventType: ReplayAuditEventType;
  sessionId: string | null;
  clipId: string | null;
  bankIndex: number | null;
  label: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
}

export interface LogReplayAuditInput {
  eventType: ReplayAuditEventType;
  sessionId?: string | null;
  clipId?: string | null;
  bankIndex?: number | null;
  label?: string | null;
  meta?: Record<string, unknown>;
}

function mapRow(row: Record<string, unknown>): ReplayAuditRow {
  return {
    id: String(row.id),
    eventType: String(row.event_type) as ReplayAuditEventType,
    sessionId: row.session_id ? String(row.session_id) : null,
    clipId: row.clip_id ? String(row.clip_id) : null,
    bankIndex: row.bank_index != null ? Number(row.bank_index) : null,
    label: row.label ? String(row.label) : null,
    meta: (row.meta as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
  };
}

/** Best-effort audit log — never blocks operator workflow. */
export async function logReplayAudit(input: LogReplayAuditInput): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    await getSupabase().rpc('log_replay_audit_event', {
      p_event_type: input.eventType,
      p_session_id: input.sessionId ?? null,
      p_clip_id: input.clipId ?? null,
      p_bank_index: input.bankIndex ?? null,
      p_label: input.label ?? null,
      p_meta: input.meta ?? {},
    });
  } catch {
    /* offline or migration pending */
  }
}

export async function fetchReplayAuditLog(limit = 100): Promise<ReplayAuditRow[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await getSupabase().rpc('list_replay_audit_events', {
    p_limit: limit,
  });
  if (error) return [];
  return ((data ?? []) as Record<string, unknown>[]).map(mapRow);
}
