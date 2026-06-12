export type PlanTier = 'free' | 'pro' | 'pro_master';
export type ConnectionMode = 'mesh' | 'regal';
export type DeviceType = 'mobile' | 'usb';

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
  plan_id: PlanTier;
  plan: SubscriptionPlan;
}

export const PLAN_LABELS: Record<PlanTier, string> = {
  free: 'Free',
  pro: 'Pro',
  pro_master: 'Pro Master',
};

export function formatPrice(cents: number): string {
  if (cents === 0) return 'Free';
  return `$${(cents / 100).toFixed(0)}/mo`;
}
