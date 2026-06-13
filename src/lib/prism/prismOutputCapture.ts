import type { PrismLowerThird } from '../../types/prismFeed';
import type { PipCorner } from '../../types/prismCameras';

export interface PrismPipOverlay {
  canvas: HTMLCanvasElement;
  corner: PipCorner;
  label?: string;
}

export interface PrismCaptureOverlay {
  watermark?: boolean;
  lowerThird?: PrismLowerThird | null;
  pipOverlays?: PrismPipOverlay[];
}

/** Captures a WebGL/Canvas element into a broadcast MediaStream. */
export class PrismOutputCapture {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private stopping = false;
  private source: HTMLCanvasElement | null = null;
  private getOverlay: () => PrismCaptureOverlay = () => ({});

  constructor(width = 1280, height = 720) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d')!;
  }

  start(
    source: HTMLCanvasElement,
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
      const sw = this.source.width;
      const sh = this.source.height;
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
