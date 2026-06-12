import type { PlanTier } from '../types/plans';

/** Total mixer video input slots per plan (includes optional IP camera channel). */
export const PLAN_TOTAL_CHANNELS: Record<PlanTier, number> = {
  free: 2,
  pro: 5,
  pro_master: 11,
};

export const PLAN_IP_CAMERA_SLOTS: Record<PlanTier, number> = {
  free: 0,
  pro: 1,
  pro_master: 1,
};

/** Cloud storage included for saved video recordings (GB). */
export const PLAN_RECORDING_STORAGE_GB: Record<PlanTier, number> = {
  free: 0,
  pro: 50,
  pro_master: 100,
};

export function planAllowsIpCamera(planId: PlanTier): boolean {
  return PLAN_IP_CAMERA_SLOTS[planId] > 0;
}

export function resolvePlanTotalChannels(planId: PlanTier | undefined, fromApi?: number): number {
  if (fromApi != null && fromApi > 0) return fromApi;
  return PLAN_TOTAL_CHANNELS[planId ?? 'free'];
}
