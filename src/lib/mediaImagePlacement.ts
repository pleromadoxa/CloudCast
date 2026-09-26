import type { OverlayPosition } from '../types/overlays';

/** Reference production canvas — overlay % sizing is relative to this. */
export const CANVAS_REF_W = 1920;
export const CANVAS_REF_H = 1080;

export function loadImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Could not read image dimensions.'));
    img.src = src;
  });
}

/** True when the asset is intended to cover the full frame (slide / background). */
export function isFullFrameImage(naturalWidth: number, naturalHeight: number): boolean {
  if (naturalWidth <= 0 || naturalHeight <= 0) return false;
  const wRatio = naturalWidth / CANVAS_REF_W;
  const hRatio = naturalHeight / CANVAS_REF_H;
  if (wRatio >= 0.88 && hRatio >= 0.88) return true;
  if (naturalWidth >= 1600 && naturalHeight >= 900) return true;
  return false;
}

export function naturalWidthPercent(naturalWidth: number): number {
  const pct = Math.round((naturalWidth / CANVAS_REF_W) * 100);
  return Math.min(100, Math.max(5, pct));
}

export function naturalHeightPercent(naturalWidth: number, naturalHeight: number): number {
  const wPct = naturalWidthPercent(naturalWidth);
  const displayW = (wPct / 100) * CANVAS_REF_W;
  const displayH = displayW * (naturalHeight / naturalWidth);
  const hPct = Math.round((displayH / CANVAS_REF_H) * 100);
  return Math.min(100, Math.max(5, hPct));
}

export function inferDisplayForegroundSize(
  naturalWidth: number,
  naturalHeight: number,
): { widthPct: number; heightPct: number } {
  if (isFullFrameImage(naturalWidth, naturalHeight)) {
    return { widthPct: 100, heightPct: 100 };
  }
  return {
    widthPct: naturalWidthPercent(naturalWidth),
    heightPct: naturalHeightPercent(naturalWidth, naturalHeight),
  };
}

export interface ImageOverlayPlacementDefaults {
  fillScreen: boolean;
  scale: number;
  position: OverlayPosition;
  xPercent: number;
  yPercent: number;
}

export function inferImageOverlayDefaults(
  naturalWidth: number,
  naturalHeight: number,
): ImageOverlayPlacementDefaults {
  if (isFullFrameImage(naturalWidth, naturalHeight)) {
    return {
      fillScreen: true,
      scale: 100,
      position: 'center',
      xPercent: 50,
      yPercent: 50,
    };
  }
  return {
    fillScreen: false,
    scale: 100,
    position: 'center',
    xPercent: 50,
    yPercent: 50,
  };
}

export function overlayCanvasPercentSize(
  naturalWidth: number,
  naturalHeight: number,
  scalePercent: number,
): { widthPct: number; heightPct: number } {
  const factor = scalePercent / 100;
  return {
    widthPct: (naturalWidth / CANVAS_REF_W) * 100 * factor,
    heightPct: (naturalHeight / CANVAS_REF_H) * 100 * factor,
  };
}
