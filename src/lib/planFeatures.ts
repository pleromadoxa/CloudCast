import type { PlanTier } from '../types/plans';

export {
  planAllowsIpCamera,
  PLAN_TOTAL_CHANNELS,
  PLAN_IP_CAMERA_SLOTS,
  PLAN_RECORDING_STORAGE_GB,
} from './planLimits';

export function planAllowsChromaKey(planId: PlanTier): boolean {
  return planId === 'pro' || planId === 'pro_master';
}

export function planAllowsAdvancedGraphics(planId: PlanTier): boolean {
  return planId === 'pro' || planId === 'pro_master';
}
