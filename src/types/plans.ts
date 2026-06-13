export const UNIVERSAL_PLAN_IDS = ['universal_essential', 'universal_studio', 'universal'] as const;
export type UniversalPlanTier = (typeof UNIVERSAL_PLAN_IDS)[number];

export type PlanTier = 'free' | 'pro' | 'pro_master' | UniversalPlanTier;
export type ConnectionMode = 'mesh' | 'regal';
export type DeviceType = 'mobile' | 'usb';

/** Tiers available for individual product subscriptions (not Universal bundles). */
export type ProductPlanTier = 'free' | 'pro' | 'pro_master';

export interface SubscriptionPlan {
  id: PlanTier;
  name: string;
  max_mobile_devices: number;
  max_usb_devices: number;
  max_total_channels: number;
  connection_mode: ConnectionMode;
  price_monthly_cents: number;
  features: string[];
}

export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  /** Legacy primary plan — video mixer when product plans are not split. */
  plan_id: PlanTier;
  plan: SubscriptionPlan;
  /** Per-product plans when set by backend (optional). */
  entitlements?: import('./products').ProductEntitlements;
}

export const PLAN_LABELS: Record<PlanTier, string> = {
  free: 'Free',
  pro: 'Pro',
  pro_master: 'Pro Master',
  universal_essential: 'Universal Essential',
  universal_studio: 'Universal Studio',
  universal: 'Universal Master',
};

export const PRODUCT_PLAN_LABELS: Record<ProductPlanTier, string> = {
  free: 'Free',
  pro: 'Pro',
  pro_master: 'Pro Master',
};

export function isUniversalPlanTier(planId: PlanTier | null | undefined): planId is UniversalPlanTier {
  return planId === 'universal_essential' || planId === 'universal_studio' || planId === 'universal';
}

export function formatPrice(cents: number): string {
  if (cents === 0) return 'Free';
  return `$${(cents / 100).toFixed(0)}/mo`;
}

export function isProductPlanTier(value: string): value is ProductPlanTier {
  return value === 'free' || value === 'pro' || value === 'pro_master';
}
