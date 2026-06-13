import type { PlanTier, UniversalPlanTier } from './plans';

/** CloudCast broadcast products under the main company brand. */
export type CloudCastProductId =
  | 'video_mixer'
  | 'audio_mixer'
  | 'symphony_studio'
  | 'instant_replay'
  | 'regal_display'
  | 'regal_prism';

export interface CloudCastProduct {
  id: CloudCastProductId;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  dashboardPath: string;
  pricingPath: string;
  /** Accent for product cards */
  accent: 'red' | 'blue' | 'purple' | 'emerald' | 'amber';
}

export interface ProductEntitlements {
  video_plan_id: PlanTier;
  audio_plan_id: PlanTier;
  symphony_plan_id: PlanTier;
  replay_plan_id: PlanTier;
  prism_plan_id: PlanTier;
  /** When true, user has an all-products Universal bundle. */
  universal: boolean;
  /** Which Universal bundle tier — Essential, Studio, or Master. */
  universal_tier?: UniversalPlanTier;
}

export interface ProductSubscriptionSummary {
  product: CloudCastProductId;
  plan_id: PlanTier;
  label: string;
  hasAccess: boolean;
}
