/**
 * Render engine settings — schema, normalization, persistence and a tiny
 * observable store.
 *
 * Persistence mirrors `keyboardShortcutsStorage.ts`: one localStorage key,
 * normalize everything on load so old/partial/hand-edited data can never put
 * the engine into an invalid state. The store is a module singleton so both
 * React (Settings panel, stages) and the background engine share one source
 * of truth without prop drilling.
 */
import type {
  AntiAliasingMode,
  BackgroundRenderMode,
  CinematicSettings,
  ColorGradeSettings,
  DenoiserMode,
  EngineBackendPreference,
  PowerProfile,
  RenderEngineSettings,
  RenderQualityPreset,
  ToneMapOperator,
} from './types';

export const STORAGE_KEY = 'cloudcast-render-engine';

const TONE_MAPS: ToneMapOperator[] = ['agx', 'aces', 'neutral', 'filmic', 'reinhard', 'linear'];
const AA_MODES: AntiAliasingMode[] = ['off', 'fxaa', 'smaa', 'msaa', 'taa'];
const BACKENDS: EngineBackendPreference[] = ['auto', 'webgpu', 'webgl2'];
const PRESETS: RenderQualityPreset[] = ['performance', 'balanced', 'quality', 'cinematic', 'custom'];
const POWER: PowerProfile[] = ['performance', 'balanced', 'battery'];
const BACKGROUND: BackgroundRenderMode[] = ['off', 'throttled', 'full'];
const DENOISERS: DenoiserMode[] = ['off', 'atrous'];
const SHADOW_QUALITY = ['low', 'medium', 'high', 'ultra'] as const;

export const DEFAULT_GRADE: ColorGradeSettings = {
  exposure: 0,
  contrast: 0,
  saturation: 1,
  vibrance: 1,
  temperature: 0,
};

export const DEFAULT_CINEMATIC: CinematicSettings = {
  samples: 128,
  bounces: 4,
  denoise: 'atrous',
  resolutionScale: 1,
  envIntensity: 1,
};

export const DEFAULT_RENDER_ENGINE_SETTINGS: RenderEngineSettings = {
  enabled: true,
  backend: 'auto',
  quality: 'balanced',
  renderScale: 1,
  autoQuality: true,
  toneMapping: 'agx',
  antiAliasing: 'smaa',
  msaaSamples: 4,
  gtao: true,
  gtaoIntensity: 1,
  bloom: true,
  bloomIntensity: 1,
  bloomThreshold: 0.85,
  depthOfField: true,
  vignette: true,
  vignetteStrength: 0.72,
  sharpen: true,
  sharpenStrength: 0.4,
  filmGrain: true,
  filmGrainAmount: 0.05,
  chromaticAberration: true,
  chromaticAberrationAmount: 0.25,
  hdrOutput: true,
  shadows: true,
  shadowQuality: 'high',
  grade: DEFAULT_GRADE,
  maxFrameRate: 0,
  powerProfile: 'balanced',
  backgroundRender: 'throttled',
  autoRecover: true,
  cinematic: DEFAULT_CINEMATIC,
};

function num(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function oneOf<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return typeof value === 'string' && (allowed as string[]).includes(value) ? (value as T) : fallback;
}

function normalizeGrade(raw: unknown): ColorGradeSettings {
  const g = (raw ?? {}) as Partial<ColorGradeSettings>;
  return {
    exposure: num(g.exposure, DEFAULT_GRADE.exposure, -4, 4),
    contrast: num(g.contrast, DEFAULT_GRADE.contrast, -1, 1),
    saturation: num(g.saturation, DEFAULT_GRADE.saturation, 0, 2),
    vibrance: num(g.vibrance, DEFAULT_GRADE.vibrance, 0, 2),
    temperature: num(g.temperature, DEFAULT_GRADE.temperature, -1, 1),
  };
}

function normalizeCinematic(raw: unknown): CinematicSettings {
  const c = (raw ?? {}) as Partial<CinematicSettings>;
  return {
    samples: Math.round(num(c.samples, DEFAULT_CINEMATIC.samples, 1, 4096)),
    bounces: Math.round(num(c.bounces, DEFAULT_CINEMATIC.bounces, 1, 16)),
    denoise: oneOf(c.denoise, DENOISERS, DEFAULT_CINEMATIC.denoise),
    resolutionScale: num(c.resolutionScale, DEFAULT_CINEMATIC.resolutionScale, 0.25, 2),
    envIntensity: num(c.envIntensity, DEFAULT_CINEMATIC.envIntensity, 0, 8),
  };
}

/**
 * Clamp/coerce arbitrary input into a valid settings object. Unknown enum
 * values fall back to defaults, numbers are range-clamped, extra keys drop.
 */
export function normalizeRenderEngineSettings(raw: unknown): RenderEngineSettings {
  const s = (raw ?? {}) as Partial<RenderEngineSettings>;
  const msaa = Math.round(num(s.msaaSamples, DEFAULT_RENDER_ENGINE_SETTINGS.msaaSamples, 2, 8));
  return {
    enabled: bool(s.enabled, DEFAULT_RENDER_ENGINE_SETTINGS.enabled),
    backend: oneOf(s.backend, BACKENDS, DEFAULT_RENDER_ENGINE_SETTINGS.backend),
    quality: oneOf(s.quality, PRESETS, DEFAULT_RENDER_ENGINE_SETTINGS.quality),
    renderScale: num(s.renderScale, DEFAULT_RENDER_ENGINE_SETTINGS.renderScale, 0.5, 2),
    autoQuality: bool(s.autoQuality, DEFAULT_RENDER_ENGINE_SETTINGS.autoQuality),
    toneMapping: oneOf(s.toneMapping, TONE_MAPS, DEFAULT_RENDER_ENGINE_SETTINGS.toneMapping),
    antiAliasing: oneOf(s.antiAliasing, AA_MODES, DEFAULT_RENDER_ENGINE_SETTINGS.antiAliasing),
    msaaSamples: msaa === 2 || msaa === 8 ? msaa : 4,
    gtao: bool(s.gtao, DEFAULT_RENDER_ENGINE_SETTINGS.gtao),
    gtaoIntensity: num(s.gtaoIntensity, DEFAULT_RENDER_ENGINE_SETTINGS.gtaoIntensity, 0, 2),
    bloom: bool(s.bloom, DEFAULT_RENDER_ENGINE_SETTINGS.bloom),
    bloomIntensity: num(s.bloomIntensity, DEFAULT_RENDER_ENGINE_SETTINGS.bloomIntensity, 0, 2),
    bloomThreshold: num(s.bloomThreshold, DEFAULT_RENDER_ENGINE_SETTINGS.bloomThreshold, 0, 2),
    depthOfField: bool(s.depthOfField, DEFAULT_RENDER_ENGINE_SETTINGS.depthOfField),
    vignette: bool(s.vignette, DEFAULT_RENDER_ENGINE_SETTINGS.vignette),
    vignetteStrength: num(s.vignetteStrength, DEFAULT_RENDER_ENGINE_SETTINGS.vignetteStrength, 0, 1),
    sharpen: bool(s.sharpen, DEFAULT_RENDER_ENGINE_SETTINGS.sharpen),
    sharpenStrength: num(s.sharpenStrength, DEFAULT_RENDER_ENGINE_SETTINGS.sharpenStrength, 0, 1),
    filmGrain: bool(s.filmGrain, DEFAULT_RENDER_ENGINE_SETTINGS.filmGrain),
    filmGrainAmount: num(s.filmGrainAmount, DEFAULT_RENDER_ENGINE_SETTINGS.filmGrainAmount, 0, 1),
    chromaticAberration: bool(s.chromaticAberration, DEFAULT_RENDER_ENGINE_SETTINGS.chromaticAberration),
    chromaticAberrationAmount: num(
      s.chromaticAberrationAmount,
      DEFAULT_RENDER_ENGINE_SETTINGS.chromaticAberrationAmount,
      0,
      1,
    ),
    hdrOutput: bool(s.hdrOutput, DEFAULT_RENDER_ENGINE_SETTINGS.hdrOutput),
    shadows: bool(s.shadows, DEFAULT_RENDER_ENGINE_SETTINGS.shadows),
    shadowQuality: oneOf(s.shadowQuality, [...SHADOW_QUALITY], DEFAULT_RENDER_ENGINE_SETTINGS.shadowQuality),
    grade: normalizeGrade(s.grade),
    maxFrameRate: Math.round(num(s.maxFrameRate, DEFAULT_RENDER_ENGINE_SETTINGS.maxFrameRate, 0, 240)),
    powerProfile: oneOf(s.powerProfile, POWER, DEFAULT_RENDER_ENGINE_SETTINGS.powerProfile),
    backgroundRender: oneOf(s.backgroundRender, BACKGROUND, DEFAULT_RENDER_ENGINE_SETTINGS.backgroundRender),
    autoRecover: bool(s.autoRecover, DEFAULT_RENDER_ENGINE_SETTINGS.autoRecover),
    cinematic: normalizeCinematic(s.cinematic),
  };
}

export function loadRenderEngineSettings(): RenderEngineSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_RENDER_ENGINE_SETTINGS };
    return normalizeRenderEngineSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_RENDER_ENGINE_SETTINGS };
  }
}

export function saveRenderEngineSettings(settings: RenderEngineSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* quota — the engine keeps working from the in-memory copy */
  }
}

export type SettingsListener = (settings: RenderEngineSettings) => void;

/**
 * Observable settings store. `patch` normalizes the merged result so callers
 * can hand in partial, sloppy updates from UI controls safely.
 */
export class RenderEngineSettingsStore {
  private settings: RenderEngineSettings;
  private listeners = new Set<SettingsListener>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(initial?: unknown) {
    this.settings = initial !== undefined
      ? normalizeRenderEngineSettings(initial)
      : loadRenderEngineSettings();
  }

  get(): RenderEngineSettings {
    return this.settings;
  }

  patch(partial: Partial<RenderEngineSettings>): RenderEngineSettings {
    this.settings = normalizeRenderEngineSettings({ ...this.settings, ...partial });
    this.emit();
    this.scheduleSave();
    return this.settings;
  }

  replace(settings: RenderEngineSettings): RenderEngineSettings {
    this.settings = normalizeRenderEngineSettings(settings);
    this.emit();
    this.scheduleSave();
    return this.settings;
  }

  reset(): RenderEngineSettings {
    return this.replace({ ...DEFAULT_RENDER_ENGINE_SETTINGS });
  }

  subscribe(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of [...this.listeners]) listener(this.settings);
  }

  /** Debounced persistence — sliders patch on every input event. */
  private scheduleSave(): void {
    if (this.saveTimer !== null) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      saveRenderEngineSettings(this.settings);
    }, 250);
  }
}
