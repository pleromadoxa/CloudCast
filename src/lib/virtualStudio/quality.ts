/**
 * Rendering quality presets for the virtual studio.
 *
 * The stage auto-selects a preset from measured frame time and the operator can
 * pin one. Each preset is a deterministic bundle of renderer/effect settings so
 * behaviour is testable without a GPU.
 */

export type StudioQualityTier = 'low' | 'balanced' | 'high' | 'ultra';

export interface StudioQualityPreset {
  tier: StudioQualityTier;
  label: string;
  /** Device pixel ratio cap passed to the R3F canvas. */
  maxDpr: number;
  shadows: boolean;
  shadowMapSize: number;
  /** IBL environment cube resolution (px). */
  envResolution: number;
  /** Mipmapped bloom for emissive LED screens / practicals. */
  bloom: boolean;
  /** Cinematic depth of field on the beauty pass. */
  depthOfField: boolean;
  vignette: boolean;
  antialias: 'smaa' | 'msaa' | 'none';
  /** MSAA samples when antialias === 'msaa'. */
  msaaSamples: number;
  /** Contact/ambient occlusion approximation (screen-space). */
  ao: boolean;
}

export const STUDIO_QUALITY_PRESETS: Record<StudioQualityTier, StudioQualityPreset> = {
  low: {
    tier: 'low',
    label: 'Low',
    // Never drop to 1× on a retina panel — the upscale looks soft/blurry. 1.5×
    // keeps edges readable while staying cheap for weak GPUs.
    maxDpr: 1.5,
    shadows: false,
    shadowMapSize: 512,
    envResolution: 64,
    bloom: false,
    depthOfField: false,
    vignette: false,
    // never ship raw edges — SMAA is the cheapest clean option
    antialias: 'smaa',
    msaaSamples: 0,
    ao: false,
  },
  balanced: {
    tier: 'balanced',
    label: 'Balanced',
    // Match the native retina pixel ratio so the sets render crisp rather than
    // being upscaled (the "blurred" look on high-DPI displays).
    maxDpr: 2,
    shadows: true,
    shadowMapSize: 1024,
    envResolution: 128,
    bloom: true,
    // DOF is on from balanced — it costs one extra fullscreen pass and the
    // shot-driven focus (deep on wides, shallow on close-ups) is what sells
    // the sets as photographed rather than rendered. AO stays off here.
    depthOfField: true,
    vignette: true,
    antialias: 'smaa',
    msaaSamples: 0,
    ao: false,
  },
  high: {
    tier: 'high',
    label: 'High',
    maxDpr: 2,
    shadows: true,
    shadowMapSize: 2048,
    envResolution: 256,
    bloom: true,
    // Cinematic DOF runs from balanced up: the focus racks with the shot
    // (wide = deep focus, close-up = shallow) and is part of the photographic
    // language of every set, not an ultra-only luxury.
    depthOfField: true,
    vignette: true,
    antialias: 'msaa',
    msaaSamples: 4,
    // AO grounds furniture and set dressing against the floor.
    ao: true,
  },
  ultra: {
    tier: 'ultra',
    label: 'Ultra',
    maxDpr: 2,
    shadows: true,
    shadowMapSize: 4096,
    envResolution: 512,
    bloom: true,
    depthOfField: true,
    vignette: true,
    // 4x MSAA is visually indistinguishable from 8x here and half the cost —
    // the frame budget goes to AO + DOF instead
    antialias: 'msaa',
    msaaSamples: 4,
    ao: true,
  },
};

const ORDER: StudioQualityTier[] = ['low', 'balanced', 'high', 'ultra'];

export function studioQualityPreset(tier: StudioQualityTier): StudioQualityPreset {
  return STUDIO_QUALITY_PRESETS[tier];
}

/** Drop one tier — used when sustained frame time blows the budget. */
export function degradeQuality(tier: StudioQualityTier): StudioQualityTier {
  const index = ORDER.indexOf(tier);
  return ORDER[Math.max(0, index - 1)];
}

/** Raise one tier — used when the stage has headroom for a long stretch. */
export function improveQuality(tier: StudioQualityTier): StudioQualityTier {
  const index = ORDER.indexOf(tier);
  return ORDER[Math.min(ORDER.length - 1, index + 1)];
}

/**
 * Pick an initial tier from the device. Conservative on mobile GPUs and
 * machines that report few cores so the first frames still land on time.
 */
export function autoQualityTier(
  info: { cores?: number; memoryGb?: number; isMobile?: boolean } = {},
): StudioQualityTier {
  const cores = info.cores ?? (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4);
  const memory = info.memoryGb ?? (typeof navigator !== 'undefined' ? (navigator as { deviceMemory?: number }).deviceMemory || 8 : 8);
  const mobile = info.isMobile ?? (typeof navigator !== 'undefined' ? /Mobi|Android/i.test(navigator.userAgent) : false);

  if (mobile) return cores >= 8 && memory >= 6 ? 'balanced' : 'low';
  if (cores >= 12 && memory >= 16) return 'high';
  if (cores >= 8 && memory >= 8) return 'balanced';
  return 'balanced';
}

/** True when sustained frame time exceeds the target budget (e.g. 32ms). */
export function shouldDegrade(avgFrameMs: number, tier: StudioQualityTier): boolean {
  if (tier === 'low') return false;
  return avgFrameMs > 32;
}

/** True when the stage has been comfortably under budget and can level up. */
export function shouldImprove(avgFrameMs: number, tier: StudioQualityTier): boolean {
  if (tier === 'ultra') return false;
  return avgFrameMs < 16;
}
