import { describe, expect, it, beforeEach } from 'vitest';
import {
  defaultPlatformProductServiceMap,
  isPlatformProductEnabled,
  normalizePlatformProductServiceMap,
  setPlatformProductServiceMap,
} from './platformProductServices';
import { canAccessProduct } from './productEntitlements';
import { DEFAULT_DASHBOARD_PREFERENCES } from './dashboardPreferences';
import type { UserProfile } from '../types/plans';

function freeProfile(): UserProfile {
  return {
    id: 'user-1',
    email: 'user@example.com',
    full_name: 'Test',
    plan_id: 'free',
    plan: {
      id: 'free',
      name: 'Free',
      max_mobile_devices: 2,
      max_usb_devices: 0,
      max_total_channels: 2,
      connection_mode: 'mesh',
      price_monthly_cents: 0,
      features: [],
    },
    entitlements: {
      video_plan_id: 'free',
      audio_plan_id: 'free',
      symphony_plan_id: 'free',
      replay_plan_id: 'free',
      prism_plan_id: 'free',
      universal: false,
    },
    dashboard_preferences: {
      ...DEFAULT_DASHBOARD_PREFERENCES,
      audio_dashboard_enabled: true,
      prism_dashboard_enabled: true,
      replay_dashboard_enabled: true,
    },
  };
}

describe('platform product services', () => {
  beforeEach(() => {
    setPlatformProductServiceMap(defaultPlatformProductServiceMap());
  });

  it('defaults every product enabled', () => {
    const map = defaultPlatformProductServiceMap();
    expect(map.video_mixer).toBe(true);
    expect(map.audio_mixer).toBe(true);
    expect(map.instant_replay).toBe(true);
    expect(isPlatformProductEnabled('symphony_studio')).toBe(true);
  });

  it('normalizes rows into a full map', () => {
    const map = normalizePlatformProductServiceMap([
      { product_id: 'audio_mixer', is_enabled: false },
      { product_id: 'instant_replay', is_enabled: false },
    ]);
    expect(map.audio_mixer).toBe(false);
    expect(map.instant_replay).toBe(false);
    expect(map.video_mixer).toBe(true);
  });

  it('blocks canAccessProduct when a service is disabled', () => {
    const profile = freeProfile();
    expect(canAccessProduct(profile, 'audio_mixer')).toBe(true);
    setPlatformProductServiceMap({ audio_mixer: false });
    expect(isPlatformProductEnabled('audio_mixer')).toBe(false);
    expect(canAccessProduct(profile, 'audio_mixer')).toBe(false);
    expect(canAccessProduct(profile, 'video_mixer')).toBe(true);
  });
});
