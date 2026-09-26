/**
 * Engine metrics: frame timing statistics, GPU kernel timing via
 * `timestamp-query`, and a working-set estimate for the settings HUD.
 */
import { BUFFER_USAGE, MAP_MODE, QUERY_TYPE_TIMESTAMP } from './gpuFlags';
import { readLimit } from './gpuFlags';
import type { EngineCapabilities, RenderEngineSettings } from './types';

const RING = 240;

/** Rolling frame-time statistics (ring buffer — no allocation per frame). */
export class FrameMetrics {
  private readonly samples = new Float32Array(RING);
  private cursor = 0;
  private filled = 0;

  push(frameMs: number): void {
    if (!Number.isFinite(frameMs) || frameMs <= 0) return;
    this.samples[this.cursor] = frameMs;
    this.cursor = (this.cursor + 1) % RING;
    if (this.filled < RING) this.filled += 1;
  }

  get count(): number {
    return this.filled;
  }

  get avgFrameMs(): number {
    if (this.filled === 0) return 0;
    let sum = 0;
    for (let i = 0; i < this.filled; i += 1) sum += this.samples[i];
    return sum / this.filled;
  }

  get fps(): number {
    const avg = this.avgFrameMs;
    return avg > 0 ? 1000 / avg : 0;
  }

  /** 95th percentile frame time — the stutter the eye actually notices. */
  get p95FrameMs(): number {
    if (this.filled === 0) return 0;
    const sorted = Array.from(this.samples.slice(0, this.filled)).sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
    return sorted[index];
  }

  reset(): void {
    this.cursor = 0;
    this.filled = 0;
    this.samples.fill(0);
  }
}

interface ReadbackSlot {
  buffer: GPUBuffer;
  state: 'idle' | 'pending' | 'mapping';
}

/**
 * GPU section timer backed by the `timestamp-query` feature.
 *
 * WebGPU writes timestamps through `timestampWrites` on pass descriptors
 * (there is no `encoder.writeTimestamp` in the modern spec), so consumers
 * attach `beginWrites` to the first pass of the timed section and `endWrites`
 * to the last, then call `resolve()` once on the encoder. Results round-trip
 * through a rotating set of readback buffers so the queue never stalls.
 * Reports `null` where the feature is missing.
 */
export class GpuTimer {
  private querySet: GPUQuerySet | null = null;
  private resolveBuffer: GPUBuffer | null = null;
  private slots: ReadbackSlot[] = [];
  private slotCursor = 0;
  private lastGpuMs: number | null = null;
  private frameIndex = 0;
  private supported = false;

  constructor(device: GPUDevice, enabled: boolean) {
    this.supported = enabled && (device.features as unknown as Set<string>).has('timestamp-query');
    if (!this.supported) return;
    try {
      this.querySet = device.createQuerySet({
        type: QUERY_TYPE_TIMESTAMP,
        count: 2,
      });
      this.resolveBuffer = device.createBuffer({
        size: 16,
        usage: BUFFER_USAGE.queryResolve | BUFFER_USAGE.copySrc,
      });
      for (let i = 0; i < 3; i += 1) {
        this.slots.push({
          buffer: device.createBuffer({
            size: 16,
            usage: BUFFER_USAGE.mapRead | BUFFER_USAGE.copyDst,
          }),
          state: 'idle',
        });
      }
    } catch {
      this.supported = false;
    }
  }

  get available(): boolean {
    return this.supported;
  }

  get gpuMs(): number | null {
    return this.lastGpuMs;
  }

  /** Attach to the FIRST pass of the timed section. */
  get beginWrites(): GPUComputePassTimestampWrites | null {
    if (!this.supported || !this.querySet) return null;
    return { querySet: this.querySet, beginningOfPassWriteIndex: 0 };
  }

  /** Attach to the LAST pass of the timed section. */
  get endWrites(): GPUComputePassTimestampWrites | null {
    if (!this.supported || !this.querySet) return null;
    return { querySet: this.querySet, endOfPassWriteIndex: 1 };
  }

  /** Resolve the query pair and schedule a readback (call once per frame). */
  resolve(encoder: GPUCommandEncoder): void {
    if (!this.supported || !this.querySet || !this.resolveBuffer) return;
    try {
      encoder.resolveQuerySet(this.querySet, 0, 2, this.resolveBuffer, 0);
      const slot = this.slots[this.slotCursor];
      this.slotCursor = (this.slotCursor + 1) % this.slots.length;
      if (slot.state !== 'idle') return;
      encoder.copyBufferToBuffer(this.resolveBuffer, 0, slot.buffer, 0, 16);
      slot.state = 'pending';
      this.frameIndex += 1;
    } catch {
      this.supported = false;
    }
  }

  /** Poll finished readbacks — call once per engine tick. */
  async poll(): Promise<number | null> {
    if (!this.supported) return null;
    for (const slot of this.slots) {
      if (slot.state !== 'pending') continue;
      slot.state = 'mapping';
      try {
        await slot.buffer.mapAsync(MAP_MODE.read);
        const range = new BigUint64Array(slot.buffer.getMappedRange().slice(0));
        slot.buffer.unmap();
        const begin = Number(range[0]);
        const end = Number(range[1]);
        if (end > begin) this.lastGpuMs = (end - begin) / 1e6;
      } catch {
        /* dropped frame / remapped — ignore */
      }
      slot.state = 'idle';
    }
    return this.lastGpuMs;
  }

  destroy(): void {
    try {
      this.querySet?.destroy();
      this.resolveBuffer?.destroy();
      for (const slot of this.slots) slot.buffer.destroy();
    } catch {
      /* best effort */
    }
    this.slots = [];
  }
}

/**
 * Heuristic VRAM working-set estimate for the HUD: HDR buffers scale with
 * render area, shadow/AA buffers with quality, kernels have flat overhead.
 */
export function estimateVramBytes(
  caps: EngineCapabilities | null,
  settings: RenderEngineSettings,
  surfaceCount: number,
  surfaceAreaPx = 1920 * 1080,
): number {
  const bytesPerHdrPixel = settings.hdrOutput ? 8 : 4;
  const area = Math.max(1, surfaceAreaPx) * settings.renderScale * settings.renderScale;
  const perSurface = area * bytesPerHdrPixel * 4; // color + history + bloom chain
  const shadows = settings.shadows
    ? { low: 16, medium: 32, high: 64, ultra: 128 }[settings.shadowQuality] * 1024 * 1024
    : 0;
  const aa = settings.antiAliasing === 'msaa' ? area * 4 * settings.msaaSamples : 0;
  const kernels = 24 * 1024 * 1024;
  const limitsHint = caps ? Math.min(1, readLimit(caps.webgpu.limits, 'maxStorageBufferBindingSize') / (256 * 1024 * 1024)) : 0.5;
  return Math.round((perSurface * Math.max(1, surfaceCount) + shadows + aa + kernels) * (0.85 + limitsHint * 0.3));
}

/** Compact "12.4 GB" style label for the HUD. */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 || unit < 2 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}
