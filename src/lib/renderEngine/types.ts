/**
 * CloudCast Render Engine — shared types.
 *
 * The engine is the GPU kernel behind every graphic the platform puts on
 * screen: photoreal virtual studios, motion graphics, overlays and captured
 * artifacts. It is WebGPU-first (shared device, compute kernels, timestamp
 * queries) with a WebGL2 fallback, and it runs in the background under the
 * control of the Settings panel.
 *
 * This module is intentionally three-free and side-effect-free so the engine
 * contract can be unit tested in the node environment.
 */

/** Which backend the operator asks for. `auto` prefers WebGPU, falls back to WebGL2. */
export type EngineBackendPreference = 'auto' | 'webgpu' | 'webgl2';

/** The backend the engine actually settled on. */
export type EngineBackend = 'webgpu' | 'webgl2' | 'none';

/** Scalability preset — the engine's equivalent of Unreal's scalability groups. */
export type RenderQualityPreset = 'performance' | 'balanced' | 'quality' | 'cinematic' | 'custom';

/** Display transform applied at the end of the HDR pipeline. */
export type ToneMapOperator = 'agx' | 'aces' | 'neutral' | 'filmic' | 'reinhard' | 'linear';

/** Anti-aliasing strategy for the beauty pass. */
export type AntiAliasingMode = 'off' | 'fxaa' | 'smaa' | 'msaa' | 'taa';

/** Power/thermals policy — caps the engine's frame budget. */
export type PowerProfile = 'performance' | 'balanced' | 'battery';

/**
 * What the engine keeps doing while the tab is hidden or consoles are
 * off-screen. It runs in the background either way — this controls how hard.
 */
export type BackgroundRenderMode = 'off' | 'throttled' | 'full';

/** Denoiser used by the cinematic (path traced) renderer. */
export type DenoiserMode = 'off' | 'atrous';

/** Lifecycle phase of the background engine. */
export type EnginePhase =
  | 'idle'
  | 'probing'
  | 'ready'
  | 'degraded'
  | 'lost'
  | 'unsupported'
  | 'error';

/** Display-grade controls layered after the display transform. */
export interface ColorGradeSettings {
  /** Exposure in EV stops. */
  exposure: number;
  /** -1..1 pivot contrast around 0.18 mid grey. */
  contrast: number;
  /** 0..2, 1 = unchanged chroma. */
  saturation: number;
  /** 0..2, saturation boost weighted to low-chroma pixels. */
  vibrance: number;
  /** -1..1 blue ↔ amber shift. */
  temperature: number;
}

/** Cinematic (offline, path traced) render controls. */
export interface CinematicSettings {
  /** Target samples per pixel. */
  samples: number;
  /** Maximum path length (bounces). */
  bounces: number;
  /** Spatio-temporal denoiser for the accumulation buffer. */
  denoise: DenoiserMode;
  /** Internal resolution multiplier before the final display transform. */
  resolutionScale: number;
  /** Environment (HDRI) light intensity multiplier. */
  envIntensity: number;
}

export interface RenderEngineSettings {
  /** Master switch for the engine kernel. When off the app renders legacy defaults. */
  enabled: boolean;
  backend: EngineBackendPreference;
  quality: RenderQualityPreset;
  /** Internal render resolution multiplier (0.5 – 2). */
  renderScale: number;
  /** Let the engine step renderScale / preset to hold the frame budget. */
  autoQuality: boolean;

  toneMapping: ToneMapOperator;
  antiAliasing: AntiAliasingMode;
  /** 2 | 4 | 8 — used when antiAliasing === 'msaa'. */
  msaaSamples: number;

  /** Screen-space ambient occlusion (horizon-based kernel). */
  gtao: boolean;
  gtaoIntensity: number;
  bloom: boolean;
  bloomIntensity: number;
  bloomThreshold: number;
  depthOfField: boolean;
  vignette: boolean;
  vignetteStrength: number;
  /** Contrast-adaptive sharpen (also cleans temporal upscaling). */
  sharpen: boolean;
  sharpenStrength: number;
  filmGrain: boolean;
  filmGrainAmount: number;
  chromaticAberration: boolean;
  chromaticAberrationAmount: number;

  /** Ask for HDR (rgba16float) canvas targets where the platform supports them. */
  hdrOutput: boolean;
  shadows: boolean;
  shadowQuality: 'low' | 'medium' | 'high' | 'ultra';

  grade: ColorGradeSettings;

  /** Frame cap in Hz. 0 = uncapped (still limited by the power profile). */
  maxFrameRate: number;
  powerProfile: PowerProfile;
  backgroundRender: BackgroundRenderMode;
  /** Re-acquire the GPU device automatically after device loss. */
  autoRecover: boolean;

  cinematic: CinematicSettings;
}

/** Immutable snapshot of what the GPU can do. */
export interface WebGpuCapabilities {
  available: boolean;
  adapterLabel: string;
  vendor: string;
  architecture: string;
  /** Every feature the adapter reports. */
  features: string[];
  /** Features the engine actually requested on the device. */
  requestedFeatures: string[];
  limits: Record<string, number>;
  isFallbackAdapter: boolean;
}

export interface WebGL2Capabilities {
  available: boolean;
  renderer: string;
  maxTextureSize: number;
  maxSamples: number;
  maxColorAttachments: number;
  extensions: string[];
}

export interface EngineCapabilities {
  webgpu: WebGpuCapabilities;
  webgl2: WebGL2Capabilities;
  /** 0–100 composite score used for preset recommendation. */
  score: number;
  recommendedPreset: RenderQualityPreset;
  recommendedBackend: EngineBackend;
  probedAt: number;
}

/** Live, pollable status of the background engine (rendered in Settings). */
export interface RenderEngineStatus {
  phase: EnginePhase;
  backend: EngineBackend;
  adapterLabel: string;
  vendor: string;
  features: string[];
  limits: Record<string, number>;
  /** Rolling frames per second of the engine tick. */
  fps: number;
  /** Rolling average frame time in ms. */
  frameMs: number;
  /** GPU kernel time in ms when `timestamp-query` is available, else null. */
  gpuMs: number | null;
  /** Heuristic working-set estimate in bytes. */
  vramEstimateBytes: number;
  webgpuAvailable: boolean;
  webgl2Available: boolean;
  quality: RenderQualityPreset;
  renderScale: number;
  error: string | null;
  /** Samples accumulated so far by the last/active cinematic render. */
  cinematicSamples: number;
  cinematicTargetSamples: number;
}

/** A surface that participates in the engine's frame budget. */
export interface EngineSurfaceHandle {
  readonly name: string;
  /** Report the measured cost of one frame of this surface (ms). */
  reportFrame(frameMs: number): void;
  dispose(): void;
}
