/**
 * Shared GPU device lifecycle.
 *
 * Every kernel in the engine — and any surface that wants raw WebGPU (the
 * motion backdrop, cinematic renderer, post kernel) — draws through ONE
 * `GPUDevice`. That keeps memory coherent, lets timestamp queries measure the
 * whole queue, and gives us a single place to handle device loss: the engine
 * marks itself `lost`, optionally re-acquires (with backoff), and notifies
 * every consumer so pipelines can rebuild.
 */
import { probeWebGpu } from './capabilities';
import type { WebGpuProbeResult } from './capabilities';

export type DeviceLostListener = (info: { reason: string; willRecover: boolean }) => void;
export type DeviceReadyListener = (device: GPUDevice) => void;

export interface SharedDeviceDescriptor {
  adapterLabel: string;
  vendor: string;
  features: string[];
  limits: Record<string, number>;
  canvasFormat: GPUTextureFormat;
}

const RECOVER_BACKOFF_MS = 1200;

export class RenderDeviceManager {
  private device: GPUDevice | null = null;
  private pending: Promise<GPUDevice> | null = null;
  private probe: WebGpuProbeResult | null = null;
  private descriptor: SharedDeviceDescriptor | null = null;
  private lostListeners = new Set<DeviceLostListener>();
  private readyListeners = new Set<DeviceReadyListener>();
  private autoRecover = true;
  private destroyed = false;
  private recoverTimer: ReturnType<typeof setTimeout> | null = null;

  setAutoRecover(enabled: boolean): void {
    this.autoRecover = enabled;
  }

  /** Seed with an adapter found during capability probing (avoids a second ask). */
  prime(probe: WebGpuProbeResult): void {
    if (!this.device && !this.pending) this.probe = probe;
  }

  get current(): GPUDevice | null {
    return this.device;
  }

  get info(): SharedDeviceDescriptor | null {
    return this.descriptor;
  }

  get canvasFormat(): GPUTextureFormat {
    try {
      return typeof navigator !== 'undefined' && navigator.gpu
        ? navigator.gpu.getPreferredCanvasFormat()
        : 'bgra8unorm';
    } catch {
      return 'bgra8unorm';
    }
  }

  onLost(listener: DeviceLostListener): () => void {
    this.lostListeners.add(listener);
    return () => {
      this.lostListeners.delete(listener);
    };
  }

  onReady(listener: DeviceReadyListener): () => void {
    this.readyListeners.add(listener);
    return () => {
      this.readyListeners.delete(listener);
    };
  }

  /** Idempotent; concurrent callers share one in-flight request. */
  acquire(): Promise<GPUDevice> {
    if (this.destroyed) return Promise.reject(new Error('device manager destroyed'));
    if (this.device) return Promise.resolve(this.device);
    if (this.pending) return this.pending;
    this.pending = this.requestDevice()
      .then((device) => {
        this.pending = null;
        this.device = device;
        this.watch(device);
        for (const listener of [...this.readyListeners]) listener(device);
        return device;
      })
      .catch((err: unknown) => {
        this.pending = null;
        throw err instanceof Error ? err : new Error('WebGPU device request failed');
      });
    return this.pending;
  }

  private async requestDevice(): Promise<GPUDevice> {
    const probe = this.probe ?? (await probeWebGpu());
    this.probe = probe;
    if (!probe.adapter) throw new Error('No WebGPU adapter');
    const device = await probe.adapter.requestDevice({
      requiredFeatures: probe.requestedFeatureNames as GPUFeatureName[],
      requiredLimits: probe.requestedLimitValues as Record<string, number> as never,
    });
    this.descriptor = {
      adapterLabel: probe.capabilities.adapterLabel,
      vendor: probe.capabilities.vendor,
      features: [...probe.requestedFeatureNames],
      limits: probe.requestedLimitValues,
      canvasFormat: this.canvasFormat,
    };
    this.instrumentErrors(device);
    return device;
  }

  private instrumentErrors(device: GPUDevice): void {
    try {
      device.onuncapturederror = (event: GPUUncapturedErrorEvent) => {
        // Surfaced for the engine log — never throw, kernels must keep running.
         
        console.warn('[renderEngine] uncaptured GPU error:', event.error?.message ?? event.error);
      };
    } catch {
      /* older implementations */
    }
  }

  private watch(device: GPUDevice): void {
    device.lost
      .then((info) => {
        if (this.destroyed || this.device !== device) return;
        this.device = null;
        this.descriptor = null;
        const willRecover = this.autoRecover;
        for (const listener of [...this.lostListeners]) {
          listener({ reason: info?.reason ?? 'unknown', willRecover });
        }
        if (willRecover) this.scheduleRecover();
      })
      .catch(() => undefined);
  }

  private scheduleRecover(): void {
    if (this.recoverTimer !== null || this.destroyed) return;
    this.recoverTimer = setTimeout(() => {
      this.recoverTimer = null;
      this.acquire().catch(() => {
        // Still lost — try again with backoff while autoRecover stays on.
        this.scheduleRecover();
      });
    }, RECOVER_BACKOFF_MS);
  }

  destroy(): void {
    this.destroyed = true;
    if (this.recoverTimer !== null) {
      clearTimeout(this.recoverTimer);
      this.recoverTimer = null;
    }
    const device = this.device;
    this.device = null;
    this.descriptor = null;
    this.lostListeners.clear();
    this.readyListeners.clear();
    try {
      device?.destroy();
    } catch {
      /* already gone */
    }
  }
}

/* ---------------------------------------------------- module singleton --- */

let sharedManager: RenderDeviceManager | null = null;

export function getDeviceManager(): RenderDeviceManager {
  if (!sharedManager) sharedManager = new RenderDeviceManager();
  return sharedManager;
}

/**
 * Convenience for non-engine consumers (e.g. the motion backdrop) that want
 * to draw on the engine's shared device instead of requesting their own.
 * Falls back to `null` when the engine's device isn't up yet.
 */
export function peekSharedGpuDevice(): GPUDevice | null {
  return sharedManager?.current ?? null;
}
