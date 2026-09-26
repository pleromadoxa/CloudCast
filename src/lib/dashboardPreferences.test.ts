import { describe, expect, it, beforeEach } from 'vitest';
import {
  DEFAULT_DASHBOARD_PREFERENCES,
  isDashboardPreferenceEnabled,
  normalizeDashboardPreferences,
} from './dashboardPreferences';
import { canAccessProduct, hasProductEntitlement } from './productEntitlements';
import { defaultPlatformProductServiceMap, setPlatformProductServiceMap } from './platformProductServices';
import type { UserProfile } from '../types/plans';

function freeProfile(overrides?: Partial<UserProfile>): UserProfile {
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
    dashboard_preferences: { ...DEFAULT_DASHBOARD_PREFERENCES },
    ...overrides,
  };
}

describe('dashboard preferences', () => {
  beforeEach(() => {
    setPlatformProductServiceMap(defaultPlatformProductServiceMap());
  });

  it('defaults every dashboard on (opt-out model)', () => {
    expect(normalizeDashboardPreferences(undefined)).toEqual({
      audio_dashboard_enabled: true,
      prism_dashboard_enabled: true,
      replay_dashboard_enabled: true,
    });
  });

  it('grants access by default while keeping Free entitlement', () => {
    const profile = freeProfile();
    expect(hasProductEntitlement(profile, 'regal_prism')).toBe(true);
    expect(hasProductEntitlement(profile, 'instant_replay')).toBe(true);
    expect(canAccessProduct(profile, 'audio_mixer')).toBe(true);
    expect(canAccessProduct(profile, 'regal_prism')).toBe(true);
    expect(canAccessProduct(profile, 'instant_replay')).toBe(true);
    expect(canAccessProduct(profile, 'video_mixer')).toBe(true);
  });

  it('hides a dashboard when the account opts out', () => {
    const profile = freeProfile({
      dashboard_preferences: {
        audio_dashboard_enabled: true,
        prism_dashboard_enabled: false,
        replay_dashboard_enabled: true,
      },
    });
    expect(isDashboardPreferenceEnabled(profile, 'regal_prism')).toBe(false);
    expect(canAccessProduct(profile, 'regal_prism')).toBe(false);
    expect(canAccessProduct(profile, 'instant_replay')).toBe(true);
    expect(canAccessProduct(profile, 'audio_mixer')).toBe(true);
  });

  it('admin service switch is authoritative: off blocks, on resumes', () => {
    const profile = freeProfile();
    setPlatformProductServiceMap({ regal_prism: false });
    expect(canAccessProduct(profile, 'regal_prism')).toBe(false);
    expect(canAccessProduct(profile, 'video_mixer')).toBe(true);

    // Turning the service back on must resume access without extra steps.
    setPlatformProductServiceMap({ regal_prism: true });
    expect(canAccessProduct(profile, 'regal_prism')).toBe(true);
  });
});
