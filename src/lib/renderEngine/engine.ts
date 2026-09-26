/**
 * CloudCast Render Engine — the background kernel.
 *
 * One long-lived engine instance owns the GPU device, capability report,
 * frame scheduler, metrics, adaptive quality control, the realtime PostKernel
 * and the cinematic path tracer. It boots with the production shell, keeps
 * running in the background under the operator's Settings policy, and every
 * graphic surface in the app reads its grade / quality / budget from here.
 */
import { composeCapabilities, pickBackend, probeWebGL2, probeWebGpu } from './capabilities';
import { CinematicRenderer } from './cinematicRenderer';
import type { CinematicRenderOptions, CinematicResult } from './cinematicRenderer';
import { RenderDeviceManager, getDeviceManager } from './deviceManager';
import { PostKernel } from './kernels/postKernel';
import { FrameMetrics, GpuTimer, estimateVramBytes } from './metrics';
import { frameBudgetMs, nextAdaptiveAction, studioTierForQuality } from './quality';
import type { AdaptiveFrameState, StudioQualityTierName } from './quality';
import { FrameScheduler } from './scheduler';
import { RenderEngineSettingsStore } from './settings';
import type {
  EngineBackend,
  EngineCapabilities,
  EnginePhase,
  EngineSurfaceHandle,
  RenderEngineStatus,
} from './types';
import type { CinematicScene } from './pathTracer/scene';
import { buildCalibrationScene } from './pathTracer/scene';

const ADAPTIVE_WINDOW_MS = 2000;
const STATUS_NOTIFY_MS = 500;

export class RenderEngine {
  readonly settings = new RenderEngineSettingsStore();

  private readonly scheduler = new FrameScheduler();
  private readonly frameMetrics = new FrameMetrics();
  private readonly deviceManager: RenderDeviceManager;

  private capabilities: EngineCapabilities | null = null;
  private postKernel: PostKernel | null = null;
  private cinematic: CinematicRenderer | null = null;
  private gpuTimer: GpuTimer | null = null;

  private phase: EnginePhase = 'idle';
  private backend: EngineBackend = 'none';
  private errorMessage: string | null = null;
  private kernelWarnings: string[] = [];

  private initPromise: Promise<void> | null = null;
  private started = false;
  private settingsUnsub: (() => void) | null = null;
  private frame = 0;
  private adaptiveState: AdaptiveFrameState = {
    avgFrameMs: 16,
    targetFrameMs: 16.7,
    renderScale: 1,
    preset: 'balanced',
    overWindows: 0,
    headroomWindows: 0,
  };
  private lastAdaptiveAt = 0;
  private lastStatusNotifyAt = 0;
  private cachedStatus: RenderEngineStatus | null = null;
  private statusListeners = new Set<() => void>();
  private settingsListeners = new Set<() => void>();
  private surfaces = new Map<string, { area: number; lastMs: number }>();
  private cinematicSamples = 0;
  private cinematicTarget = 0;

  constructor(deviceManager?: RenderDeviceManager) {
    this.deviceManager = deviceManager ?? getDeviceManager();
  }

  /* --------------------------------------------------------- lifecycle --- */

  /** Probe the GPU and (for WebGPU) acquire the shared device. Idempotent. */
  init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.phase = 'probing';
    this.initPromise = this.doInit()
      .catch((err: unknown) => {
        this.phase = 'error';
        this.errorMessage = err instanceof Error ? err.message : 'render engine failed to start';
        this.cachedStatus = null;
        this.notifyStatus(true);
      })
      .finally(() => {
        this.notifyStatus(true);
      });
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    const settings = this.settings.get();

    // Capability probe doubles as the adapter request — no second ask.
    const probe = await probeWebGpu();
    const webgl2 = await probeWebGL2();
    this.backend = pickBackend(settings.backend, probe.capabilities.available, webgl2.available);
    this.capabilities = composeCapabilities(probe, webgl2);

    if (this.backend === 'none') {
      this.phase = 'unsupported';
      this.errorMessage = 'No WebGPU or WebGL2 support on this device';
      return;
    }

    if (this.backend === 'webgpu') {
      this.deviceManager.prime(probe);
      this.deviceManager.setAutoRecover(settings.autoRecover);
      this.deviceManager.onLost(({ reason, willRecover }) => {
        this.phase = willRecover ? 'lost' : 'degraded';
        this.errorMessage = `GPU device lost (${reason})${willRecover ? ' — recovering…' : ''}`;
        this.gpuTimer?.destroy();
        this.gpuTimer = null;
        this.postKernel?.destroy();
        this.postKernel = null;
        this.cinematic = null;
        this.notifyStatus(true);
      });
      this.deviceManager.onReady((device) => {
        this.setupDevice(device);
        this.phase = 'ready';
        this.errorMessage = null;
        this.notifyStatus(true);
      });

      const device = await this.deviceManager.acquire();
      this.setupDevice(device);
    }

    this.phase = 'ready';
    this.syncScheduler();
    this.cachedStatus = null;
    this.notifyStatus(true);
  }

  private setupDevice(device: GPUDevice): void {
    if (this.postKernel) return;
    this.postKernel = new PostKernel(device);
    this.cinematic = new CinematicRenderer(device, this.postKernel);
    const hasTimestamp = (device.features as unknown as Set<string>).has('timestamp-query');
    this.gpuTimer = new GpuTimer(device, hasTimestamp);
    this.postKernel.setTimer(this.gpuTimer);
    void this.postKernel.init().then((messages) => {
      if (messages.length > 0) {
        this.kernelWarnings = messages;
         
        console.warn('[renderEngine] kernel validation warnings:', messages);
        this.notifyStatus(true);
      }
    });
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    void this.init();
    this.settingsUnsub = this.settings.subscribe(() => {
      this.syncScheduler();
      this.deviceManager.setAutoRecover(this.settings.get().autoRecover);
      this.cachedStatus = null;
      for (const listener of [...this.settingsListeners]) listener();
      this.notifyStatus(true);
    });
    this.scheduler.register('engine-core', (tick) => this.tick(tick.dt, tick.now), -100);
    this.syncScheduler();
    this.scheduler.start();
  }

  stop(): void {
    this.started = false;
    this.settingsUnsub?.();
    this.settingsUnsub = null;
    this.scheduler.stop();
    this.frameMetrics.reset();
  }

  destroy(): void {
    this.stop();
    this.gpuTimer?.destroy();
    this.postKernel?.destroy();
    this.deviceManager.destroy();
    this.statusListeners.clear();
    this.settingsListeners.clear();
    this.surfaces.clear();
    this.phase = 'idle';
    this.initPromise = null;
    this.postKernel = null;
    this.cinematic = null;
    this.gpuTimer = null;
  }

  private syncScheduler(): void {
    const s = this.settings.get();
    this.scheduler.configure({
      maxFrameRate: s.maxFrameRate,
      backgroundRender: s.backgroundRender,
      powerProfile: s.powerProfile,
    });
    this.adaptiveState.targetFrameMs = frameBudgetMs(s.powerProfile, s.maxFrameRate);
    this.adaptiveState.renderScale = s.renderScale;
    this.adaptiveState.preset = s.quality;
  }

  /* -------------------------------------------------------------- tick --- */

  private tick(dt: number, now: number): void {
    this.frame += 1;
    if (dt > 0 && dt < 1000) this.frameMetrics.push(dt);

    if (this.gpuTimer && this.frame % 30 === 0) {
      void this.gpuTimer.poll();
    }

    const settings = this.settings.get();
    if (settings.enabled && settings.autoQuality && now - this.lastAdaptiveAt > ADAPTIVE_WINDOW_MS) {
      this.lastAdaptiveAt = now;
      this.runAdaptiveWindow();
    }

    if (now - this.lastStatusNotifyAt > STATUS_NOTIFY_MS) {
      this.lastStatusNotifyAt = now;
      this.cachedStatus = null;
      this.notifyStatus(false);
    }
  }

  private runAdaptiveWindow(): void {
    const settings = this.settings.get();
    this.adaptiveState.avgFrameMs = this.frameMetrics.avgFrameMs || this.adaptiveState.avgFrameMs;
    this.adaptiveState.renderScale = settings.renderScale;
    this.adaptiveState.preset = settings.quality;

    const action = nextAdaptiveAction(this.adaptiveState);
    if (action.kind === 'scale-down' || action.kind === 'scale-up') {
      this.adaptiveState.overWindows = 0;
      this.adaptiveState.headroomWindows = 0;
      if (action.renderScale !== undefined) this.settings.patch({ renderScale: action.renderScale });
    } else if (action.kind === 'preset-down' || action.kind === 'preset-up') {
      this.adaptiveState.overWindows = 0;
      this.adaptiveState.headroomWindows = 0;
      if (action.preset) this.settings.patch({ quality: action.preset });
    } else if (this.adaptiveState.avgFrameMs > this.adaptiveState.targetFrameMs * 1.15) {
      this.adaptiveState.overWindows += 1;
      this.adaptiveState.headroomWindows = 0;
    } else if (this.adaptiveState.avgFrameMs < this.adaptiveState.targetFrameMs * 0.72) {
      this.adaptiveState.headroomWindows += 1;
      this.adaptiveState.overWindows = 0;
    } else {
      this.adaptiveState.overWindows = 0;
      this.adaptiveState.headroomWindows = 0;
    }
  }

  /* ------------------------------------------------------------ status --- */

  getStatus(): RenderEngineStatus {
    if (this.cachedStatus) return this.cachedStatus;
    const settings = this.settings.get();
    const webgpu = this.capabilities?.webgpu;
    this.cachedStatus = {
      phase: this.phase,
      backend: this.backend,
      adapterLabel: webgpu?.available ? webgpu.adapterLabel : this.backend === 'webgl2' ? 'WebGL2' : 'none',
      vendor: webgpu?.vendor ?? 'unknown',
      features: webgpu?.requestedFeatures ?? [],
      limits: webgpu?.limits ?? {},
      fps: this.frameMetrics.fps,
      frameMs: this.frameMetrics.avgFrameMs,
      gpuMs: this.gpuTimer?.gpuMs ?? null,
      vramEstimateBytes: estimateVramBytes(
        this.capabilities,
        settings,
        Math.max(1, this.surfaces.size),
        this.totalSurfaceArea(),
      ),
      webgpuAvailable: Boolean(webgpu?.available),
      webgl2Available: Boolean(this.capabilities?.webgl2.available),
      quality: settings.quality,
      renderScale: settings.renderScale,
      error: this.errorMessage ?? (this.kernelWarnings.length > 0 ? this.kernelWarnings[0] : null),
      cinematicSamples: this.cinematicSamples,
      cinematicTargetSamples: this.cinematicTarget,
    };
    return this.cachedStatus;
  }

  subscribeStatus(listener: () => void): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  subscribeSettings(listener: () => void): () => void {
    this.settingsListeners.add(listener);
    return () => {
      this.settingsListeners.delete(listener);
    };
  }

  private notifyStatus(force: boolean): void {
    if (force) this.cachedStatus = null;
    for (const listener of [...this.statusListeners]) listener();
  }

  getCapabilities(): EngineCapabilities | null {
    return this.capabilities;
  }

  getBackend(): EngineBackend {
    return this.backend;
  }

  /** Virtual-studio tier bridge — the studio consumes engine quality. */
  studioTier(): StudioQualityTierName {
    return studioTierForQuality(this.settings.get().quality);
  }

  /** The engine's realtime post kernel (null until the device is up). */
  getPostKernel(): PostKernel | null {
    return this.postKernel;
  }

  /** Shared GPU device for raw-WebGPU surfaces (motion backdrop etc.). */
  acquireDevice(): Promise<GPUDevice> {
    return this.deviceManager.acquire();
  }

  /* ----------------------------------------------------------- surfaces --- */

  registerSurface(name: string, areaPx?: number): EngineSurfaceHandle {
    this.surfaces.set(name, { area: areaPx ?? 1920 * 1080, lastMs: 0 });
    return {
      name,
      reportFrame: (frameMs: number) => {
        const entry = this.surfaces.get(name);
        if (entry) entry.lastMs = frameMs;
      },
      dispose: () => {
        this.surfaces.delete(name);
      },
    };
  }

  private totalSurfaceArea(): number {
    let total = 0;
    for (const entry of this.surfaces.values()) total += entry.area;
    return total;
  }

  /* ---------------------------------------------------------- cinematic --- */

  /**
   * Progressive path-traced render of a scene, graded through the engine's
   * display transform. Defaults come from the Settings panel's cinematic
   * controls. Interruptible via `abortSignal`.
   */
  async runCinematicRender(
    scene: CinematicScene,
    options: Partial<CinematicRenderOptions> = {},
  ): Promise<CinematicResult> {
    await this.init();
    if (!this.cinematic) throw new Error('Cinematic renderer requires WebGPU');
    const settings = this.settings.get();
    const merged: CinematicRenderOptions = {
      width: options.width ?? 960,
      height: options.height ?? 540,
      samples: options.samples ?? settings.cinematic.samples,
      bounces: options.bounces ?? settings.cinematic.bounces,
      denoise: options.denoise ?? settings.cinematic.denoise,
      envIntensity: options.envIntensity ?? settings.cinematic.envIntensity,
      settings,
      onProgress: (done, target) => {
        this.cinematicSamples = done;
        this.cinematicTarget = target;
        options.onProgress?.(done, target);
        if (done % 8 === 0 || done === target) this.notifyStatus(false);
      },
      abortSignal: options.abortSignal,
      samplesPerDispatch: options.samplesPerDispatch ?? 2,
    };
    this.cinematicSamples = 0;
    this.cinematicTarget = merged.samples;
    return this.cinematic.render(scene, merged);
  }

  /** Convenience: the built-in calibration studio as a PNG blob. */
  async renderCalibrationStill(options: Partial<CinematicRenderOptions> = {}): Promise<Blob> {
    const scene = buildCalibrationScene();
    const result = await this.runCinematicRender(scene, options);
    return pixelsToPngBlob(result);
  }

  /**
   * GPU micro-benchmark on the path-tracer kernel — measures samples/second
   * at a fixed small resolution and maps it to a 0–100 score.
   */
  async runBenchmark(): Promise<{ score: number; samplesPerSecond: number }> {
    const scene = buildCalibrationScene();
    const result = await this.runCinematicRender(scene, {
      width: 320,
      height: 180,
      samples: 32,
      bounces: 3,
      denoise: 'off',
    });
    const samplesPerSecond = (result.width * result.height * result.samples) / (result.elapsedMs / 1000);
    const score = Math.max(1, Math.min(100, Math.round(samplesPerSecond / 5_000_000 * 100)));
    return { score, samplesPerSecond };
  }
}

/** PNG blob from a pixel readback (used for cinematic artifacts). */
export function pixelsToPngBlob(result: {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
}): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = result.width;
      canvas.height = result.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('2D canvas unavailable'));
        return;
      }
      // Copy into a fresh (definitely non-shared) buffer — ImageData rejects
      // views whose backing store is a SharedArrayBuffer.
      const pixels = new Uint8ClampedArray(result.pixels);
      ctx.putImageData(new ImageData(pixels, result.width, result.height), 0, 0);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('PNG encode failed'));
      }, 'image/png');
    } catch (err) {
      reject(err instanceof Error ? err : new Error('PNG encode failed'));
    }
  });
}

/* ---------------------------------------------------- module singleton --- */

let engineSingleton: RenderEngine | null = null;

export function getRenderEngine(): RenderEngine {
  if (!engineSingleton) engineSingleton = new RenderEngine();
  return engineSingleton;
}

export function resetRenderEngine(): void {
  engineSingleton?.destroy();
  engineSingleton = null;
}
