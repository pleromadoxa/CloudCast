import darkLogo from '../assets/logos/cloudcast-regal-dark.png';
import darkHeaderLogo from '../assets/logos/cloudcast-regal-dark-header.png';
import lightLogo from '../assets/logos/cloudcast-regal-light.png';
import type { ConnectionMode, PlanTier, UserProfile } from '../types/plans';
import type { MixerSession } from '../types/session';
import { resolvePlanTotalChannels } from './planLimits';

/** Brand logos — dark variant for dark UI, light variant for light backgrounds. */
export const CLOUDCAST_LOGO = {
  dark: darkLogo,
  /** Icon + wordmark without the navy badge — for compact headers on dark pages. */
  'dark-header': darkHeaderLogo,
  light: lightLogo,
} as const;

/** Shared nav/header logo — landing, auth, and dashboard. */
export const CLOUDCAST_NAV_LOGO = {
  variant: 'dark-header' as const,
  className: 'h-8 sm:h-9',
};

/** User-facing labels — never expose third-party infrastructure names. */
export const CONNECTION_MODE_LABELS: Record<ConnectionMode, string> = {
  mesh: 'Regal Mesh',
  regal: 'Regal Cloud',
};

export const CONNECTION_MODE_SHORT: Record<ConnectionMode, string> = {
  mesh: 'MESH',
  regal: 'REGAL HD+',
};

export const PLAN_STREAM_QUALITY: Record<PlanTier, string> = {
  free: 'Standard',
  pro: 'HD streaming',
  pro_master: 'UHD streaming',
};

export const PLAN_FEATURE_OVERRIDES: Partial<Record<PlanTier, string[]>> = {
  free: [
    '2 mobile cameras',
    'Regal Mesh direct connect',
    'Basic video mixer',
    'Access code pairing',
    'Stream to 1 destination (YouTube or Custom)',
  ],
  pro: [
    '5 video inputs (4 mobile + 1 IP camera URL)',
    'Regal Cloud — HD streaming',
    'Global low-latency delivery',
    'Full mixer controls',
    'Multi-stream to YouTube, Twitch & Custom',
    '50GB cloud storage for video recordings',
  ],
  pro_master: [
    '11 video inputs (8 mobile + 2 USB + 1 IP camera URL)',
    'Regal Cloud — UHD streaming',
    'Priority support',
    'Multi-stream + multiple YouTube accounts',
    '100GB cloud storage for video recordings',
  ],
};

/** Normalize legacy API values without leaking vendor names. */
export function normalizeConnectionMode(value: string | null | undefined): ConnectionMode {
  if (value === 'regal' || value === 'cloudflare') return 'regal';
  return 'mesh';
}

export function connectionModeLabel(mode: ConnectionMode | string): string {
  return CONNECTION_MODE_LABELS[normalizeConnectionMode(mode)];
}

export function connectionModeShort(mode: ConnectionMode | string): string {
  return CONNECTION_MODE_SHORT[normalizeConnectionMode(mode)];
}

export function streamQualityForPlan(planId: PlanTier): string {
  return PLAN_STREAM_QUALITY[planId];
}

export function displayFeaturesForPlan(planId: PlanTier, fallback: string[]): string[] {
  return PLAN_FEATURE_OVERRIDES[planId] ?? fallback;
}

/** Device slot limit for UI — prefer synced session, then profile plan, default free tier. */
export function resolveDeviceLimit(
  session: MixerSession | null,
  profile: UserProfile | null,
): number {
  const planId = profile?.plan_id ?? session?.planId ?? 'free';
  const fromSession = session?.maxDevices;
  const fromPlan = profile?.plan.max_total_channels;
  return resolvePlanTotalChannels(planId, fromSession ?? fromPlan);
}
