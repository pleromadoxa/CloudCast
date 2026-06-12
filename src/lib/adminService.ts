import { getSupabase } from './supabase';
import type {
  ActivityLogList,
  AdminAccess,
  AdminDeviceList,
  AdminMemberRow,
  AdminOverview,
  AdminPlanRow,
  AdminRecordingList,
  AdminSessionDetail,
  AdminSessionList,
  AdminStreamDestinationList,
  AdminUserDetail,
  AdminUserList,
  BroadcastSeverity,
  BroadcastTarget,
  CouponKind,
  CouponRow,
  EmailQueueList,
  ErrorLogList,
  PlanGrantList,
  PlatformBroadcastRow,
  SystemHealth,
} from '../types/admin';
import type { PlanTier } from '../types/plans';

export async function fetchAdminAccess(): Promise<AdminAccess> {
  const { data, error } = await getSupabase().rpc('admin_get_access');
  if (error) throw new Error(error.message);
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    is_admin: Boolean(row.is_admin),
    role: (row.role as AdminAccess['role']) ?? null,
  };
}

export async function bootstrapSuperAdmin(): Promise<boolean> {
  const { data, error } = await getSupabase().rpc('admin_bootstrap_super_admin');
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function fetchAdminOverview(): Promise<AdminOverview> {
  const { data, error } = await getSupabase().rpc('admin_get_overview');
  if (error) throw new Error(error.message);
  return data as AdminOverview;
}

export async function fetchAdminUsers(search = '', limit = 50, offset = 0): Promise<AdminUserList> {
  const { data, error } = await getSupabase().rpc('admin_list_users', {
    p_search: search || null,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw new Error(error.message);
  return data as AdminUserList;
}

export async function fetchAdminUserDetail(userId: string): Promise<AdminUserDetail> {
  const { data, error } = await getSupabase().rpc('admin_get_user_detail', {
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
  return data as AdminUserDetail;
}

export async function adminSetUserPlan(userId: string, planId: PlanTier): Promise<void> {
  const { error } = await getSupabase().rpc('admin_set_user_plan', {
    p_user_id: userId,
    p_plan_id: planId,
  });
  if (error) throw new Error(error.message);
}

export async function fetchAdminPlans(): Promise<AdminPlanRow[]> {
  const { data, error } = await getSupabase().rpc('admin_list_plans');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((p) => ({
    id: p.id as PlanTier,
    name: String(p.name),
    max_mobile_devices: Number(p.max_mobile_devices),
    max_usb_devices: Number(p.max_usb_devices),
    max_total_channels: Number(p.max_total_channels),
    connection_mode: String(p.connection_mode),
    price_monthly_cents: Number(p.price_monthly_cents),
    features: Array.isArray(p.features) ? (p.features as string[]) : [],
  }));
}

export async function adminUpdatePlan(input: {
  planId: PlanTier;
  name?: string;
  maxMobileDevices?: number;
  maxUsbDevices?: number;
  maxTotalChannels?: number;
  connectionMode?: string;
  priceMonthlyCents?: number;
  features?: string[];
}): Promise<void> {
  const { error } = await getSupabase().rpc('admin_update_plan', {
    p_plan_id: input.planId,
    p_name: input.name ?? null,
    p_max_mobile_devices: input.maxMobileDevices ?? null,
    p_max_usb_devices: input.maxUsbDevices ?? null,
    p_max_total_channels: input.maxTotalChannels ?? null,
    p_connection_mode: input.connectionMode ?? null,
    p_price_monthly_cents: input.priceMonthlyCents ?? null,
    p_features: input.features ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function fetchActivityLogs(
  limit = 100,
  offset = 0,
  action?: string,
): Promise<ActivityLogList> {
  const { data, error } = await getSupabase().rpc('admin_list_activity_logs', {
    p_limit: limit,
    p_offset: offset,
    p_action: action || null,
  });
  if (error) throw new Error(error.message);
  return data as ActivityLogList;
}

export async function fetchErrorLogs(
  limit = 100,
  offset = 0,
  severity?: string,
): Promise<ErrorLogList> {
  const { data, error } = await getSupabase().rpc('admin_list_error_logs', {
    p_limit: limit,
    p_offset: offset,
    p_severity: severity || null,
  });
  if (error) throw new Error(error.message);
  return data as ErrorLogList;
}

export async function fetchAdminSessions(
  limit = 50,
  offset = 0,
  activeOnly = false,
): Promise<AdminSessionList> {
  const { data, error } = await getSupabase().rpc('admin_list_mixer_sessions', {
    p_limit: limit,
    p_offset: offset,
    p_active_only: activeOnly,
  });
  if (error) throw new Error(error.message);
  return data as AdminSessionList;
}

export async function adminGrantRole(userId: string, role: 'admin' | 'super_admin' | 'support'): Promise<void> {
  const { error } = await getSupabase().rpc('admin_grant_role', {
    p_user_id: userId,
    p_role: role,
  });
  if (error) throw new Error(error.message);
}

export async function adminRevokeRole(userId: string): Promise<void> {
  const { error } = await getSupabase().rpc('admin_revoke_role', { p_user_id: userId });
  if (error) throw new Error(error.message);
}

export async function fetchAdminMembers(): Promise<AdminMemberRow[]> {
  const { data, error } = await getSupabase().rpc('admin_list_admins');
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminMemberRow[];
}

export async function fetchSessionDetail(sessionId: string): Promise<AdminSessionDetail> {
  const { data, error } = await getSupabase().rpc('admin_get_session_detail', {
    p_session_id: sessionId,
  });
  if (error) throw new Error(error.message);
  return data as AdminSessionDetail;
}

export async function fetchAdminDevices(
  limit = 100,
  offset = 0,
  status?: string,
  search?: string,
): Promise<AdminDeviceList> {
  const { data, error } = await getSupabase().rpc('admin_list_paired_devices', {
    p_limit: limit,
    p_offset: offset,
    p_status: status || null,
    p_search: search || null,
  });
  if (error) throw new Error(error.message);
  return data as AdminDeviceList;
}

export async function fetchAllRecordings(
  limit = 50,
  offset = 0,
  search?: string,
): Promise<AdminRecordingList> {
  const { data, error } = await getSupabase().rpc('admin_list_all_recordings', {
    p_limit: limit,
    p_offset: offset,
    p_search: search || null,
  });
  if (error) throw new Error(error.message);
  return data as AdminRecordingList;
}

export async function adminDeleteErrorLog(id: string): Promise<void> {
  const { error } = await getSupabase().rpc('admin_delete_error_log', { p_id: id });
  if (error) throw new Error(error.message);
}

export async function adminClearOldErrorLogs(days = 30): Promise<number> {
  const { data, error } = await getSupabase().rpc('admin_clear_old_error_logs', { p_days: days });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function adminDeactivateSession(sessionId: string): Promise<void> {
  const { error } = await getSupabase().rpc('admin_deactivate_session', {
    p_session_id: sessionId,
  });
  if (error) throw new Error(error.message);
}

export async function fetchSystemHealth(): Promise<SystemHealth> {
  const { data, error } = await getSupabase().rpc('admin_get_system_health');
  if (error) throw new Error(error.message);
  return data as SystemHealth;
}

export async function adminIssuePlan(input: {
  email: string;
  planId: PlanTier;
  reason?: string;
  expiresAt?: string | null;
}): Promise<Record<string, unknown>> {
  const { data, error } = await getSupabase().rpc('admin_issue_plan', {
    p_email: input.email,
    p_plan_id: input.planId,
    p_reason: input.reason || null,
    p_expires_at: input.expiresAt || null,
  });
  if (error) throw new Error(error.message);
  return data as Record<string, unknown>;
}

export async function fetchPlanGrants(limit = 50, offset = 0): Promise<PlanGrantList> {
  const { data, error } = await getSupabase().rpc('admin_list_plan_grants', {
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw new Error(error.message);
  return data as PlanGrantList;
}

export async function adminRevokePlanGrant(grantId: string): Promise<void> {
  const { error } = await getSupabase().rpc('admin_revoke_plan_grant', { p_grant_id: grantId });
  if (error) throw new Error(error.message);
}

export async function adminCreateCoupon(input: {
  code: string;
  kind: CouponKind;
  planId?: PlanTier | null;
  percentOff?: number | null;
  amountOffCents?: number | null;
  maxUses?: number | null;
  expiresAt?: string | null;
  notes?: string | null;
}): Promise<CouponRow> {
  const { data, error } = await getSupabase().rpc('admin_create_coupon', {
    p_code: input.code,
    p_kind: input.kind,
    p_plan_id: input.planId || null,
    p_percent_off: input.percentOff ?? null,
    p_amount_off_cents: input.amountOffCents ?? null,
    p_max_uses: input.maxUses ?? null,
    p_expires_at: input.expiresAt || null,
    p_notes: input.notes || null,
  });
  if (error) throw new Error(error.message);
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    code: String(row.code),
    kind: row.kind as CouponKind,
    plan_id: (row.plan_id as PlanTier) ?? null,
    plan_name: null,
    percent_off: row.percent_off != null ? Number(row.percent_off) : null,
    amount_off_cents: row.amount_off_cents != null ? Number(row.amount_off_cents) : null,
    max_uses: row.max_uses != null ? Number(row.max_uses) : null,
    use_count: Number(row.use_count ?? 0),
    expires_at: row.expires_at ? String(row.expires_at) : null,
    is_active: Boolean(row.is_active),
    notes: row.notes ? String(row.notes) : null,
    created_at: String(row.created_at),
    created_by_email: null,
  };
}

export async function fetchAdminCoupons(): Promise<CouponRow[]> {
  const { data, error } = await getSupabase().rpc('admin_list_coupons');
  if (error) throw new Error(error.message);
  return (data ?? []) as CouponRow[];
}

export async function adminDeactivateCoupon(id: string): Promise<void> {
  const { error } = await getSupabase().rpc('admin_deactivate_coupon', { p_id: id });
  if (error) throw new Error(error.message);
}

export async function fetchAdminStreamDestinations(
  limit = 50,
  offset = 0,
  search?: string,
): Promise<AdminStreamDestinationList> {
  const { data, error } = await getSupabase().rpc('admin_list_all_stream_destinations', {
    p_limit: limit,
    p_offset: offset,
    p_search: search || null,
  });
  if (error) throw new Error(error.message);
  return data as AdminStreamDestinationList;
}

export async function adminCreateBroadcast(input: {
  title: string;
  message: string;
  severity?: BroadcastSeverity;
  linkUrl?: string | null;
  linkLabel?: string | null;
  targetPlan?: BroadcastTarget;
  startsAt?: string | null;
  endsAt?: string | null;
}): Promise<PlatformBroadcastRow> {
  const { data, error } = await getSupabase().rpc('admin_create_broadcast', {
    p_title: input.title,
    p_message: input.message,
    p_severity: input.severity || 'info',
    p_link_url: input.linkUrl || null,
    p_link_label: input.linkLabel || null,
    p_target_plan: input.targetPlan || 'all',
    p_starts_at: input.startsAt || null,
    p_ends_at: input.endsAt || null,
  });
  if (error) throw new Error(error.message);
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    title: String(row.title),
    message: String(row.message),
    severity: row.severity as BroadcastSeverity,
    link_url: row.link_url ? String(row.link_url) : null,
    link_label: row.link_label ? String(row.link_label) : null,
    target_plan: row.target_plan as BroadcastTarget,
    starts_at: String(row.starts_at),
    ends_at: row.ends_at ? String(row.ends_at) : null,
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at),
    created_by_email: null,
  };
}

export async function fetchAdminBroadcasts(): Promise<PlatformBroadcastRow[]> {
  const { data, error } = await getSupabase().rpc('admin_list_broadcasts');
  if (error) throw new Error(error.message);
  return (data ?? []) as PlatformBroadcastRow[];
}

export async function adminDeactivateBroadcast(id: string): Promise<void> {
  const { error } = await getSupabase().rpc('admin_deactivate_broadcast', { p_id: id });
  if (error) throw new Error(error.message);
}

export async function adminGrantRoleByEmail(
  email: string,
  role: 'admin' | 'super_admin' | 'support',
): Promise<Record<string, unknown>> {
  const { data, error } = await getSupabase().rpc('admin_grant_role_by_email', {
    p_email: email,
    p_role: role,
  });
  if (error) throw new Error(error.message);
  return data as Record<string, unknown>;
}

export async function fetchEmailQueue(limit = 50, offset = 0): Promise<EmailQueueList> {
  const { data, error } = await getSupabase().rpc('admin_list_email_queue', {
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw new Error(error.message);
  return data as EmailQueueList;
}
