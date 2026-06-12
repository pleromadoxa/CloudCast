import type { CloudCastProduct, CloudCastProductId } from '../types/products';
import type { PlanTier } from '../types/plans';

export const CLOUDCAST_PRODUCTS: CloudCastProduct[] = [
  {
    id: 'video_mixer',
    name: 'CloudCast Video Mixer',
    shortName: 'Video',
    tagline: 'Multi-channel video production switcher',
    description:
      'PST/PGM monitors, transitions, graphics, chroma key, device pairing, and live streaming — a full broadcast switcher in your browser.',
    dashboardPath: '/dashboard',
    pricingPath: '/pricing?product=video_mixer',
    accent: 'red',
  },
  {
    id: 'audio_mixer',
    name: 'CloudCast Audio Mixer',
    shortName: 'Audio',
    tagline: 'Multi-channel broadcast audio console',
    description:
      '16-channel digital console with spectrum display, phone/USB/alternative inputs via CloudCast Audio Mobile, solo/mute, monitor bus, and PGM master — link to the video mixer with a bridge code on Universal.',
    dashboardPath: '/audio',
    pricingPath: '/pricing?product=audio_mixer',
    accent: 'blue',
  },
  {
    id: 'symphony_studio',
    name: 'CloudCast Symphony',
    shortName: 'Symphony',
    tagline: 'Professional online music studio & DAW',
    description:
      'Multi-track arrangement, piano roll, synthesizer & string libraries, loop browser, automation lanes, and mixdown export — compose, produce, and mix entirely in the browser. Projects sync to Regal Cloud Archive.',
    dashboardPath: '/symphony',
    pricingPath: '/pricing?product=symphony_studio',
    accent: 'purple',
  },
  {
    id: 'instant_replay',
    name: 'CloudCast Replay',
    shortName: 'Replay',
    tagline: 'Instant replay & clip engine for live events',
    description:
      'Rolling buffer capture, mark in/out, slow-motion review, multi-angle sync, and one-click PGM push — included with your Video Mixer plan at no extra cost.',
    dashboardPath: '/replay',
    pricingPath: '/pricing?product=video_mixer',
    accent: 'emerald',
  },
];

export const UNIVERSAL_PLAN_ID = 'universal' as const;

/** Monthly prices in cents — mirrored across video and audio products. */
export const PRODUCT_TIER_PRICES: Record<Exclude<PlanTier, typeof UNIVERSAL_PLAN_ID>, number> = {
  free: 0,
  pro: 2900,
  pro_master: 7900,
};

export const UNIVERSAL_PLAN_PRICE_CENTS = 11900;

/** Always render 16 faders; inactive slots are plan-locked. */
export const AUDIO_MIXER_MAX_CHANNELS = 16;

export const AUDIO_MIXER_CHANNELS: Record<PlanTier, number> = {
  free: 4,
  pro: 8,
  pro_master: 16,
  universal: 16,
};

export function getProduct(id: CloudCastProductId): CloudCastProduct {
  const product = CLOUDCAST_PRODUCTS.find((p) => p.id === id);
  if (!product) throw new Error(`Unknown product: ${id}`);
  return product;
}

/** Symphony track limits by plan tier. */
export const SYMPHONY_TRACKS: Record<PlanTier, number> = {
  free: 4,
  pro: 16,
  pro_master: 32,
  universal: 32,
};

/** Regal Cloud Archive project quota (MB) by plan. */
export const SYMPHONY_CLOUD_PROJECTS: Record<PlanTier, number> = {
  free: 3,
  pro: 25,
  pro_master: 100,
  universal: 100,
};

export function parseProductId(value: string | null | undefined): CloudCastProductId | null {
  if (
    value === 'video_mixer' ||
    value === 'audio_mixer' ||
    value === 'symphony_studio' ||
    value === 'instant_replay'
  ) {
    return value;
  }
  return null;
}

/** Replay bank slots by plan tier. */
export const REPLAY_BANKS: Record<PlanTier, number> = {
  free: 2,
  pro: 8,
  pro_master: 16,
  universal: 16,
};

/** Rolling buffer length in seconds by plan tier. */
export const REPLAY_BUFFER_SECONDS: Record<PlanTier, number> = {
  free: 30,
  pro: 120,
  pro_master: 300,
  universal: 300,
};
