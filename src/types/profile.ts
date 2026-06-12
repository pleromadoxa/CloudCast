import type { PlanTier } from './plans';

export interface UserPlanGrant {
  id: string;
  plan_id: PlanTier;
  previous_plan_id: PlanTier;
  reason: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface UserMixerSessionRow {
  session_id: string;
  access_code: string;
  plan_id: PlanTier;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string | null;
  device_count: number;
  live_device_count: number;
}

export interface UserActivityRow {
  id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface UserAccountDashboard {
  member_since: string | null;
  active_plan_grant: UserPlanGrant | null;
  mixer_sessions: UserMixerSessionRow[];
  session_count: number;
  active_session_count: number;
  stream_destinations_count: number;
  enabled_stream_destinations_count: number;
  coupon_redemptions_count: number;
  recent_activity: UserActivityRow[];
}
