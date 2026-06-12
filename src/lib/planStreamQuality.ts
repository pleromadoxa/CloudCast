import type { StreamQuality } from '../types/device';
import type { ConnectionMode, PlanTier } from '../types/plans';

/** User-facing ingest/playback tier for Regal Cloud. */
export type RegalQualityTier = 'standard' | 'hd' | 'uhd';

export function regalQualityTierForPlan(planId: PlanTier): RegalQualityTier {
  if (planId === 'pro_master') return 'uhd';
  if (planId === 'pro') return 'hd';
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
  if (planId === 'pro_master') return 'high';
  if (planId === 'pro') return 'high';
  return 'auto';
}

export function planUsesRegalCloud(planId: PlanTier, connectionMode: ConnectionMode): boolean {
  return connectionMode === 'regal' && (planId === 'pro' || planId === 'pro_master');
}
