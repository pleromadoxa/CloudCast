import type { PlanTier, ProductPlanTier } from '../types/plans';
import { isUniversalPlanTier } from '../types/plans';

export {
  planAllowsIpCamera,
  PLAN_TOTAL_CHANNELS,
  PLAN_IP_CAMERA_SLOTS,
  PLAN_RECORDING_STORAGE_GB,
  recordingStorageGbForPlan,
} from './planLimits';

function isPaidProductTier(planId: PlanTier): planId is ProductPlanTier {
  return planId === 'pro' || planId === 'pro_master';
}

export function planAllowsChromaKey(planId: PlanTier): boolean {
  if (isUniversalPlanTier(planId)) return true;
  return isPaidProductTier(planId);
}

export function planAllowsAdvancedGraphics(planId: PlanTier): boolean {
  if (isUniversalPlanTier(planId)) return true;
  return isPaidProductTier(planId);
}

export function planAllowsCloudRecording(planId: PlanTier): boolean {
  if (isUniversalPlanTier(planId)) return true;
  return isPaidProductTier(planId);
}

export { planUsesRegalCloud, regalQualityTierForPlan } from './planStreamQuality';
