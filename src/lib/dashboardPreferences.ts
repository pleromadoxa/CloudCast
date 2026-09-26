import type { CloudCastProductId } from '../types/products';
import type { DashboardPreferences, UserProfile } from '../types/plans';

/** Defaults when profile has not synced preferences yet — dashboards are ON. */
export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
  audio_dashboard_enabled: true,
  prism_dashboard_enabled: true,
  replay_dashboard_enabled: true,
};

export function normalizeDashboardPreferences(
  raw: Partial<DashboardPreferences> | null | undefined,
): DashboardPreferences {
  return {
    audio_dashboard_enabled: raw?.audio_dashboard_enabled ?? DEFAULT_DASHBOARD_PREFERENCES.audio_dashboard_enabled,
    prism_dashboard_enabled: raw?.prism_dashboard_enabled ?? DEFAULT_DASHBOARD_PREFERENCES.prism_dashboard_enabled,
    replay_dashboard_enabled: raw?.replay_dashboard_enabled ?? DEFAULT_DASHBOARD_PREFERENCES.replay_dashboard_enabled,
  };
}

/** Products that can be toggled off from the dashboard settings. Video/Display/Symphony stay on. */
export function isToggleableDashboardProduct(product: CloudCastProductId): boolean {
  return product === 'audio_mixer' || product === 'regal_prism' || product === 'instant_replay';
}

/**
 * Per-account dashboard visibility (opt-out). This sits on top of the platform
 * service switch: the admin switch is authoritative (off = off, on = available),
 * and this preference only lets an account hide dashboards it does not use.
 */
export function isDashboardPreferenceEnabled(
  profile: UserProfile | null | undefined,
  product: CloudCastProductId,
): boolean {
  if (!profile) return false;
  const prefs = normalizeDashboardPreferences(profile.dashboard_preferences);
  if (product === 'audio_mixer') return prefs.audio_dashboard_enabled;
  if (product === 'regal_prism') return prefs.prism_dashboard_enabled;
  if (product === 'instant_replay') return prefs.replay_dashboard_enabled;
  // Video Mixer, Regal Display, Symphony — always available when entitled.
  return true;
}
