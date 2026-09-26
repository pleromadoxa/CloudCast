/**
 * CloudCast Stage Engines — shared contract.
 *
 * Prism is an Aximmetry-class virtual production engine: a photoreal 3D set,
 * a keyed talent plate, live screens and broadcast graphics, all composited in
 * real time and pushed to the mixer program bus. A *stage engine* is the
 * renderer that draws that set.
 *
 * The platform is deliberately multi-engine. Operators pick the renderer that
 * fits the shot:
 *
 *  - `prism-three`        — the reference engine (three.js + R3F, WebGPU-first).
 *  - `prism-babylon`      — Babylon.js (WebGPU/WebGL2) with PBR + IBL + PCSS.
 *  - `unreal-pixelstream` — an Unreal Engine render streamed in over WebRTC
 *                           (Epic Pixel Streaming). Unreal has no in-browser
 *                           scene renderer plugin; streaming is the supported
 *                           way to put a UE scene on a web page, and this
 *                           adapter is how CloudCast drives one.
 *  - `wgsl-native`        — the raw WebGPU kernel in `src/lib/renderEngine`
 *                           (path tracer + compute post chain).
 *
 * This module is intentionally dependency-free and side-effect-free so the
 * registry can be unit tested in the node environment.
 */

/** Identifier of a stage renderer. */
export type StageEngineId =
  | 'prism-three'
  | 'prism-babylon'
  | 'unreal-pixelstream'
  | 'wgsl-native';

/** How the engine produces frames. */
export type StageEngineKind =
  /** Renders the scene locally on the GPU. */
  | 'web-scene'
  /** Receives finished frames from a remote renderer over WebRTC. */
  | 'remote-stream'
  /** Raw compute/render kernels, no scene graph. */
  | 'kernel';

/** Feature tags used to explain an engine to an operator. */
export type StageEngineCapability =
  | 'webgpu'
  | 'webgl2'
  | 'pbr'
  | 'ibl-hdr'
  | 'realtime-shadows'
  | 'path-tracing'
  | 'compute-post'
  | 'webrtc'
  | 'xr'
  | 'ar-key'
  | 'gltf'
  | 'custom-shaders';

/** Marketing/quality ceiling an engine can reach. */
export type StageEngineTier = 'broadcast' | 'cinematic' | 'remote-photoreal';

export interface StageEngineDescriptor {
  id: StageEngineId;
  /** Operator-facing name. */
  name: string;
  /** Renderer vendor / origin. */
  vendor: string;
  /** One-line summary shown in the switcher. */
  tagline: string;
  /** Longer description shown in the engine detail card. */
  description: string;
  kind: StageEngineKind;
  tier: StageEngineTier;
  capabilities: StageEngineCapability[];
  /** Plain-language prerequisites for running this engine. */
  requires: string[];
  /** Documentation / vendor reference URL. */
  docsUrl: string;
  /** Accent colour used by the switcher chrome. */
  accent: string;
  /** Preferred display-transform operators this engine supports well. */
  toneMaps: string[];
}

/** Result of probing the current browser/device for one engine. */
export interface StageEngineAvailability {
  id: StageEngineId;
  available: boolean;
  /** Why an engine is unavailable (or a note about its limitations). */
  reason: string | null;
  /** The registry's suggestion for this device. */
  recommended: boolean;
  /** Rough 0–100 confidence that this engine will hold 1080p60. */
  headroomScore: number;
}

/* ------------------------------------------------------------- settings --- */

export type BabylonToneMap = 'aces' | 'agx' | 'neutral' | 'filmic' | 'reinhard';
export type BabylonShadowFilter = 'pcf' | 'pcss' | 'blur';
export type BabylonAntiAliasing = 'msaa' | 'fxaa' | 'none';

export interface BabylonStageSettings {
  antiAliasing: BabylonAntiAliasing;
  /** 2 | 4 | 8 — used when `antiAliasing === 'msaa'`. */
  msaaSamples: number;
  toneMapping: BabylonToneMap;
  /** IBL intensity multiplier for the environment probe. */
  environmentIntensity: number;
  /** Physical (inverse-square) light falloff — required for a true metal look. */
  physicallyCorrectLights: boolean;
  shadowFilter: BabylonShadowFilter;
  shadowMapSize: number;
  /** Screen-space AO. */
  ssao: boolean;
  /** Screen-space reflections on glossy/metal surfaces. */
  ssr: boolean;
  bloom: boolean;
  bloomIntensity: number;
  depthOfField: boolean;
  vignette: boolean;
  grain: boolean;
  /** Image-processing pipeline (contrast / exposure / colour curves). */
  imageProcessing: boolean;
  exposure: number;
  contrast: number;
}

export type UnrealQualityLevel = 'low' | 'medium' | 'high' | 'epic' | 'cinematic';
export type UnrealResolution = '1280x720' | '1920x1080' | '2560x1440' | '3840x2160';

export interface UnrealStreamSettings {
  /** WebRTC signalling endpoint exposed by the Pixel Streaming infra. */
  signallingUrl: string;
  autoConnect: boolean;
  /** Force TURN relay even when host candidates are available. */
  forceTURN: boolean;
  turnUrl: string;
  turnUsername: string;
  turnCredential: string;
  /** Forward mouse / keyboard / touch to the Unreal instance. */
  hoverMouse: boolean;
  keyboardInput: boolean;
  touchInput: boolean;
  quality: UnrealQualityLevel;
  resolution: UnrealResolution;
  /** Ask the streamer to pause when the stage is hidden. */
  autoPause: boolean;
}

export interface StageEngineSettings {
  /** The engine currently driving the stage. */
  engine: StageEngineId;
  /** Engine used when the primary one cannot start. */
  fallbackEngine: StageEngineId;
  /** Drop back automatically instead of showing an error state. */
  autoFallback: boolean;
  babylon: BabylonStageSettings;
  unreal: UnrealStreamSettings;
}
