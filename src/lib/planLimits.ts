import type { PlanTier, ProductPlanTier } from '../types/plans';
import { isUniversalPlanTier } from '../types/plans';

/** Total mixer video input slots per plan (includes optional IP camera channel). */
export const PLAN_TOTAL_CHANNELS: Record<ProductPlanTier, number> = {
  free: 2,
  pro: 5,
  pro_master: 11,
};

export const PLAN_IP_CAMERA_SLOTS: Record<ProductPlanTier, number> = {
  free: 0,
  pro: 1,
  pro_master: 1,
};

/** Cloud storage included for saved video recordings (GB). */
export const PLAN_RECORDING_STORAGE_GB: Record<ProductPlanTier, number> = {
  free: 0,
  pro: 50,
  pro_master: 100,
};

export function planAllowsIpCamera(planId: PlanTier): boolean {
  if (isUniversalPlanTier(planId)) return planId !== 'universal_essential' || true;
  return PLAN_IP_CAMERA_SLOTS[planId as ProductPlanTier] > 0;
}

export function resolvePlanTotalChannels(planId: PlanTier | undefined, fromApi?: number): number {
  if (fromApi != null && fromApi > 0) return fromApi;
  if (!planId || isUniversalPlanTier(planId)) {
    if (planId === 'universal_essential') return PLAN_TOTAL_CHANNELS.pro;
    return PLAN_TOTAL_CHANNELS.pro_master;
  }
  return PLAN_TOTAL_CHANNELS[planId as ProductPlanTier];
}

export function recordingStorageGbForPlan(planId: PlanTier): number {
  if (isUniversalPlanTier(planId)) {
    return planId === 'universal_essential'
      ? PLAN_RECORDING_STORAGE_GB.pro
      : PLAN_RECORDING_STORAGE_GB.pro_master;
  }
  return PLAN_RECORDING_STORAGE_GB[planId as ProductPlanTier];
}
