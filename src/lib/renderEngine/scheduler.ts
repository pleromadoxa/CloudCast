/**
 * Background frame scheduler.
 *
 * The engine "runs in the background": one shared timing loop drives every
 * registered client (engine core, surfaces, cinematic jobs) even when the
 * operator has navigated away from the console that owns a canvas. Power
 * profile and `backgroundRender` decide how hard it works while hidden:
 *
 * - `off`        → pause scheduling while hidden, resume instantly on focus
 * - `throttled`  → 4 Hz maintenance ticks while hidden (metrics, recovery)
 * - `full`       → keep rendering at the capped rate while hidden
 *
 * Surfaces stay responsible for their own drawing; the scheduler gives them
 * a stable, budgeted tick and collects per-surface frame costs.
 */
import type { BackgroundRenderMode, PowerProfile } from './types';

export interface FrameTick {
  /** Milliseconds since the previous delivered tick. */
  dt: number;
  /** High-resolution timestamp of the tick. */
  now: number;
  /** Monotonic tick counter. */
  frame: number;
  /** True when the document is hidden (background mode active). */
  hidden: boolean;
}

export type FrameClient = (tick: FrameTick) => void;

interface ClientEntry {
  name: string;
  client: FrameClient;
  priority: number;
}

const BACKGROUND_TICK_MS = 250; // 4 Hz maintenance cadence

export class FrameScheduler {
  private clients: ClientEntry[] = [];
  private rafId: number | null = null;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private frame = 0;
  private lastTime = 0;
  private maxFrameRate = 0;
  private backgroundRender: BackgroundRenderMode = 'throttled';
  private powerProfile: PowerProfile = 'balanced';
  private visibilityBound = false;

  register(name: string, client: FrameClient, priority = 0): () => void {
    const entry: ClientEntry = { name, client, priority };
    this.clients.push(entry);
    this.clients.sort((a, b) => a.priority - b.priority);
    return () => {
      const index = this.clients.indexOf(entry);
      if (index !== -1) this.clients.splice(index, 1);
    };
  }

  configure(options: {
    maxFrameRate?: number;
    backgroundRender?: BackgroundRenderMode;
    powerProfile?: PowerProfile;
  }): void {
    if (options.maxFrameRate !== undefined) this.maxFrameRate = options.maxFrameRate;
    if (options.backgroundRender !== undefined) {
      const previous = this.backgroundRender;
      this.backgroundRender = options.backgroundRender;
      if (this.running && previous !== this.backgroundRender) this.restartLoop();
    }
    if (options.powerProfile !== undefined) this.powerProfile = options.powerProfile;
  }

  get isRunning(): boolean {
    return this.running;
  }

  /** Effective frame budget in ms after profile + operator cap. */
  get frameBudgetMs(): number {
    const profileCap =
      this.powerProfile === 'performance' ? 240 : this.powerProfile === 'balanced' ? 60 : 30;
    const hz = this.maxFrameRate > 0 ? Math.min(this.maxFrameRate, profileCap) : profileCap;
    return 1000 / hz;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.bindVisibility();
    this.restartLoop();
  }

  stop(): void {
    this.running = false;
    this.unbindVisibility();
    this.cancelLoop();
    this.frame = 0;
    this.lastTime = 0;
  }

  private bindVisibility(): void {
    if (this.visibilityBound || typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', this.onVisibility);
    this.visibilityBound = true;
  }

  private unbindVisibility(): void {
    if (!this.visibilityBound || typeof document === 'undefined') return;
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.visibilityBound = false;
  }

  private onVisibility = (): void => {
    if (!this.running) return;
    // Re-enter the right loop for the new visibility state.
    this.restartLoop();
  };

  private restartLoop(): void {
    this.cancelLoop();
    if (!this.running) return;
    if (this.backgroundRender === 'off' && this.hidden()) {
      // Paused while hidden; `visibilitychange` restarts us.
      return;
    }
    if (this.hidden() && this.backgroundRender === 'throttled') {
      this.scheduleBackgroundTick();
      return;
    }
    this.scheduleRaf();
  }

  private hidden(): boolean {
    return typeof document !== 'undefined' ? document.visibilityState === 'hidden' : false;
  }

  private scheduleRaf(): void {
    if (typeof requestAnimationFrame !== 'undefined') {
      this.rafId = requestAnimationFrame(this.onRaf);
    } else {
      this.timerId = setTimeout(() => this.onRaf(performance.now()), this.frameBudgetMs);
    }
  }

  private scheduleBackgroundTick(): void {
    this.timerId = setTimeout(() => {
      this.timerId = null;
      this.deliver(performance.now(), true);
      if (this.running && this.hidden() && this.backgroundRender === 'throttled') {
        this.scheduleBackgroundTick();
      }
    }, BACKGROUND_TICK_MS);
  }

  private onRaf = (now: number): void => {
    this.rafId = null;
    this.timerId = null;
    if (!this.running) return;

    const budget = this.frameBudgetMs;
    const elapsed = this.lastTime > 0 ? now - this.lastTime : budget;
    if (budget > 0 && elapsed < budget - 1) {
      // Frame pacing — skip the vsync slot we don't need.
      this.scheduleRaf();
      return;
    }

    this.deliver(elapsed, this.hidden());
    if (!this.running) return;

    if (this.hidden() && this.backgroundRender === 'throttled') {
      this.scheduleBackgroundTick();
    } else {
      this.scheduleRaf();
    }
  };

  private deliver(dt: number, hidden: boolean): void {
    this.frame += 1;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.lastTime = now;
    const tick: FrameTick = { dt, now, frame: this.frame, hidden };
    for (const entry of [...this.clients]) {
      try {
        entry.client(tick);
      } catch (err) {
        // One misbehaving client must not stop the kernel.
         
        console.warn('[renderEngine] frame client failed:', entry.name, err);
      }
    }
  }

  private cancelLoop(): void {
    if (this.rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.rafId);
    }
    this.rafId = null;
    if (this.timerId !== null) clearTimeout(this.timerId);
    this.timerId = null;
  }
}
