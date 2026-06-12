import { getSupabase } from './supabase';
import type { PlanTier } from '../types/plans';
import type {
  UserAccountDashboard,
  UserActivityRow,
  UserMixerSessionRow,
  UserPlanGrant,
} from '../types/profile';

export async function updateUserProfile(fullName: string): Promise<void> {
  const { error } = await getSupabase().rpc('update_user_profile', {
    p_full_name: fullName.trim(),
  });
  if (error) throw new Error(error.message);
}

function mapPlanGrant(row: Record<string, unknown> | null): UserPlanGrant | null {
  if (!row || !row.id) return null;
  return {
    id: String(row.id),
    plan_id: row.plan_id as PlanTier,
    previous_plan_id: row.previous_plan_id as PlanTier,
    reason: row.reason ? String(row.reason) : null,
    expires_at: row.expires_at ? String(row.expires_at) : null,
    created_at: String(row.created_at),
  };
}

function mapMixerSession(row: Record<string, unknown>): UserMixerSessionRow {
  return {
    session_id: String(row.session_id),
    access_code: String(row.access_code),
    plan_id: row.plan_id as PlanTier,
    is_active: Boolean(row.is_active),
    expires_at: row.expires_at ? String(row.expires_at) : null,
    created_at: String(row.created_at),
    updated_at: row.updated_at ? String(row.updated_at) : null,
    device_count: Number(row.device_count ?? 0),
    live_device_count: Number(row.live_device_count ?? 0),
  };
}

function mapActivity(row: Record<string, unknown>): UserActivityRow {
  return {
    id: String(row.id),
    action: String(row.action),
    resource_type: row.resource_type ? String(row.resource_type) : null,
    resource_id: row.resource_id ? String(row.resource_id) : null,
    metadata:
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    created_at: String(row.created_at),
  };
}

export async function fetchAccountDashboard(): Promise<UserAccountDashboard> {
  const { data, error } = await getSupabase().rpc('get_user_account_dashboard');
  if (error) throw new Error(error.message);

  const row = (data ?? {}) as Record<string, unknown>;
  const sessions = Array.isArray(row.mixer_sessions)
    ? (row.mixer_sessions as Record<string, unknown>[]).map(mapMixerSession)
    : [];
  const activity = Array.isArray(row.recent_activity)
    ? (row.recent_activity as Record<string, unknown>[]).map(mapActivity)
    : [];

  return {
    member_since: row.member_since ? String(row.member_since) : null,
    active_plan_grant: mapPlanGrant(
      row.active_plan_grant as Record<string, unknown> | null,
    ),
    mixer_sessions: sessions,
    session_count: Number(row.session_count ?? 0),
    active_session_count: Number(row.active_session_count ?? 0),
    stream_destinations_count: Number(row.stream_destinations_count ?? 0),
    enabled_stream_destinations_count: Number(
      row.enabled_stream_destinations_count ?? 0,
    ),
    coupon_redemptions_count: Number(row.coupon_redemptions_count ?? 0),
    recent_activity: activity,
  };
}

export async function requestPasswordReset(email: string): Promise<void> {
  const redirectTo = `${window.location.origin}/login`;
  const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) throw new Error(error.message);
}

const ACTIVITY_LABELS: Record<string, string> = {
  'coupon.redeem': 'Coupon redeemed',
  'plan.change': 'Plan changed',
  'user.plan.update': 'Plan updated',
  'recording.upload': 'Recording saved to cloud',
  'profile.update': 'Profile updated',
};

export function formatActivityAction(action: string): string {
  if (ACTIVITY_LABELS[action]) return ACTIVITY_LABELS[action];
  return action.replace(/\./g, ' · ').replace(/_/g, ' ');
}

export function maskStreamKey(key: string): string {
  if (!key) return '—';
  if (key.length <= 4) return '••••';
  return `••••${key.slice(-4)}`;
}

export type StorageWarningLevel = 'none' | 'info' | 'warning' | 'danger' | 'full';

export function storageWarningLevel(percent: number): StorageWarningLevel {
  if (percent >= 100) return 'full';
  if (percent >= 90) return 'danger';
  if (percent >= 75) return 'warning';
  if (percent >= 50) return 'info';
  return 'none';
}

export function storageWarningMessage(level: StorageWarningLevel): string | null {
  switch (level) {
    case 'full':
      return 'Cloud storage is full. Delete recordings or upgrade your plan to save new PGM files.';
    case 'danger':
      return 'Cloud storage is over 90% full. Consider deleting old recordings soon.';
    case 'warning':
      return 'Cloud storage is over 75% full.';
    case 'info':
      return 'Cloud storage is over 50% full.';
    default:
      return null;
  }
}
