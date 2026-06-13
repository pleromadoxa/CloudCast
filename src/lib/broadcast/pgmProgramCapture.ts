import { toCanvas } from 'html-to-image';

const OUTPUT_WIDTH = 1280;
const OUTPUT_HEIGHT = 720;

function isDrawableVideo(el: HTMLVideoElement): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 4 && r.height > 4 && el.readyState >= 2;
}

function isDrawableCanvas(el: HTMLCanvasElement): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 4 && r.height > 4;
}

export interface PgmProgramCaptureOptions {
  container: HTMLElement;
  audioVideo?: HTMLVideoElement | null;
  /** Gain-controlled PGM bus — respects master mute / faders on broadcast. */
  broadcastAudioStream?: MediaStream | null;
  fadeToBlackLevel?: number;
}

function isDomSnapshotExcluded(node: HTMLElement): boolean {
  if (node instanceof HTMLVideoElement || node instanceof HTMLCanvasElement) return true;
  return Boolean(node.closest('[data-pgm-graphics]'));
}

/** Composites the visible PGM monitor (video, chroma, PiP, graphics) into a MediaStream. */
export class PgmProgramCapture {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private stopping = false;
  private domSnapshotCanvas: HTMLCanvasElement | null = null;
  private overlayCanvas: HTMLCanvasElement | null = null;
  private fadeLevel = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = OUTPUT_WIDTH;
    this.canvas.height = OUTPUT_HEIGHT;
    this.ctx = this.canvas.getContext('2d')!;
  }

  start({
    container,
    audioVideo,
    broadcastAudioStream,
    fadeToBlackLevel = 0,
  }: PgmProgramCaptureOptions): MediaStream {
    this.fadeLevel = fadeToBlackLevel;
    const stream = this.canvas.captureStream(30);

    const audioSource = broadcastAudioStream ?? (
      audioVideo?.srcObject instanceof MediaStream ? (audioVideo.srcObject as MediaStream) : null
    );

    if (audioSource) {
      for (const track of audioSource.getAudioTracks()) {
        if (track.readyState === 'live') stream.addTrack(track.clone());
      }
    }

    const graphicsEl = container.querySelector('[data-pgm-graphics]') as HTMLElement | null;
    let lastDomCapture = 0;
    let lastGfxCapture = 0;
    let domCapturing = false;
    let gfxCapturing = false;

    const captureDom = async () => {
      if (domCapturing) return;
      domCapturing = true;
      try {
        const c = await toCanvas(container, {
          pixelRatio: 1,
          cacheBust: true,
          filter: (node) => !isDomSnapshotExcluded(node as HTMLElement),
        });
        this.domSnapshotCanvas = c;
      } catch {
        /* DOM snapshot is best-effort (display feed, placeholders, status text) */
      } finally {
        domCapturing = false;
      }
    };

    const captureGraphics = async () => {
      if (!graphicsEl || gfxCapturing) return;
      gfxCapturing = true;
      try {
        const c = await toCanvas(graphicsEl, { pixelRatio: 1, cacheBust: true });
        this.overlayCanvas = c;
      } catch {
        /* graphics capture is best-effort */
      } finally {
        gfxCapturing = false;
      }
    };

    const paint = () => {
      if (this.stopping) return;

      const rect = container.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) {
        this.raf = requestAnimationFrame(paint);
        return;
      }

      const sx = OUTPUT_WIDTH / rect.width;
      const sy = OUTPUT_HEIGHT / rect.height;

      this.ctx.fillStyle = '#000';
      this.ctx.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

      if (this.domSnapshotCanvas) {
        this.ctx.drawImage(this.domSnapshotCanvas, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
      }

      for (const canvas of container.querySelectorAll('canvas')) {
        if (!isDrawableCanvas(canvas)) continue;
        const cr = canvas.getBoundingClientRect();
        this.ctx.drawImage(
          canvas,
          (cr.left - rect.left) * sx,
          (cr.top - rect.top) * sy,
          cr.width * sx,
          cr.height * sy,
        );
      }

      for (const video of container.querySelectorAll('video')) {
        if (!isDrawableVideo(video)) continue;
        const vr = video.getBoundingClientRect();
        try {
          this.ctx.drawImage(
            video,
            (vr.left - rect.left) * sx,
            (vr.top - rect.top) * sy,
            vr.width * sx,
            vr.height * sy,
          );
        } catch {
          /* frame not ready */
        }
      }

      if (this.overlayCanvas) {
        this.ctx.drawImage(this.overlayCanvas, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
      }

      if (this.fadeLevel > 0) {
        this.ctx.fillStyle = `rgba(0,0,0,${Math.min(1, this.fadeLevel / 100)})`;
        this.ctx.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
      }

      const now = Date.now();
      if (now - lastDomCapture > 200) {
        lastDomCapture = now;
        void captureDom();
      }
      if (now - lastGfxCapture > 200) {
        lastGfxCapture = now;
        void captureGraphics();
      }

      this.raf = requestAnimationFrame(paint);
    };

    void captureDom();
    void captureGraphics();
    paint();

    return stream;
  }

  setFadeToBlackLevel(level: number) {
    this.fadeLevel = level;
  }

  stop() {
    this.stopping = true;
    cancelAnimationFrame(this.raf);
    this.domSnapshotCanvas = null;
    this.overlayCanvas = null;
  }
}

/** PGM monitor is mounted and has layout — capture can mirror whatever is on program out. */
export function hasPgmOutputReady(container: HTMLElement | null): boolean {
  if (!container) return false;
  const r = container.getBoundingClientRect();
  return r.width > 4 && r.height > 4;
}

export function hasPgmVideoSignal(container: HTMLElement | null): boolean {
  if (!container) return false;

  for (const video of container.querySelectorAll('video')) {
    const r = video.getBoundingClientRect();
    if (r.width > 4 && r.height > 4 && video.readyState >= 2) return true;
  }

  for (const canvas of container.querySelectorAll('canvas')) {
    const r = canvas.getBoundingClientRect();
    if (r.width > 4 && r.height > 4) return true;
  }

  return false;
}

export async function waitForPgmSignal(
  getContainer: () => HTMLElement | null,
  timeoutMs = 6000,
): Promise<HTMLElement | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const container = getContainer();
    if (hasPgmVideoSignal(container)) return container;
    await new Promise((r) => setTimeout(r, 150));
  }
  return getContainer();
}
