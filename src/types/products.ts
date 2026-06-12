import type { PlanTier } from './plans';

/** CloudCast broadcast products under the main company brand. */
export type CloudCastProductId = 'video_mixer' | 'audio_mixer' | 'symphony_studio' | 'instant_replay';

export interface CloudCastProduct {
  id: CloudCastProductId;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  dashboardPath: string;
  pricingPath: string;
  /** Accent for product cards */
  accent: 'red' | 'blue' | 'purple' | 'emerald';
}

export interface ProductEntitlements {
  video_plan_id: PlanTier;
  audio_plan_id: PlanTier;
  symphony_plan_id: PlanTier;
  replay_plan_id: PlanTier;
  /** When true, all products use Pro Master–level features. */
  universal: boolean;
}

export interface ProductSubscriptionSummary {
  product: CloudCastProductId;
  plan_id: PlanTier;
  label: string;
  hasAccess: boolean;
}
