/**
 * CloudCast Stage Engine settings store.
 *
 * Persists the operator's engine choice and per-engine tuning. Pure
 * normalization lives in `normalizeStageEngineSettings` so the store is a thin
 * observable wrapper around localStorage (same pattern as
 * `src/lib/renderEngine/settings.ts`).
 */
import { DEFAULT_STAGE_ENGINE, fallbackFor } from './registry';
import type {
  BabylonAntiAliasing,
  BabylonShadowFilter,
  BabylonStageSettings,
  BabylonToneMap,
  StageEngineId,
  StageEngineSettings,
  UnrealQualityLevel,
  UnrealResolution,
  UnrealStreamSettings,
} from './types';

export const STAGE_ENGINE_STORAGE_KEY = 'cloudcast:stage-engine:v1';

export const DEFAULT_BABYLON_SETTINGS: BabylonStageSettings = {
  antiAliasing: 'msaa',
  msaaSamples: 4,
  toneMapping: 'aces',
  environmentIntensity: 1,
  physicallyCorrectLights: true,
  shadowFilter: 'pcss',
  shadowMapSize: 2048,
  ssao: true,
  ssr: true,
  bloom: true,
  bloomIntensity: 0.35,
  depthOfField: true,
  vignette: true,
  grain: true,
  imageProcessing: true,
  exposure: 1,
  contrast: 1.08,
};

export const DEFAULT_UNREAL_SETTINGS: UnrealStreamSettings = {
  signallingUrl: '',
  autoConnect: false,
  forceTURN: false,
  turnUrl: '',
  turnUsername: '',
  turnCredential: '',
  hoverMouse: true,
  keyboardInput: true,
  touchInput: true,
  quality: 'epic',
  resolution: '1920x1080',
  autoPause: true,
};

export const DEFAULT_STAGE_ENGINE_SETTINGS: StageEngineSettings = {
  engine: DEFAULT_STAGE_ENGINE,
  fallbackEngine: fallbackFor(DEFAULT_STAGE_ENGINE),
  autoFallback: true,
  babylon: DEFAULT_BABYLON_SETTINGS,
  unreal: DEFAULT_UNREAL_SETTINGS,
};

const BABYLON_TONE_MAPS: BabylonToneMap[] = ['aces', 'agx', 'neutral', 'filmic', 'reinhard'];
const BABYLON_AA: BabylonAntiAliasing[] = ['msaa', 'fxaa', 'none'];
const BABYLON_SHADOW: BabylonShadowFilter[] = ['pcf', 'pcss', 'blur'];
const UNREAL_QUALITY: UnrealQualityLevel[] = ['low', 'medium', 'high', 'epic', 'cinematic'];
const UNREAL_RESOLUTION: UnrealResolution[] = [
  '1280x720',
  '1920x1080',
  '2560x1440',
  '3840x2160',
];

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function oneOf<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return typeof value === 'string' && (allowed as string[]).includes(value)
    ? (value as T)
    : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function str(value: unknown, fallback: string, maxLength = 512): string {
  return typeof value === 'string' ? value.slice(0, maxLength) : fallback;
}

function normBabylon(input: Partial<BabylonStageSettings> | undefined): BabylonStageSettings {
  const d = DEFAULT_BABYLON_SETTINGS;
  const raw = input ?? {};
  const msaaSamples = [2, 4, 8].includes(raw.msaaSamples as number) ? (raw.msaaSamples as number) : d.msaaSamples;
  return {
    antiAliasing: oneOf(raw.antiAliasing, BABYLON_AA, d.antiAliasing),
    msaaSamples,
    toneMapping: oneOf(raw.toneMapping, BABYLON_TONE_MAPS, d.toneMapping),
    environmentIntensity: clamp(raw.environmentIntensity, 0, 4, d.environmentIntensity),
    physicallyCorrectLights: bool(raw.physicallyCorrectLights, d.physicallyCorrectLights),
    shadowFilter: oneOf(raw.shadowFilter, BABYLON_SHADOW, d.shadowFilter),
    shadowMapSize: [512, 1024, 2048, 4096].includes(raw.shadowMapSize as number)
      ? (raw.shadowMapSize as number)
      : d.shadowMapSize,
    ssao: bool(raw.ssao, d.ssao),
    ssr: bool(raw.ssr, d.ssr),
    bloom: bool(raw.bloom, d.bloom),
    bloomIntensity: clamp(raw.bloomIntensity, 0, 2, d.bloomIntensity),
    depthOfField: bool(raw.depthOfField, d.depthOfField),
    vignette: bool(raw.vignette, d.vignette),
    grain: bool(raw.grain, d.grain),
    imageProcessing: bool(raw.imageProcessing, d.imageProcessing),
    exposure: clamp(raw.exposure, 0.1, 4, d.exposure),
    contrast: clamp(raw.contrast, 0.5, 2, d.contrast),
  };
}

function normUnreal(input: Partial<UnrealStreamSettings> | undefined): UnrealStreamSettings {
  const d = DEFAULT_UNREAL_SETTINGS;
  const raw = input ?? {};
  return {
    signallingUrl: str(raw.signallingUrl, d.signallingUrl, 1024),
    autoConnect: bool(raw.autoConnect, d.autoConnect),
    forceTURN: bool(raw.forceTURN, d.forceTURN),
    turnUrl: str(raw.turnUrl, d.turnUrl, 1024),
    turnUsername: str(raw.turnUsername, d.turnUsername, 256),
    turnCredential: str(raw.turnCredential, d.turnCredential, 256),
    hoverMouse: bool(raw.hoverMouse, d.hoverMouse),
    keyboardInput: bool(raw.keyboardInput, d.keyboardInput),
    touchInput: bool(raw.touchInput, d.touchInput),
    quality: oneOf(raw.quality, UNREAL_QUALITY, d.quality),
    resolution: oneOf(raw.resolution, UNREAL_RESOLUTION, d.resolution),
    autoPause: bool(raw.autoPause, d.autoPause),
  };
}

/** Partial operator input — nested engine blocks may be edited field by field. */
export type PartialStageEngineSettings = Partial<
  Omit<StageEngineSettings, 'babylon' | 'unreal'>
> & {
  babylon?: Partial<BabylonStageSettings>;
  unreal?: Partial<UnrealStreamSettings>;
};

export function normalizeStageEngineSettings(
  input?: PartialStageEngineSettings | null,
): StageEngineSettings {
  const raw = input ?? {};
  const engine = oneOf(raw.engine, ['prism-three', 'prism-babylon', 'unreal-pixelstream', 'wgsl-native'] as StageEngineId[], DEFAULT_STAGE_ENGINE);
  const fallbackEngine = oneOf(
    raw.fallbackEngine,
    ['prism-three', 'prism-babylon', 'unreal-pixelstream', 'wgsl-native'] as StageEngineId[],
    fallbackFor(engine),
  );
  return {
    engine,
    fallbackEngine: fallbackEngine === engine ? fallbackFor(engine) : fallbackEngine,
    autoFallback: bool(raw.autoFallback, DEFAULT_STAGE_ENGINE_SETTINGS.autoFallback),
    babylon: normBabylon(raw.babylon),
    unreal: normUnreal(raw.unreal),
  };
}

export function loadStageEngineSettings(): StageEngineSettings {
  if (typeof localStorage === 'undefined') return normalizeStageEngineSettings();
  try {
    const raw = localStorage.getItem(STAGE_ENGINE_STORAGE_KEY);
    if (!raw) return normalizeStageEngineSettings();
    return normalizeStageEngineSettings(JSON.parse(raw) as Partial<StageEngineSettings>);
  } catch {
    return normalizeStageEngineSettings();
  }
}

export function saveStageEngineSettings(settings: StageEngineSettings): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STAGE_ENGINE_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* quota or private mode — the in-memory value still applies */
  }
}

/** Small observable store, mirroring `RenderEngineSettingsStore`. */
export class StageEngineSettingsStore {
  private settings: StageEngineSettings = loadStageEngineSettings();
  private listeners = new Set<() => void>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  get(): StageEngineSettings {
    return this.settings;
  }

  patch(partial: Partial<StageEngineSettings>): StageEngineSettings {
    this.settings = normalizeStageEngineSettings({ ...this.settings, ...partial });
    this.scheduleSave();
    this.notify();
    return this.settings;
  }

  replace(settings: StageEngineSettings): StageEngineSettings {
    this.settings = normalizeStageEngineSettings(settings);
    this.scheduleSave();
    this.notify();
    return this.settings;
  }

  reset(): StageEngineSettings {
    return this.replace(DEFAULT_STAGE_ENGINE_SETTINGS);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      saveStageEngineSettings(this.settings);
    }, 250);
  }

  private notify(): void {
    for (const listener of [...this.listeners]) listener();
  }
}

let storeSingleton: StageEngineSettingsStore | null = null;

export function getStageEngineStore(): StageEngineSettingsStore {
  if (!storeSingleton) storeSingleton = new StageEngineSettingsStore();
  return storeSingleton;
}

export function resetStageEngineStore(): void {
  storeSingleton = null;
}
