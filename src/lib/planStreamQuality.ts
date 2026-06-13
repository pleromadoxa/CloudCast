import type { StreamQuality } from '../types/device';
import type { ConnectionMode, PlanTier } from '../types/plans';
import { isUniversalPlanTier } from '../types/plans';

/** User-facing ingest/playback tier for Regal Cloud. */
export type RegalQualityTier = 'standard' | 'hd' | 'uhd';

export function regalQualityTierForPlan(planId: PlanTier): RegalQualityTier {
  if (planId === 'pro_master' || planId === 'universal' || planId === 'universal_studio') return 'uhd';
  if (planId === 'pro' || planId === 'universal_essential') return 'hd';
  return 'standard';
}

export function regalQualityLabel(planId: PlanTier, connectionMode: ConnectionMode): string {
  if (connectionMode === 'mesh') return 'Regal Mesh';
  const tier = regalQualityTierForPlan(planId);
  if (tier === 'uhd') return 'Regal Cloud UHD';
  if (tier === 'hd') return 'Regal Cloud HD';
  return 'Regal Cloud';
}

/** Default monitor playback quality — Regal Cloud uses stable relayed WebRTC (WHEP). */
export function defaultStreamQualityForSession(
  planId: PlanTier,
  connectionMode: ConnectionMode,
): StreamQuality {
  if (connectionMode === 'mesh') return 'medium';
  if (planId === 'pro_master' || planId === 'universal' || planId === 'universal_studio') return 'high';
  if (planId === 'pro' || planId === 'universal_essential') return 'high';
  return 'auto';
}

export function planUsesRegalCloud(planId: PlanTier, connectionMode: ConnectionMode): boolean {
  if (connectionMode !== 'regal') return false;
  if (isUniversalPlanTier(planId)) return true;
  return planId === 'pro' || planId === 'pro_master';
}
