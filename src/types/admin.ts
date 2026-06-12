import type { PlanTier } from './plans';

export type AdminRole = 'admin' | 'super_admin' | 'support';

export interface AdminAccess {
  is_admin: boolean;
  role: AdminRole | null;
}

export interface AdminOverview {
  total_users: number;
  users_by_plan: Record<string, number>;
  active_sessions: number;
  total_sessions: number;
  paired_devices: number;
  live_devices: number;
  recordings_count: number;
  recordings_bytes: number;
  activity_24h: number;
  errors_24h: number;
  errors_open: number;
  stream_destinations?: number;
  admin_count?: number;
}

export interface AdminUserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  plan_id: PlanTier;
  plan_name: string;
  updated_at: string | null;
  signed_up_at: string;
  is_admin: boolean;
  session_count: number;
  recording_count: number;
}

export interface AdminUserList {
  total: number;
  users: AdminUserRow[];
}

export interface AdminPlanRow {
  id: PlanTier;
  name: string;
  max_mobile_devices: number;
  max_usb_devices: number;
  max_total_channels: number;
  connection_mode: string;
  price_monthly_cents: number;
  features: string[];
}

export interface ActivityLogRow {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ActivityLogList {
  total: number;
  logs: ActivityLogRow[];
}

export interface ErrorLogRow {
  id: string;
  user_id: string | null;
  user_email: string | null;
  session_id: string | null;
  source: string;
  severity: 'warn' | 'error' | 'fatal';
  message: string;
  stack: string | null;
  context: Record<string, unknown>;
  created_at: string;
}

export interface ErrorLogList {
  total: number;
  logs: ErrorLogRow[];
}

export interface AdminSessionRow {
  id: string;
  access_code: string;
  owner_id: string;
  owner_email: string | null;
  owner_name: string | null;
  plan_id: PlanTier;
  connection_mode: string;
  max_devices: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string | null;
  device_count: number;
  live_device_count: number;
}

export interface AdminSessionList {
  total: number;
  sessions: AdminSessionRow[];
}

export interface AdminUserDetail {
  profile: {
    id: string;
    email: string | null;
    full_name: string | null;
    plan_id: PlanTier;
    plan_name: string;
    updated_at: string | null;
    signed_up_at: string;
    is_admin: boolean;
  } | null;
  sessions: Array<{
    id: string;
    access_code: string;
    plan_id: PlanTier;
    connection_mode: string;
    max_devices: number;
    is_active: boolean;
    expires_at: string | null;
    created_at: string;
    updated_at: string | null;
  }>;
  recordings: Array<{
    id: string;
    file_name: string;
    size_bytes: number;
    mime_type: string;
    created_at: string;
  }>;
  destinations: Array<{
    id: string;
    name: string;
    platform: string;
    is_enabled: boolean;
    sort_order: number;
    created_at: string;
  }>;
  recent_activity: ActivityLogRow[];
}

export interface AdminDeviceRow {
  id: string;
  device_id: string;
  slot_number: number;
  label: string | null;
  device_type: string;
  platform: string;
  status: string;
  battery_level: number | null;
  network_type: string | null;
  paired_at: string;
  last_seen_at: string | null;
  session_id: string;
  access_code: string;
  owner_id: string;
  owner_email: string | null;
  owner_name: string | null;
}

export interface AdminDeviceList {
  total: number;
  devices: AdminDeviceRow[];
}

export interface AdminRecordingRow {
  id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  file_name: string;
  size_bytes: number;
  mime_type: string;
  storage_path: string;
  created_at: string;
  session_id: string | null;
}

export interface AdminRecordingList {
  total: number;
  recordings: AdminRecordingRow[];
}

export interface AdminMemberRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: AdminRole;
  granted_at: string;
  granted_by_email: string | null;
}

export interface PairedDeviceDetail {
  id: string;
  device_id: string;
  slot_number: number;
  label: string | null;
  device_type: string;
  device_role: string;
  platform: string;
  status: string;
  audio_source: string | null;
  battery_level: number | null;
  network_type: string | null;
  paired_at: string;
  last_seen_at: string | null;
  updated_at: string | null;
}

export interface AdminSessionDetail {
  session: Record<string, unknown> | null;
  devices: PairedDeviceDetail[];
}

export interface SystemHealth {
  heartbeat: {
    id: number;
    last_ping_at: string;
    last_source: string;
    ping_count: number;
  } | null;
  stream_destinations: number;
  enabled_destinations: number;
  admin_count: number;
  activity_7d: number;
  errors_7d: number;
  new_users_7d: number;
  recent_activity: ActivityLogRow[];
  recent_errors: Array<{
    id: string;
    severity: string;
    message: string;
    source: string;
    created_at: string;
  }>;
}

export interface PlanGrantRow {
  id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  plan_id: PlanTier;
  plan_name: string;
  previous_plan_id: PlanTier;
  reason: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  issued_by_email: string | null;
}

export interface PlanGrantList {
  total: number;
  grants: PlanGrantRow[];
}

export type CouponKind = 'plan_upgrade' | 'percent_off' | 'fixed_off';

export interface CouponRow {
  id: string;
  code: string;
  kind: CouponKind;
  plan_id: PlanTier | null;
  plan_name: string | null;
  percent_off: number | null;
  amount_off_cents: number | null;
  max_uses: number | null;
  use_count: number;
  expires_at: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  created_by_email: string | null;
}

export interface AdminStreamDestinationRow {
  id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  name: string;
  platform: string;
  stream_url: string;
  stream_key_masked: string;
  is_enabled: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string | null;
}

export interface AdminStreamDestinationList {
  total: number;
  destinations: AdminStreamDestinationRow[];
}

export type BroadcastSeverity = 'info' | 'warning' | 'promo';
export type BroadcastTarget = 'all' | 'free' | 'pro' | 'pro_master';

export interface PlatformBroadcastRow {
  id: string;
  title: string;
  message: string;
  severity: BroadcastSeverity;
  link_url: string | null;
  link_label: string | null;
  target_plan: BroadcastTarget;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
  created_by_email: string | null;
}

export interface EmailQueueRow {
  id: string;
  user_id: string | null;
  email_to: string;
  template: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
}

export interface EmailQueueList {
  total: number;
  items: EmailQueueRow[];
}

export type AdminTab =
  | 'overview'
  | 'users'
  | 'plans'
  | 'plan_grants'
  | 'coupons'
  | 'broadcasting'
  | 'mobile_apps'
  | 'sessions'
  | 'devices'
  | 'recordings'
  | 'activity'
  | 'errors'
  | 'admins'
  | 'system';
