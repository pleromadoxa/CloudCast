/**
 * Engine scalability system.
 *
 * Modeled on Unreal's scalability groups: a preset is a deterministic bundle
 * of kernel settings (resolution, AA, shadows, AO, post chain), the operator
 * can pin one, and the background engine nudges render scale — then whole
 * presets — to hold the frame budget. All logic here is pure so it is unit
 * tested without a GPU.
 */
import type {
  AntiAliasingMode,
  RenderEngineSettings,
  RenderQualityPreset,
} from './types';

/** The virtual-studio tier names (see `src/lib/virtualStudio/quality.ts`). */
export type StudioQualityTierName = 'low' | 'balanced' | 'high' | 'ultra';

export interface EngineQualityProfile {
  preset: RenderQualityPreset;
  label: string;
  /** Internal render resolution multiplier. */
  renderScale: number;
  antiAliasing: AntiAliasingMode;
  msaaSamples: number;
  shadows: boolean;
  shadowQuality: 'low' | 'medium' | 'high' | 'ultra';
  gtao: boolean;
  bloom: boolean;
  depthOfField: boolean;
  vignette: boolean;
  sharpen: boolean;
  filmGrain: boolean;
  chromaticAberration: boolean;
  hdrOutput: boolean;
}

export const ENGINE_QUALITY_PROFILES: Record<
  Exclude<RenderQualityPreset, 'custom'>,
  EngineQualityProfile
> = {
  performance: {
    preset: 'performance',
    label: 'Performance',
    renderScale: 0.8,
    antiAliasing: 'fxaa',
    msaaSamples: 0,
    shadows: true,
    shadowQuality: 'low',
    gtao: false,
    bloom: true,
    depthOfField: false,
    vignette: true,
    sharpen: true,
    filmGrain: false,
    chromaticAberration: false,
    hdrOutput: false,
  },
  balanced: {
    preset: 'balanced',
    label: 'Balanced',
    renderScale: 1,
    antiAliasing: 'smaa',
    msaaSamples: 4,
    shadows: true,
    shadowQuality: 'medium',
    gtao: true,
    bloom: true,
    depthOfField: false,
    vignette: true,
    sharpen: true,
    filmGrain: true,
    chromaticAberration: false,
    hdrOutput: true,
  },
  quality: {
    preset: 'quality',
    label: 'Quality',
    renderScale: 1.25,
    antiAliasing: 'msaa',
    msaaSamples: 4,
    shadows: true,
    shadowQuality: 'high',
    gtao: true,
    bloom: true,
    depthOfField: true,
    vignette: true,
    sharpen: true,
    filmGrain: true,
    chromaticAberration: true,
    hdrOutput: true,
  },
  cinematic: {
    preset: 'cinematic',
    label: 'Cinematic',
    renderScale: 1.5,
    antiAliasing: 'taa',
    msaaSamples: 8,
    shadows: true,
    shadowQuality: 'ultra',
    gtao: true,
    bloom: true,
    depthOfField: true,
    vignette: true,
    sharpen: true,
    filmGrain: true,
    chromaticAberration: true,
    hdrOutput: true,
  },
};

const PRESET_ORDER: RenderQualityPreset[] = ['performance', 'balanced', 'quality', 'cinematic'];

export function engineQualityProfile(preset: RenderQualityPreset): EngineQualityProfile | null {
  if (preset === 'custom') return null;
  return ENGINE_QUALITY_PROFILES[preset];
}

export function shadowMapSizeFor(quality: 'low' | 'medium' | 'high' | 'ultra'): number {
  switch (quality) {
    case 'low':
      return 1024;
    case 'medium':
      return 2048;
    case 'high':
      return 4096;
    case 'ultra':
      return 8192;
  }
}

/**
 * Fill every preset-managed field from the preset. `custom` is left alone —
 * the operator owns each value individually.
 */
export function applyPresetToSettings(
  settings: RenderEngineSettings,
  preset: RenderQualityPreset,
): RenderEngineSettings {
  const profile = engineQualityProfile(preset);
  if (!profile) return { ...settings, quality: 'custom' };
  return {
    ...settings,
    quality: preset,
    renderScale: profile.renderScale,
    antiAliasing: profile.antiAliasing,
    msaaSamples: profile.msaaSamples || settings.msaaSamples,
    shadows: profile.shadows,
    shadowQuality: profile.shadowQuality,
    gtao: profile.gtao,
    bloom: profile.bloom,
    depthOfField: profile.depthOfField,
    vignette: profile.vignette,
    sharpen: profile.sharpen,
    filmGrain: profile.filmGrain,
    chromaticAberration: profile.chromaticAberration,
    hdrOutput: profile.hdrOutput,
  };
}

/** Preset-managed fields — the intersection of profile and settings keys. */
type ProfileField = Extract<keyof EngineQualityProfile, keyof RenderEngineSettings>;

const PROFILE_FIELDS: ProfileField[] = [
  'antiAliasing',
  'msaaSamples',
  'shadows',
  'shadowQuality',
  'gtao',
  'bloom',
  'depthOfField',
  'vignette',
  'sharpen',
  'filmGrain',
  'chromaticAberration',
  'hdrOutput',
];

function matchesProfile(settings: RenderEngineSettings, profile: EngineQualityProfile): boolean {
  for (const field of PROFILE_FIELDS) {
    // `msaaSamples: 0` marks a preset that doesn't manage MSAA (its AA is
    // FXAA/SMAA/etc.) — the operator's sample count is left alone in that
    // case, so it must not participate in the identity check.
    if (field === 'msaaSamples' && profile.msaaSamples === 0) continue;
    if (settings[field] !== profile[field]) return false;
  }
  return Math.abs(settings.renderScale - profile.renderScale) < 0.01;
}

/**
 * Which preset the current settings actually correspond to. Deviating from
 * every bundle marks the settings `custom`.
 */
export function derivePresetFromSettings(settings: RenderEngineSettings): RenderQualityPreset {
  for (const preset of PRESET_ORDER) {
    const profile = ENGINE_QUALITY_PROFILES[preset as Exclude<RenderQualityPreset, 'custom'>];
    if (profile && matchesProfile(settings, profile)) return preset;
  }
  return 'custom';
}

/** Bridge to the virtual studio's tier vocabulary. */
export function studioTierForQuality(preset: RenderQualityPreset): StudioQualityTierName {
  switch (preset) {
    case 'performance':
      return 'low';
    case 'balanced':
      return 'balanced';
    case 'quality':
      return 'high';
    case 'cinematic':
      return 'ultra';
    case 'custom':
      return 'balanced';
  }
}

export function qualityForStudioTier(tier: StudioQualityTierName): RenderQualityPreset {
  switch (tier) {
    case 'low':
      return 'performance';
    case 'balanced':
      return 'balanced';
    case 'high':
      return 'quality';
    case 'ultra':
      return 'cinematic';
  }
}

/* ------------------------------------------------------------ adaptive --- */

export interface AdaptiveFrameState {
  /** Rolling average frame time in ms. */
  avgFrameMs: number;
  /** Target frame budget in ms (e.g. 16.7 for 60 Hz). */
  targetFrameMs: number;
  renderScale: number;
  preset: RenderQualityPreset;
  /** Consecutive windows that have been over budget. */
  overWindows: number;
  /** Consecutive windows with comfortable headroom. */
  headroomWindows: number;
}

export type AdaptiveActionKind =
  | 'none'
  | 'scale-down'
  | 'scale-up'
  | 'preset-down'
  | 'preset-up';

export interface AdaptiveAction {
  kind: AdaptiveActionKind;
  renderScale?: number;
  preset?: RenderQualityPreset;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 2;
const SCALE_STEP = 0.1;

function stepPreset(preset: RenderQualityPreset, direction: -1 | 1): RenderQualityPreset | null {
  const index = PRESET_ORDER.indexOf(preset);
  if (index === -1) return direction === -1 ? 'balanced' : 'quality';
  const next = index + direction;
  if (next < 0 || next >= PRESET_ORDER.length) return null;
  return PRESET_ORDER[next];
}

/**
 * Decide the next adaptation step. Uses hysteresis: 3 consecutive over-budget
 * windows scale down, 8 consecutive headroom windows scale up; when the scale
 * floor/ceiling is reached the whole preset steps instead. Pure — the caller
 * owns the counters.
 */
export function nextAdaptiveAction(state: AdaptiveFrameState): AdaptiveAction {
  const over = state.avgFrameMs > state.targetFrameMs * 1.15;
  const under = state.avgFrameMs < state.targetFrameMs * 0.72;

  if (over && state.overWindows + 1 >= 3) {
    const scale = Math.round((state.renderScale - SCALE_STEP) * 10) / 10;
    if (scale >= MIN_SCALE) return { kind: 'scale-down', renderScale: scale };
    const preset = stepPreset(state.preset, -1);
    return preset ? { kind: 'preset-down', preset } : { kind: 'none' };
  }

  if (under && state.headroomWindows + 1 >= 8) {
    const scale = Math.round((state.renderScale + SCALE_STEP) * 10) / 10;
    if (scale <= MAX_SCALE) return { kind: 'scale-up', renderScale: scale };
    const preset = stepPreset(state.preset, 1);
    return preset ? { kind: 'preset-up', preset } : { kind: 'none' };
  }

  return { kind: 'none' };
}

/** Frame budget in ms for a power profile + operator frame cap. */
export function frameBudgetMs(
  powerProfile: 'performance' | 'balanced' | 'battery',
  maxFrameRate: number,
): number {
  const profileCap =
    powerProfile === 'performance' ? 240 : powerProfile === 'balanced' ? 60 : 30;
  const hz = maxFrameRate > 0 ? Math.min(maxFrameRate, profileCap) : profileCap;
  return 1000 / hz;
}
