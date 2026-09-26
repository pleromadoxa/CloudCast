/**
 * CloudCast Render Engine — public API.
 *
 * The engine is the GPU kernel behind every graphic in the app: photoreal
 * studios, motion graphics, overlays and captured artifacts. It runs in the
 * background and is controlled from Settings → Render Engine.
 *
 * Quick map:
 * - `getRenderEngine()`            — the background engine singleton
 * - `RenderEngineSettingsStore`    — persisted, observable settings
 * - `ENGINE_QUALITY_PROFILES`      — scalability presets (performance … cinematic)
 * - `PostKernel` / `CinematicRenderer` — the realtime and offline GPU paths
 * - `probeRenderCapabilities`      — WebGPU feature/limit report
 */
export * from './types';
export * from './gpuFlags';
export {
  DEFAULT_CINEMATIC,
  DEFAULT_GRADE,
  DEFAULT_RENDER_ENGINE_SETTINGS,
  RenderEngineSettingsStore,
  STORAGE_KEY,
  loadRenderEngineSettings,
  normalizeRenderEngineSettings,
  saveRenderEngineSettings,
} from './settings';
export {
  ENGINE_QUALITY_PROFILES,
  applyPresetToSettings,
  derivePresetFromSettings,
  engineQualityProfile,
  frameBudgetMs,
  nextAdaptiveAction,
  qualityForStudioTier,
  shadowMapSizeFor,
  studioTierForQuality,
} from './quality';
export type {
  AdaptiveAction,
  AdaptiveActionKind,
  AdaptiveFrameState,
  EngineQualityProfile,
  StudioQualityTierName,
} from './quality';
export {
  composeCapabilities,
  pickBackend,
  probeRenderCapabilities,
  probeWebGL2,
  probeWebGpu,
  recommendPresetForScore,
  scoreGpu,
} from './capabilities';
export type { GpuScoreInput, WebGpuProbeResult } from './capabilities';
export { RenderDeviceManager, getDeviceManager, peekSharedGpuDevice } from './deviceManager';
export { FrameMetrics, GpuTimer, estimateVramBytes, formatBytes } from './metrics';
export { FrameScheduler } from './scheduler';
export type { FrameTick, FrameClient } from './scheduler';
export { PostKernel, toneOperatorIndex } from './kernels/postKernel';
export type { PostKernelInput, PostKernelTarget, PostKernelExtras } from './kernels/postKernel';
export { CinematicRenderer, toHalfFloat } from './cinematicRenderer';
export type { CinematicRenderOptions, CinematicResult } from './cinematicRenderer';
export {
  buildCalibrationScene,
  buildEnvironmentCdf,
  cameraBasis,
  flattenCinematicScene,
  proceduralEnvironment,
} from './pathTracer/scene';
export type {
  CinematicCamera,
  CinematicEnvironment,
  CinematicMaterial,
  CinematicMesh,
  CinematicScene,
  EnvironmentCdf,
  FlattenedScene,
} from './pathTracer/scene';
export { buildBvh, validateBvh, intersectSceneBruteForce } from './pathTracer/bvh';
export type { FlattenedBvh } from './pathTracer/bvh';
export { extractCinematicScene, cameraFromThree } from './sceneFromThree';
export { RenderEngine, getRenderEngine, resetRenderEngine, pixelsToPngBlob } from './engine';
