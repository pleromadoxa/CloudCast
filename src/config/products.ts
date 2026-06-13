import type { CloudCastProduct, CloudCastProductId } from '../types/products';
import type { PlanTier, ProductPlanTier, UniversalPlanTier } from '../types/plans';
import { isUniversalPlanTier } from '../types/plans';

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
  {
    id: 'regal_display',
    name: 'Regal Display',
    shortName: 'Display',
    tagline: 'Presentation & scripture engine for worship and events',
    description:
      'EasyWorship-style slides, scriptures, custom fields, backgrounds, and media — outputs a Display Feed video source you can switch live on the Video Mixer.',
    dashboardPath: '/display',
    pricingPath: '/pricing?product=video_mixer',
    accent: 'purple',
  },
  {
    id: 'regal_prism',
    name: 'Regal Prism',
    shortName: 'Prism',
    tagline: 'Real-time virtual production & augmented reality studio',
    description:
      'Live chroma keying, 3D virtual sets, AR compositing, camera tracking, and talent shadows — browser-native virtual production rivaling desktop VP platforms, with Video Mixer feed output on Pro Master.',
    dashboardPath: '/prism',
    pricingPath: '/pricing?product=regal_prism',
    accent: 'amber',
  },
];

export const UNIVERSAL_PLAN_ID = 'universal' as const;
export { UNIVERSAL_PLAN_IDS } from '../types/plans';

/** Monthly prices in cents — mirrored across video and audio products. */
export const PRODUCT_TIER_PRICES: Record<ProductPlanTier, number> = {
  free: 0,
  pro: 2900,
  pro_master: 7900,
};

/** CloudCast Universal bundle tiers — all six products, tiered feature levels. */
export interface UniversalTierDefinition {
  id: UniversalPlanTier;
  name: string;
  shortName: string;
  tagline: string;
  priceCents: number;
  compareAtCents: number;
  highlight?: boolean;
  badge?: string;
  features: string[];
  productTiers: Record<'video_mixer' | 'audio_mixer' | 'symphony_studio' | 'regal_prism', ProductPlanTier>;
}

export const UNIVERSAL_TIERS: UniversalTierDefinition[] = [
  {
    id: 'universal_essential',
    name: 'Universal Essential',
    shortName: 'Essential',
    tagline: 'Every product. Pro features. One affordable bill.',
    priceCents: 5900,
    compareAtCents: 13600,
    features: [
      'All six CloudCast products included',
      'Pro tier on Video, Audio, Symphony & Regal Prism',
      'CloudCast Replay & Regal Display via Video Mixer',
      '5 video inputs · 8ch audio · 16-track DAW · 1080p VP',
      'Audio ↔ Video bridge — mix PGM across consoles',
      'Regal Cloud HD streaming',
    ],
    productTiers: {
      video_mixer: 'pro',
      audio_mixer: 'pro',
      symphony_studio: 'pro',
      regal_prism: 'pro',
    },
  },
  {
    id: 'universal_studio',
    name: 'Universal Studio',
    shortName: 'Studio',
    tagline: 'Production-grade video & audio, creative tools at Pro.',
    priceCents: 9900,
    compareAtCents: 23600,
    highlight: true,
    badge: 'BEST VALUE',
    features: [
      'All six CloudCast products included',
      'Pro Master on Video Mixer, Audio Mixer & Replay',
      'Pro on Symphony & Regal Prism',
      '11 video inputs · 16ch audio · 16 replay banks',
      '32-track DAW · 2-camera 1080p virtual production',
      'Audio ↔ Video bridge · Regal Cloud UHD on video',
    ],
    productTiers: {
      video_mixer: 'pro_master',
      audio_mixer: 'pro_master',
      symphony_studio: 'pro',
      regal_prism: 'pro',
    },
  },
  {
    id: 'universal',
    name: 'Universal Master',
    shortName: 'Master',
    tagline: 'The full CloudCast suite — nothing held back.',
    priceCents: 14900,
    compareAtCents: 36600,
    badge: 'FLAGSHIP',
    features: [
      'All six CloudCast products included',
      'Pro Master on every product — no compromises',
      '11 video · 16ch audio · 32-track DAW · 4K VP',
      '16 replay banks · unlimited virtual sets · XR mode',
      '100GB cloud storage · priority support',
      'Multi-stream · multiple YouTube accounts',
    ],
    productTiers: {
      video_mixer: 'pro_master',
      audio_mixer: 'pro_master',
      symphony_studio: 'pro_master',
      regal_prism: 'pro_master',
    },
  },
];

export const UNIVERSAL_TIER_BY_ID: Record<UniversalPlanTier, UniversalTierDefinition> = Object.fromEntries(
  UNIVERSAL_TIERS.map((tier) => [tier.id, tier]),
) as Record<UniversalPlanTier, UniversalTierDefinition>;

/** Lowest Universal bundle price — for "from $X/mo" marketing. */
export const UNIVERSAL_PLAN_FROM_CENTS = UNIVERSAL_TIERS[0].priceCents;

/** Flagship Universal Master price. */
export const UNIVERSAL_PLAN_PRICE_CENTS = UNIVERSAL_TIER_BY_ID.universal.priceCents;

export function universalProductTier(
  universalPlan: UniversalPlanTier,
  product: 'video_mixer' | 'audio_mixer' | 'symphony_studio' | 'regal_prism',
): ProductPlanTier {
  return UNIVERSAL_TIER_BY_ID[universalPlan].productTiers[product];
}

/** Resolve product-scoped limits when the caller only has a profile plan_id (may be a Universal bundle). */
export function audioChannelsForPlan(planId: PlanTier): number {
  if (isUniversalPlanTier(planId)) {
    return AUDIO_MIXER_CHANNELS[universalProductTier(planId, 'audio_mixer')];
  }
  return AUDIO_MIXER_CHANNELS[planId as ProductPlanTier] ?? 4;
}

export function prismCloudScenesForPlan(planId: PlanTier): number {
  if (isUniversalPlanTier(planId)) {
    return PRISM_CLOUD_SCENES[universalProductTier(planId, 'regal_prism')];
  }
  return PRISM_CLOUD_SCENES[planId as ProductPlanTier] ?? 1;
}

/** Regal Prism uses premium VP pricing — Aximetry-class features at SaaS rates. */
export const PRISM_TIER_PRICES: Record<ProductPlanTier, number> = {
  free: 0,
  pro: 4900,
  pro_master: 12900,
};

/** Always render 16 faders; inactive slots are plan-locked. */
export const AUDIO_MIXER_MAX_CHANNELS = 16;

export const AUDIO_MIXER_CHANNELS: Record<ProductPlanTier, number> = {
  free: 4,
  pro: 8,
  pro_master: 16,
};

export function getProduct(id: CloudCastProductId): CloudCastProduct {
  const product = CLOUDCAST_PRODUCTS.find((p) => p.id === id);
  if (!product) throw new Error(`Unknown product: ${id}`);
  return product;
}

/** Symphony track limits by plan tier. */
export const SYMPHONY_TRACKS: Record<ProductPlanTier, number> = {
  free: 4,
  pro: 16,
  pro_master: 32,
};

/** Regal Cloud Archive project quota (MB) by plan. */
export const SYMPHONY_CLOUD_PROJECTS: Record<ProductPlanTier, number> = {
  free: 3,
  pro: 25,
  pro_master: 100,
};

export function parseProductId(value: string | null | undefined): CloudCastProductId | null {
  if (
    value === 'video_mixer' ||
    value === 'audio_mixer' ||
    value === 'symphony_studio' ||
    value === 'instant_replay' ||
    value === 'regal_display' ||
    value === 'regal_prism'
  ) {
    return value;
  }
  return null;
}

/** Simultaneous camera inputs by plan tier. */
export const PRISM_CAMERAS: Record<ProductPlanTier, number> = {
  free: 1,
  pro: 2,
  pro_master: 4,
};

/** Virtual set library slots by plan tier (99 = unlimited). */
export const PRISM_VIRTUAL_SETS: Record<ProductPlanTier, number> = {
  free: 3,
  pro: 12,
  pro_master: 99,
};

/** Cloud-saved VP scenes by plan tier. */
export const PRISM_CLOUD_SCENES: Record<ProductPlanTier, number> = {
  free: 1,
  pro: 10,
  pro_master: 50,
};

/** Max output resolution label by plan tier. */
export const PRISM_OUTPUT_QUALITY: Record<ProductPlanTier, string> = {
  free: '720p (watermark)',
  pro: '1080p HD',
  pro_master: '4K UHD',
};

/** Program output capture dimensions by plan tier. */
export const PRISM_CAPTURE_DIMENSIONS: Record<ProductPlanTier, { width: number; height: number }> = {
  free: { width: 1280, height: 720 },
  pro: { width: 1920, height: 1080 },
  pro_master: { width: 3840, height: 2160 },
};

/** Monthly price in cents for a product tier. */
export function tierPriceCents(product: CloudCastProductId, tier: ProductPlanTier): number {
  if (product === 'regal_prism') return PRISM_TIER_PRICES[tier];
  return PRODUCT_TIER_PRICES[tier];
}

/** Replay bank slots by plan tier. */
export const REPLAY_BANKS: Record<ProductPlanTier, number> = {
  free: 2,
  pro: 8,
  pro_master: 16,
};

/** Rolling buffer length in seconds by plan tier. */
export const REPLAY_BUFFER_SECONDS: Record<ProductPlanTier, number> = {
  free: 30,
  pro: 120,
  pro_master: 300,
};
