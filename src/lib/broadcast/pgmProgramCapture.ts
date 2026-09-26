import { toCanvas } from 'html-to-image';

/** Reference width for the broadcast canvas; height follows the source aspect ratio. */
const OUTPUT_REFERENCE_WIDTH = 1280;
const OUTPUT_FALLBACK_HEIGHT = 720;

/** H.264 requires even dimensions. */
function toEven(n: number): number {
  const v = Math.round(n);
  return v % 2 === 0 ? v : v + 1;
}

function isPgmCaptureFeed(el: HTMLElement): boolean {
  const flag = el.dataset.pgmCapture;
  return flag === '1' || flag === 'true';
}

function isDrawableVideo(el: HTMLVideoElement): boolean {
  if (el.readyState < 2 || el.videoWidth < 1) return false;
  if (isPgmCaptureFeed(el)) return true;
  const r = el.getBoundingClientRect();
  return r.width > 4 && r.height > 4;
}

function isDrawableCanvas(el: HTMLCanvasElement): boolean {
  if (isPgmCaptureFeed(el)) return el.width > 0 && el.height > 0;
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
  private outW = OUTPUT_REFERENCE_WIDTH;
  private outH = OUTPUT_FALLBACK_HEIGHT;
  /** Layout rect locked at start so dashboard resize does not rescale the live encode. */
  private layoutW = 0;
  private layoutH = 0;
  private captureTrack: MediaStreamTrack | null = null;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.outW;
    this.canvas.height = this.outH;
    this.ctx = this.canvas.getContext('2d')!;
  }

  start({
    container,
    audioVideo,
    broadcastAudioStream,
    fadeToBlackLevel = 0,
  }: PgmProgramCaptureOptions): MediaStream {
    this.fadeLevel = fadeToBlackLevel;

    // Lock the broadcast resolution to the source frame's aspect ratio — independent of
    // the on-screen monitor size. With a fixed-size capture container this stays stable
    // no matter how the dashboard layout is resized.
    const initialRect = container.getBoundingClientRect();
    if (initialRect.width > 1 && initialRect.height > 1) {
      this.layoutW = initialRect.width;
      this.layoutH = initialRect.height;
      this.outW = OUTPUT_REFERENCE_WIDTH;
      this.outH = toEven((OUTPUT_REFERENCE_WIDTH * initialRect.height) / initialRect.width);
    } else {
      this.layoutW = OUTPUT_REFERENCE_WIDTH;
      this.layoutH = OUTPUT_FALLBACK_HEIGHT;
    }
    this.canvas.width = this.outW;
    this.canvas.height = this.outH;

    // Off-DOM canvases can stall captureStream in some browsers — keep a 1px footprint.
    this.canvas.style.position = 'fixed';
    this.canvas.style.left = '-9999px';
    this.canvas.style.top = '0';
    this.canvas.style.width = `${this.outW}px`;
    this.canvas.style.height = `${this.outH}px`;
    this.canvas.style.pointerEvents = 'none';
    this.canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(this.canvas);

    const stream = this.canvas.captureStream(30);
    this.captureTrack = stream.getVideoTracks()[0] ?? null;

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

      const liveRect = container.getBoundingClientRect();
      const layoutW = this.layoutW > 1 ? this.layoutW : liveRect.width;
      const layoutH = this.layoutH > 1 ? this.layoutH : liveRect.height;
      if (layoutW < 1 || layoutH < 1) {
        this.raf = requestAnimationFrame(paint);
        return;
      }

      const sx = this.outW / layoutW;
      const sy = this.outH / layoutH;
      const originLeft = liveRect.left;
      const originTop = liveRect.top;

      this.ctx.fillStyle = '#000';
      this.ctx.fillRect(0, 0, this.outW, this.outH);

      if (this.domSnapshotCanvas) {
        this.ctx.drawImage(this.domSnapshotCanvas, 0, 0, this.outW, this.outH);
      }

      for (const canvas of container.querySelectorAll('canvas')) {
        if (!isDrawableCanvas(canvas) || isPgmCaptureFeed(canvas)) continue;
        const cr = canvas.getBoundingClientRect();
        this.ctx.drawImage(
          canvas,
          (cr.left - originLeft) * sx,
          (cr.top - originTop) * sy,
          cr.width * sx,
          cr.height * sy,
        );
      }

      for (const video of container.querySelectorAll('video')) {
        if (!isDrawableVideo(video) || isPgmCaptureFeed(video)) continue;
        const vr = video.getBoundingClientRect();
        try {
          this.ctx.drawImage(
            video,
            (vr.left - originLeft) * sx,
            (vr.top - originTop) * sy,
            vr.width * sx,
            vr.height * sy,
          );
        } catch {
          /* frame not ready */
        }
      }

      for (const img of container.querySelectorAll('img')) {
        if (!(img instanceof HTMLImageElement) || !img.complete || img.naturalWidth < 1) continue;
        const ir = img.getBoundingClientRect();
        if (ir.width < 4 || ir.height < 4) continue;
        try {
          this.ctx.drawImage(
            img,
            (ir.left - originLeft) * sx,
            (ir.top - originTop) * sy,
            ir.width * sx,
            ir.height * sy,
          );
        } catch {
          /* tainted or not ready */
        }
      }

      const hasLayoutVideo = Array.from(container.querySelectorAll('video')).some((video) => {
        if (!(video instanceof HTMLVideoElement) || isPgmCaptureFeed(video)) return false;
        return isDrawableVideo(video);
      });

      // Hidden encode feeds (Display/Browser capture) are layout-collapsed — paint full
      // frame only when there is no live camera/media video already on program.
      if (!hasLayoutVideo) {
        for (const canvas of container.querySelectorAll('canvas[data-pgm-capture]')) {
          if (!(canvas instanceof HTMLCanvasElement) || !isDrawableCanvas(canvas)) continue;
          try {
            this.ctx.drawImage(canvas, 0, 0, this.outW, this.outH);
          } catch {
            /* frame not ready */
          }
        }

        for (const video of container.querySelectorAll('video[data-pgm-capture]')) {
          if (!(video instanceof HTMLVideoElement) || !isDrawableVideo(video)) continue;
          try {
            this.ctx.drawImage(video, 0, 0, this.outW, this.outH);
          } catch {
            /* frame not ready */
          }
        }
      }

      if (this.overlayCanvas) {
        this.ctx.drawImage(this.overlayCanvas, 0, 0, this.outW, this.outH);
      }

      if (this.fadeLevel > 0) {
        this.ctx.fillStyle = `rgba(0,0,0,${Math.min(1, this.fadeLevel / 100)})`;
        this.ctx.fillRect(0, 0, this.outW, this.outH);
      }

      const track = this.captureTrack as MediaStreamTrack & { requestFrame?: () => void };
      track?.requestFrame?.();

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
    this.captureTrack = null;
    if (this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
  }
}

/** PGM monitor is mounted and has layout — capture can mirror whatever is on program out. */
export function hasPgmOutputReady(container: HTMLElement | null): boolean {
  if (!container) return false;
  const r = container.getBoundingClientRect();
  return r.width > 4 && r.height > 4;
}

/** True when the PGM frame has drawable video/canvas (camera, media, display, browser encode, chroma). */
export function isPgmReadyForBroadcast(container: HTMLElement | null): boolean {
  return hasPgmOutputReady(container) && hasPgmVideoSignal(container);
}

export function hasPgmVideoSignal(container: HTMLElement | null): boolean {
  if (!container) return false;

  for (const video of container.querySelectorAll('video')) {
    if (video.readyState >= 2 && video.videoWidth > 0) {
      if (isPgmCaptureFeed(video)) return true;
      const r = video.getBoundingClientRect();
      if (r.width > 4 && r.height > 4) return true;
    }
  }

  for (const canvas of container.querySelectorAll('canvas')) {
    if (isPgmCaptureFeed(canvas) && canvas.width > 0 && canvas.height > 0) return true;
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

/** Let the PGM composite paint a few frames before MediaRecorder starts. */
export async function warmupCaptureStream(stream: MediaStream, frames = 8): Promise<void> {
  const track = stream.getVideoTracks()[0] as (MediaStreamTrack & { requestFrame?: () => void }) | undefined;
  if (!track || track.readyState === 'ended') return;

  for (let i = 0; i < frames; i += 1) {
    track.requestFrame?.();
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }
}
