import darkLogo from '../assets/logos/cloudcast-regal-dark.png';
import darkHeaderLogo from '../assets/logos/cloudcast-regal-dark-header.png';
import lightLogo from '../assets/logos/cloudcast-regal-light.png';
import type { ConnectionMode, PlanTier, ProductPlanTier, UserProfile } from '../types/plans';
import { isUniversalPlanTier } from '../types/plans';
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

export const PLAN_STREAM_QUALITY: Record<ProductPlanTier, string> = {
  free: 'Standard',
  pro: 'HD streaming',
  pro_master: 'UHD streaming',
};

export const UNIVERSAL_STREAM_QUALITY: Record<'universal_essential' | 'universal_studio' | 'universal', string> = {
  universal_essential: 'All products · HD',
  universal_studio: 'All products · UHD video',
  universal: 'All products · UHD',
};

export const PLAN_FEATURE_OVERRIDES: Partial<Record<PlanTier, string[]>> = {
  free: [
    '2 mobile cameras',
    'Regal Mesh direct connect',
    'Basic video mixer',
    'CloudCast Replay — 2 banks, 30s buffer',
    'Access code pairing',
    'Stream to 1 destination (YouTube or Custom)',
  ],
  pro: [
    '5 video inputs (4 mobile + 1 IP camera URL)',
    'Regal Cloud — HD streaming',
    'CloudCast Replay — 8 banks, 2-min buffer, cloud clips',
    'Global low-latency delivery',
    'Full mixer controls',
    'Multi-stream to YouTube, Twitch & Custom',
    '50GB cloud storage for video recordings',
  ],
  pro_master: [
    '11 video inputs (8 mobile + 2 USB + 1 IP camera URL)',
    'Regal Cloud — UHD streaming',
    'CloudCast Replay — 16 banks, 5-min buffer, multi-angle sync',
    'Priority support',
    'Multi-stream + multiple YouTube accounts',
    '100GB cloud storage for video recordings',
  ],
  universal_essential: [
    'Video Mixer + Audio Mixer + Symphony + Replay + Regal Prism + Regal Display',
    'Pro tier on every broadcast product',
    '5 video inputs · 8ch audio · 16-track DAW · 1080p VP',
    'Audio ↔ Video bridge included',
    'Regal Cloud HD streaming',
  ],
  universal_studio: [
    'Video Mixer + Audio Mixer + Symphony + Replay + Regal Prism + Regal Display',
    'Pro Master on Video, Audio & Replay · Pro on Symphony & Prism',
    '11 video inputs · 16ch audio · 32-track DAW · 2-camera VP',
    'Audio ↔ Video bridge · Regal Cloud UHD',
    'Best value for growing productions',
  ],
  universal: [
    'Video Mixer + Audio Mixer + Symphony + Replay + Regal Prism + Regal Display',
    'Pro Master features on every broadcast product',
    '16-channel audio · 11 video inputs · 32-track DAW · 4K VP',
    'Regal Cloud UHD · multi-stream · 100GB storage',
    'Priority support · one subscription for the full suite',
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
  if (isUniversalPlanTier(planId)) return UNIVERSAL_STREAM_QUALITY[planId];
  return PLAN_STREAM_QUALITY[planId as ProductPlanTier];
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
