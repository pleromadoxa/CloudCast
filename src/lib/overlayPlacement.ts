import type { LayerSettings } from '../types/mixer';
import type { LayerStackId } from '../types/graphicsStack';
import type { LowerThirdPosition, OverlayPosition } from '../types/overlays';

export interface OverlayPlacement {
  xPercent: number;
  yPercent: number;
}

export const PRESET_PLACEMENT: Record<OverlayPosition, OverlayPlacement> = {
  'top-left': { xPercent: 12, yPercent: 10 },
  'top-right': { xPercent: 88, yPercent: 10 },
  'bottom-left': { xPercent: 12, yPercent: 88 },
  'bottom-right': { xPercent: 88, yPercent: 88 },
  center: { xPercent: 50, yPercent: 50 },
};

export const LOWER_THIRD_X: Record<LowerThirdPosition, number> = {
  'bottom-left': 18,
  'bottom-center': 50,
  'bottom-right': 82,
};

export const LOWER_THIRD_Y = 92;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function resolveCornerPlacement(
  position: OverlayPosition,
  custom?: { xPercent?: number; yPercent?: number },
): OverlayPlacement {
  if (custom?.xPercent != null && custom?.yPercent != null) {
    return {
      xPercent: clamp(custom.xPercent, 3, 97),
      yPercent: clamp(custom.yPercent, 3, 97),
    };
  }
  return PRESET_PLACEMENT[position];
}

export function placementStyle(placement: OverlayPlacement): { left: string; top: string; transform: string } {
  return {
    left: `${placement.xPercent}%`,
    top: `${placement.yPercent}%`,
    transform: 'translate(-50%, -50%)',
  };
}

export function nearestCornerPreset(x: number, y: number): OverlayPosition {
  let best: OverlayPosition = 'top-left';
  let bestDist = Infinity;
  for (const [key, p] of Object.entries(PRESET_PLACEMENT) as [OverlayPosition, OverlayPlacement][]) {
    const dx = p.xPercent - x;
    const dy = p.yPercent - y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = key;
    }
  }
  return best;
}

export function xToLowerThirdPosition(x: number): LowerThirdPosition {
  if (x < 34) return 'bottom-left';
  if (x > 66) return 'bottom-right';
  return 'bottom-center';
}

export function resolveLowerThirdX(
  position: LowerThirdPosition,
  customX?: number,
): number {
  if (customX != null) return clamp(customX, 8, 92);
  return LOWER_THIRD_X[position];
}

export function isDraggableLayer(layerId: string): boolean {
  return (
    layerId === 'logo' ||
    layerId === 'lower-third' ||
    layerId === 'live-button' ||
    layerId.startsWith('image:')
  );
}

/** Whether a layer is actually rendered on the PST staging preview (matches VideoOverlay). */
export function isLayerVisibleOnStagingPreview(layerId: LayerStackId, gfx: LayerSettings): boolean {
  if (layerId === 'lower-third') return gfx.showLowerThird;
  if (layerId === 'logo') {
    if (!gfx.showLogo) return false;
    return gfx.programLogo.mode === 'image' ? Boolean(gfx.programLogo.imageDataUrl) : true;
  }
  if (layerId === 'live-button') return gfx.showLiveButton;
  if (layerId.startsWith('image:')) {
    const img = gfx.imageOverlays.find((o) => o.id === layerId.slice(6));
    return Boolean(img?.visible);
  }
  return false;
}
