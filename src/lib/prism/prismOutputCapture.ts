import type { PrismLowerThird } from '../../types/prismFeed';
import type { PipCorner } from '../../types/prismCameras';

export interface PrismPipOverlay {
  canvas: HTMLCanvasElement;
  corner: PipCorner;
  label?: string;
}

/** A rendered 3D motion graphics canvas composited over the program frame. */
export interface PrismMotionOverlay {
  canvas: HTMLCanvasElement;
  /** 0–1 — used for fade-outs while the timeline winds down. */
  opacity?: number;
  /** Cinematic 2.39:1 bars drawn over the composited frame. */
  letterbox?: boolean;
}

export interface PrismCaptureOverlay {
  watermark?: boolean;
  lowerThird?: PrismLowerThird | null;
  pipOverlays?: PrismPipOverlay[];
  /** WebGPU backdrop plate — composited first, under the 3D scene. */
  motionBackdrop?: PrismMotionOverlay | null;
  motion?: PrismMotionOverlay | null;
}

/**
 * A drawable program source — either the WebGL/canvas stage produced by the
 * local engines, or the `<video>` carrying a remote Unreal Pixel Streaming
 * render. Both are cover-fitted identically so overlays stay aligned.
 */
export type PrismCaptureSource = HTMLCanvasElement | HTMLVideoElement;

function sourceSize(source: PrismCaptureSource): { sw: number; sh: number } {
  if (source instanceof HTMLVideoElement) {
    return { sw: source.videoWidth, sh: source.videoHeight };
  }
  return { sw: source.width, sh: source.height };
}

/** Captures a WebGL/Canvas element into a broadcast MediaStream. */
export class PrismOutputCapture {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private stopping = false;
  private source: PrismCaptureSource | null = null;
  private getOverlay: () => PrismCaptureOverlay = () => ({});

  constructor(width = 1280, height = 720) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d')!;
  }

  start(
    source: PrismCaptureSource,
    options?: {
      watermark?: boolean;
      width?: number;
      height?: number;
      getOverlay?: () => PrismCaptureOverlay;
    },
  ): MediaStream {
    this.source = source;
    this.getOverlay = options?.getOverlay ?? (() => ({ watermark: options?.watermark }));
    if (options?.width) this.canvas.width = options.width;
    if (options?.height) this.canvas.height = options.height;

    const stream = this.canvas.captureStream(30);
    this.stopping = false;

    const paint = () => {
      if (this.stopping || !this.source) return;
      const { sw, sh } = sourceSize(this.source);
      if (sw < 2 || sh < 2) {
        this.raf = requestAnimationFrame(paint);
        return;
      }

      const overlay = this.getOverlay();
      const dw = this.canvas.width;
      const dh = this.canvas.height;
      const scale = Math.min(dw / sw, dh / sh);
      const w = sw * scale;
      const h = sh * scale;
      const x = (dw - w) / 2;
      const y = (dh - h) / 2;

      this.ctx.fillStyle = '#000';
      this.ctx.fillRect(0, 0, dw, dh);
      this.ctx.drawImage(this.source, x, y, w, h);

      const lt = overlay.lowerThird;
      if (lt?.visible && (lt.title || lt.subtitle)) {
        const barH = lt.subtitle ? 72 : 48;
        const barY = dh - barH - 24;
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
        this.ctx.fillRect(48, barY, Math.min(dw * 0.55, 520), barH);
        this.ctx.fillStyle = '#f59e0b';
        this.ctx.fillRect(48, barY, 4, barH);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 20px system-ui, sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(lt.title, 64, barY + (lt.subtitle ? 26 : 30));
        if (lt.subtitle) {
          this.ctx.fillStyle = 'rgba(255,255,255,0.85)';
          this.ctx.font = '14px system-ui, sans-serif';
          this.ctx.fillText(lt.subtitle, 64, barY + 50);
        }
      }

      // 3D motion graphics (outros, stings, 3D lower thirds) sit above the
      // set and PiP layers but below the free-tier watermark. The WebGPU
      // backdrop plate is drawn first so the scene composites over it with
      // its own alpha — both layers are cover-fitted identically, so they
      // stay pixel-aligned.
      const drawLayer = (layer: PrismMotionOverlay | null | undefined) => {
        const layerCanvas = layer?.canvas;
        const alpha = Math.max(0, Math.min(1, layer?.opacity ?? 1));
        if (!layerCanvas || layerCanvas.width <= 8 || layerCanvas.height <= 8 || alpha <= 0.004) return;
        const lScale = Math.min(dw / layerCanvas.width, dh / layerCanvas.height);
        const lw = layerCanvas.width * lScale;
        const lh = layerCanvas.height * lScale;
        this.ctx.save();
        this.ctx.globalAlpha = alpha;
        this.ctx.drawImage(layerCanvas, (dw - lw) / 2, (dh - lh) / 2, lw, lh);
        this.ctx.restore();
      };

      const motionOverlay = overlay.motion;
      drawLayer(overlay.motionBackdrop);
      drawLayer(motionOverlay);

      if (motionOverlay?.letterbox) {
        const bar = Math.max(0, (1 - dw / dh / 2.39) / 2) * dh;
        if (bar > 0.5) {
          this.ctx.fillStyle = '#000000';
          this.ctx.fillRect(0, 0, dw, bar);
          this.ctx.fillRect(0, dh - bar, dw, bar);
        }
      }

      if (overlay.watermark) {
        this.ctx.font = 'bold 14px system-ui, sans-serif';
        this.ctx.fillStyle = 'rgba(245, 158, 11, 0.75)';
        this.ctx.textAlign = 'right';
        this.ctx.fillText('REGAL PRISM', dw - 16, dh - 16);
      }

      const pips = overlay.pipOverlays ?? [];
      const pipW = dw * 0.22;
      const pipH = pipW * (9 / 16);
      const margin = 16;
      for (const pip of pips) {
        if (pip.canvas.width < 2) continue;
        let px = margin;
        let py = margin;
        if (pip.corner.includes('right')) px = dw - pipW - margin;
        if (pip.corner.includes('bottom')) py = dh - pipH - margin;

        this.ctx.fillStyle = 'rgba(0,0,0,0.85)';
        this.ctx.fillRect(px - 2, py - 2, pipW + 4, pipH + 4);
        this.ctx.drawImage(pip.canvas, px, py, pipW, pipH);
        if (pip.label) {
          this.ctx.fillStyle = 'rgba(245,158,11,0.9)';
          this.ctx.font = 'bold 9px system-ui,sans-serif';
          this.ctx.textAlign = 'left';
          this.ctx.fillText(pip.label, px + 4, py + pipH - 6);
        }
      }

      this.raf = requestAnimationFrame(paint);
    };

    this.raf = requestAnimationFrame(paint);
    return stream;
  }

  stop() {
    this.stopping = true;
    cancelAnimationFrame(this.raf);
    this.source = null;
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
}
