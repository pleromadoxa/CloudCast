/**
 * CloudCast Stage Engine — runtime capability probe.
 *
 * Answers "can this device actually run each engine?" without starting any of
 * them. The switcher uses the result to grey-out impossible choices and to pick
 * the automatic recommendation.
 */
import { DEFAULT_STAGE_ENGINE } from './registry';
import type {
  StageEngineAvailability,
  StageEngineId,
  StageEngineSettings,
} from './types';

export interface StageProbeInput {
  webgpu: boolean;
  webgl2: boolean;
  webrtc: boolean;
  /** WebGPU adapter reported a hardware (non-software) device. */
  hardwareAdapter: boolean;
  /** Device memory in GiB when the browser exposes it. */
  deviceMemoryGiB: number;
  /** Coarse mobile/pointer check. */
  isMobile: boolean;
  /** Operator has configured a Pixel Streaming signalling endpoint. */
  unrealConfigured: boolean;
}

function hasWebGl2(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}

function hasWebRtc(): boolean {
  return typeof RTCPeerConnection !== 'undefined';
}

function deviceMemoryGiB(): number {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return typeof nav.deviceMemory === 'number' ? nav.deviceMemory : 8;
}

function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

/**
 * Collect device facts. Requests a WebGPU adapter when available — this is the
 * same ask the render engine makes later, so browsers only show one prompt.
 */
export async function collectStageProbeInput(
  unrealConfigured = false,
): Promise<StageProbeInput> {
  let webgpu = false;
  let hardwareAdapter = false;
  const gpu = (navigator as Navigator & { gpu?: GPU }).gpu;
  if (gpu?.requestAdapter) {
    try {
      const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
      webgpu = Boolean(adapter);
      // `GPUAdapter.info` is the current spec; older builds exposed
      // `adapterInfo`. Either way we only care whether this is a real device.
      const probeAdapter = adapter as unknown as {
        info?: { vendor?: string };
        adapterInfo?: { vendor?: string };
      } | null;
      const vendor = (probeAdapter?.info ?? probeAdapter?.adapterInfo)?.vendor?.toLowerCase() ?? '';
      hardwareAdapter = webgpu && !vendor.includes('swiftshader') && !vendor.includes('llvmpipe');
    } catch {
      webgpu = false;
    }
  }
  return {
    webgpu,
    webgl2: hasWebGl2(),
    webrtc: hasWebRtc(),
    hardwareAdapter,
    deviceMemoryGiB: deviceMemoryGiB(),
    isMobile: isMobileDevice(),
    unrealConfigured,
  };
}

function scoreFor(
  id: StageEngineId,
  input: StageProbeInput,
): { score: number; available: boolean; reason: string | null } {
  switch (id) {
    case 'prism-three':
    case 'prism-babylon': {
      if (!input.webgl2 && !input.webgpu) {
        return { score: 0, available: false, reason: 'Needs WebGL2 or WebGPU' };
      }
      let score = input.webgpu ? 82 : 64;
      if (input.hardwareAdapter) score += 10;
      if (input.deviceMemoryGiB >= 8) score += 4;
      if (input.isMobile) score -= 12;
      return {
        score: Math.max(20, Math.min(98, score)),
        available: true,
        reason: input.webgpu
          ? 'Running on WebGPU'
          : 'WebGPU unavailable — using WebGL2 fallback',
      };
    }
    case 'unreal-pixelstream': {
      if (!input.webrtc) {
        return { score: 0, available: false, reason: 'Needs WebRTC (RTCPeerConnection)' };
      }
      if (!input.unrealConfigured) {
        return {
          score: 0,
          available: false,
          reason: 'Add a Pixel Streaming signalling URL in Engine Settings',
        };
      }
      return {
        score: 90,
        available: true,
        reason: 'Ready to connect to the Pixel Streaming host',
      };
    }
    case 'wgsl-native':
    default: {
      if (!input.webgpu) {
        return { score: 0, available: false, reason: 'Needs WebGPU' };
      }
      return {
        score: input.hardwareAdapter ? 88 : 55,
        available: true,
        reason: 'WGSL kernels ready on the shared WebGPU device',
      };
    }
  }
}

/**
 * Probe every engine. `settings` supplies operator configuration that changes
 * availability (e.g. the Unreal signalling URL).
 */
export async function probeStageEngines(
  settings?: Partial<StageEngineSettings>,
  input?: StageProbeInput,
): Promise<StageEngineAvailability[]> {
  const probe = input ?? (await collectStageProbeInput(Boolean(settings?.unreal?.signallingUrl)));
  const ids: StageEngineId[] = ['prism-three', 'prism-babylon', 'unreal-pixelstream', 'wgsl-native'];
  const results: StageEngineAvailability[] = ids.map((id) => {
    const { score, available, reason } = scoreFor(id, probe);
    return {
      id,
      available,
      reason,
      recommended: false,
      headroomScore: score,
    };
  });

  const bestInteractive = results
    .filter((r) => (r.id === 'prism-three' || r.id === 'prism-babylon') && r.available)
    .sort((a, b) => b.headroomScore - a.headroomScore)[0];
  const recommendedId = bestInteractive?.id ?? DEFAULT_STAGE_ENGINE;
  for (const result of results) {
    if (result.id === recommendedId) result.recommended = true;
  }
  return results;
}

/** Resolve the engine to actually run given preference + availability. */
export function resolveActiveEngine(
  preferred: StageEngineId,
  fallback: StageEngineId,
  autoFallback: boolean,
  availability: StageEngineAvailability[],
): StageEngineId {
  const byId = new Map(availability.map((entry) => [entry.id, entry]));
  const preferredEntry = byId.get(preferred);
  if (preferredEntry?.available) return preferred;
  if (!autoFallback) return preferred;
  const fallbackEntry = byId.get(fallback);
  if (fallbackEntry?.available) return fallback;
  return preferred;
}
