import type { User } from '@supabase/supabase-js';
import type { UserProfile } from '../types/plans';
import { DEFAULT_DASHBOARD_PREFERENCES } from './dashboardPreferences';
import { buildEntitlementsFromProfile } from './productEntitlements';

/** Last-resort profile so production consoles can load when `get_user_profile` is slow or fails. */
export function buildBootstrapFallbackProfile(user: User): UserProfile {
  const plan_id = 'free' as const;
  return {
    id: user.id,
    email: user.email ?? null,
    full_name: user.user_metadata?.full_name ? String(user.user_metadata.full_name) : null,
    plan_id,
    plan: {
      id: plan_id,
      name: 'Free',
      max_mobile_devices: 2,
      max_usb_devices: 0,
      max_total_channels: 2,
      connection_mode: 'mesh',
      price_monthly_cents: 0,
      features: [],
    },
    entitlements: buildEntitlementsFromProfile({ plan_id }),
    dashboard_preferences: { ...DEFAULT_DASHBOARD_PREFERENCES },
  };
}
