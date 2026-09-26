/**
 * GPU capability probing.
 *
 * Asks the platform for everything it has — the full standardized WebGPU
 * feature set, limits, adapter identity — and a WebGL2 report for the
 * fallback path. Produces a deterministic score so the engine can recommend
 * a scalability preset on first run.
 *
 * The numeric scoring is pure (`scoreGpu`) and unit tested; only the DOM
 * probing needs a browser.
 */
import {
  DESIRED_WEBGPU_FEATURES,
  KNOWN_WEBGPU_FEATURES,
  TRACKED_LIMITS,
  readLimit,
  requestedLimits,
} from './gpuFlags';
import type {
  EngineBackend,
  EngineCapabilities,
  RenderQualityPreset,
  WebGL2Capabilities,
  WebGpuCapabilities,
} from './types';
import type { EngineBackendPreference } from './types';
import { asAdapter } from '../../types/webgpuCompat';

export interface GpuScoreInput {
  webgpuAvailable: boolean;
  webgpuFeatureCount: number;
  hasTimestampQuery: boolean;
  hasSubgroups: boolean;
  hasFloat32Filterable: boolean;
  hasShaderF16: boolean;
  maxTextureDimension2D: number;
  maxStorageBufferBindingSize: number;
  webgl2Available: boolean;
  webgl2MaxSamples: number;
  webgl2MaxTextureSize: number;
}

/**
 * 0–100 composite GPU score. WebGPU capability dominates (it unlocks the
 * compute kernels), WebGL2 depth keeps older hardware in a usable band.
 */
export function scoreGpu(input: GpuScoreInput): number {
  let score = 0;
  if (input.webgpuAvailable) {
    score += 20;
    if (input.hasTimestampQuery) score += 10;
    if (input.hasSubgroups) score += 8;
    if (input.hasFloat32Filterable) score += 7;
    if (input.hasShaderF16) score += 5;
    if (input.maxTextureDimension2D >= 8192) score += 5;
    else if (input.maxTextureDimension2D >= 4096) score += 3;
    if (input.maxStorageBufferBindingSize >= 128 * 1024 * 1024) score += 5;
    else if (input.maxStorageBufferBindingSize >= 16 * 1024 * 1024) score += 3;
    score += Math.min(10, Math.floor(input.webgpuFeatureCount / 2));
  }
  if (input.webgl2Available) {
    score += 10;
    if (input.webgl2MaxSamples >= 8) score += 5;
    else if (input.webgl2MaxSamples >= 4) score += 3;
    if (input.webgl2MaxTextureSize >= 8192) score += 5;
    else if (input.webgl2MaxTextureSize >= 4096) score += 3;
  }
  return Math.min(100, score);
}

export function recommendPresetForScore(score: number, isMobile = false): RenderQualityPreset {
  if (isMobile) {
    if (score >= 75) return 'quality';
    if (score >= 45) return 'balanced';
    return 'performance';
  }
  if (score >= 85) return 'cinematic';
  if (score >= 65) return 'quality';
  if (score >= 35) return 'balanced';
  return 'performance';
}

function probeWebGL2Internal(): WebGL2Capabilities {
  const empty: WebGL2Capabilities = {
    available: false,
    renderer: 'unknown',
    maxTextureSize: 0,
    maxSamples: 0,
    maxColorAttachments: 0,
    extensions: [],
  };
  try {
    if (typeof document === 'undefined') return empty;
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return empty;
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = debugInfo
      ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER));
    const capabilities: WebGL2Capabilities = {
      available: true,
      renderer,
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
      maxSamples: gl.getParameter(gl.MAX_SAMPLES) as number,
      maxColorAttachments: gl.getParameter(gl.MAX_COLOR_ATTACHMENTS) as number,
      extensions: (gl.getSupportedExtensions() ?? []).slice(0, 64),
    };
    // Release the context promptly — some drivers pin VRAM per context.
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return capabilities;
  } catch {
    return empty;
  }
}

interface AdapterIdentity {
  label: string;
  vendor: string;
  architecture: string;
}

/**
 * The identity fields we read off an adapter. Declared structurally rather than
 * as `GPUAdapter` so this module stays decoupled from whichever WebGPU type
 * declarations the host library (Babylon.js, three.js, the DOM lib) happens to
 * contribute to the global scope.
 */
interface AdapterLike {
  features?: unknown;
  limits?: unknown;
  info?: { device?: string; description?: string; vendor?: string; architecture?: string };
  isFallbackAdapter?: boolean;
}

function readAdapterIdentity(adapter: AdapterLike): AdapterIdentity {
  const info = adapter.info;
  return {
    label: info?.device || info?.description || info?.vendor || 'WebGPU adapter',
    vendor: info?.vendor || 'unknown',
    architecture: info?.architecture || 'unknown',
  };
}

export interface WebGpuProbeResult {
  capabilities: WebGpuCapabilities;
  /** Live adapter, so the device manager can request a device without re-probing. */
  adapter: GPUAdapter | null;
  requestedFeatureNames: string[];
  requestedLimitValues: Record<string, number>;
}

export async function probeWebGpu(): Promise<WebGpuProbeResult> {
  const empty: WebGpuCapabilities = {
    available: false,
    adapterLabel: 'none',
    vendor: 'unknown',
    architecture: 'unknown',
    features: [],
    requestedFeatures: [],
    limits: {},
    isFallbackAdapter: false,
  };
  try {
    if (typeof navigator === 'undefined' || !navigator.gpu) {
      return { capabilities: empty, adapter: null, requestedFeatureNames: [], requestedLimitValues: {} };
    }
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) {
      return { capabilities: empty, adapter: null, requestedFeatureNames: [], requestedLimitValues: {} };
    }
    const identity = readAdapterIdentity(adapter);
    const features = [...(adapter.features as unknown as Set<string>)].filter((f) =>
      (KNOWN_WEBGPU_FEATURES as readonly string[]).includes(f),
    );
    const requestedFeatureNames = DESIRED_WEBGPU_FEATURES.filter((f) => features.includes(f));
    const limits: Record<string, number> = {};
    for (const key of TRACKED_LIMITS) limits[key] = readLimit(adapter.limits, key);
    const requestedLimitValues = requestedLimits(adapter.limits);
    return {
      capabilities: {
        available: true,
        adapterLabel: identity.label,
        vendor: identity.vendor,
        architecture: identity.architecture,
        features,
        requestedFeatures: requestedFeatureNames,
        limits,
        isFallbackAdapter: Boolean((adapter as unknown as { isFallbackAdapter?: boolean }).isFallbackAdapter),
      },
      adapter: asAdapter(adapter),
      requestedFeatureNames,
      requestedLimitValues,
    };
  } catch {
    return { capabilities: empty, adapter: null, requestedFeatureNames: [], requestedLimitValues: {} };
  }
}

export function pickBackend(
  preference: EngineBackendPreference,
  webgpuAvailable: boolean,
  webgl2Available: boolean,
): EngineBackend {
  if (preference === 'webgpu') return webgpuAvailable ? 'webgpu' : webgl2Available ? 'webgl2' : 'none';
  if (preference === 'webgl2') return webgl2Available ? 'webgl2' : webgpuAvailable ? 'webgpu' : 'none';
  if (webgpuAvailable) return 'webgpu';
  return webgl2Available ? 'webgl2' : 'none';
}

export async function probeWebGL2(): Promise<WebGL2Capabilities> {
  return probeWebGL2Internal();
}

/**
 * Compose the immutable capability report + score from probe pieces. Pure
 * given its inputs (aside from the UA mobile sniff).
 */
export function composeCapabilities(
  webgpu: WebGpuProbeResult,
  webgl2: WebGL2Capabilities,
): EngineCapabilities {
  const features = webgpu.capabilities.features;
  const score = scoreGpu({
    webgpuAvailable: webgpu.capabilities.available,
    webgpuFeatureCount: features.length,
    hasTimestampQuery: features.includes('timestamp-query'),
    hasSubgroups: features.includes('subgroups'),
    hasFloat32Filterable: features.includes('float32-filterable'),
    hasShaderF16: features.includes('shader-f16'),
    maxTextureDimension2D: webgpu.capabilities.limits.maxTextureDimension2D ?? 0,
    maxStorageBufferBindingSize: webgpu.capabilities.limits.maxStorageBufferBindingSize ?? 0,
    webgl2Available: webgl2.available,
    webgl2MaxSamples: webgl2.maxSamples,
    webgl2MaxTextureSize: webgl2.maxTextureSize,
  });
  const isMobile = typeof navigator !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent);
  return {
    webgpu: webgpu.capabilities,
    webgl2,
    score,
    recommendedPreset: recommendPresetForScore(score, isMobile),
    recommendedBackend: pickBackend('auto', webgpu.capabilities.available, webgl2.available),
    probedAt: Date.now(),
  };
}

export async function probeRenderCapabilities(): Promise<EngineCapabilities> {
  const [webgpu, webgl2] = await Promise.all([probeWebGpu(), probeWebGL2()]);
  return composeCapabilities(webgpu, webgl2);
}
