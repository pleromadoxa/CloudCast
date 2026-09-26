/**
 * CloudCast Stage Engine registry.
 *
 * Pure, testable catalogue of the renderers Prism can drive. The switcher UI,
 * entitlement gating and the fallback chain all read from here.
 */
import type {
  StageEngineCapability,
  StageEngineDescriptor,
  StageEngineId,
} from './types';

export const STAGE_ENGINES: Record<StageEngineId, StageEngineDescriptor> = {
  'prism-three': {
    id: 'prism-three',
    name: 'Prism R3F',
    vendor: 'three.js · React Three Fiber',
    tagline: 'Reference engine — WebGPU-first photoreal studio',
    description:
      'The CloudCast reference stage renderer. three.js on a React Three Fiber ' +
      'scene graph with HDRI image-based lighting, physical materials, PCF soft ' +
      'shadows, screen-space AO, bloom, depth of field, SMAA and an AgX/ACES ' +
      'display transform driven by the CloudCast Render Engine settings. Best ' +
      'all-round choice for real-time virtual production in the browser.',
    kind: 'web-scene',
    tier: 'broadcast',
    capabilities: [
      'webgpu',
      'webgl2',
      'pbr',
      'ibl-hdr',
      'realtime-shadows',
      'compute-post',
      'ar-key',
      'gltf',
      'custom-shaders',
    ],
    requires: ['WebGL2 (WebGPU recommended)'],
    docsUrl: 'https://threejs.org/docs',
    accent: '#f59e0b',
    toneMaps: ['agx', 'aces', 'neutral', 'filmic', 'reinhard', 'linear'],
  },
  'prism-babylon': {
    id: 'prism-babylon',
    name: 'Prism Babylon',
    vendor: 'Babylon.js',
    tagline: 'PBR + IBL + PCSS shadows on WebGPU or WebGL2',
    description:
      'A second, fully independent photoreal renderer built on Babylon.js. ' +
      'Physically based materials with metallic/roughness workflow, HDR ' +
      'environment probes, percentage-closer soft shadows, screen-space ' +
      'reflections and ambient occlusion, and an ACES image-processing ' +
      'pipeline. Runs on WebGPU where available and falls back to WebGL2 ' +
      'automatically — ideal when a shot needs a different material or ' +
      'lighting response than the reference engine.',
    kind: 'web-scene',
    tier: 'broadcast',
    capabilities: [
      'webgpu',
      'webgl2',
      'pbr',
      'ibl-hdr',
      'realtime-shadows',
      'gltf',
      'custom-shaders',
    ],
    requires: ['WebGL2 (WebGPU recommended)'],
    docsUrl: 'https://doc.babylonjs.com',
    accent: '#38bdf8',
    toneMaps: ['aces', 'agx', 'neutral', 'filmic', 'reinhard'],
  },
  'unreal-pixelstream': {
    id: 'unreal-pixelstream',
    name: 'Unreal Engine',
    vendor: 'Epic Games · Pixel Streaming',
    tagline: 'Remote Unreal render streamed over WebRTC',
    description:
      'Drives a real Unreal Engine render inside the CloudCast stage. Epic ' +
      'does not publish an in-browser Unreal scene renderer — the supported ' +
      'path is Pixel Streaming, where a GPU instance renders the scene and ' +
      'streams it to the browser over WebRTC with sub-frame input latency. ' +
      'This adapter connects to a Pixel Streaming signalling server, negotiates ' +
      'the peer connection and forwards mouse, keyboard and touch input, so an ' +
      'Aximmetry-grade Unreal set can sit inside the Prism program bus next to ' +
      'keyed talent and broadcast graphics.',
    kind: 'remote-stream',
    tier: 'remote-photoreal',
    capabilities: ['webrtc', 'pbr', 'ibl-hdr', 'realtime-shadows', 'path-tracing', 'xr'],
    requires: [
      'A Pixel Streaming host (Unreal Engine 5.x + Pixel Streaming infra)',
      'A reachable WebRTC signalling URL',
      'Low-latency network path (WebRTC / TURN)',
    ],
    docsUrl: 'https://dev.epicgames.com/documentation/unreal-engine/pixel-streaming-in-unreal-engine',
    accent: '#0ea5e9',
    toneMaps: ['aces', 'agx', 'neutral', 'filmic', 'reinhard', 'linear'],
  },
  'wgsl-native': {
    id: 'wgsl-native',
    name: 'WGSL Kernel',
    vendor: 'CloudCast Render Engine',
    tagline: 'Raw WebGPU compute — path tracer + post chain',
    description:
      'The CloudCast Render Engine itself: hand-written WGSL kernels running on ' +
      'the shared WebGPU device. Progressive path tracing with BVH traversal and ' +
      'SVGF denoising for offline cinematic stills, plus a real-time compute post ' +
      'chain (GTAO, bloom, temporal AA, grade). Use it for cinematic renders, ' +
      'benchmarks and calibration — not as an interactive stage.',
    kind: 'kernel',
    tier: 'cinematic',
    capabilities: ['webgpu', 'compute-post', 'path-tracing', 'custom-shaders'],
    requires: ['WebGPU'],
    docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API',
    accent: '#a78bfa',
    toneMaps: ['agx', 'aces', 'neutral', 'filmic', 'reinhard', 'linear'],
  },
};

/** Ids in the order the switcher should present them. */
export const STAGE_ENGINE_ORDER: StageEngineId[] = [
  'prism-three',
  'prism-babylon',
  'unreal-pixelstream',
  'wgsl-native',
];

export function getStageEngine(id: StageEngineId): StageEngineDescriptor {
  return STAGE_ENGINES[id];
}

export function listStageEngines(): StageEngineDescriptor[] {
  return STAGE_ENGINE_ORDER.map((id) => STAGE_ENGINES[id]);
}

/** Engines that can actually render an interactive virtual set. */
export function interactiveStageEngines(): StageEngineDescriptor[] {
  return listStageEngines().filter((engine) => engine.kind !== 'kernel');
}

export function stageEngineHas(
  id: StageEngineId,
  capability: StageEngineCapability,
): boolean {
  return STAGE_ENGINES[id].capabilities.includes(capability);
}

/** The engine to fall back to if `id` cannot start. */
export function fallbackFor(id: StageEngineId): StageEngineId {
  return id === 'prism-three' ? 'prism-babylon' : 'prism-three';
}

export const DEFAULT_STAGE_ENGINE: StageEngineId = 'prism-three';
