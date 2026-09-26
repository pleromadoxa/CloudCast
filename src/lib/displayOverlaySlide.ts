import type { DisplayBackground, DisplaySlide } from '../types/displayFeed';
import { createEmptySlide, DEFAULT_DISPLAY_FIELDS } from '../types/displayFeed';
import { CHROMA_KEY_GREEN } from './chromaKeyColor';
import { resolveForegroundPlacement } from './displayForegroundPosition';

/** Chroma-key background — keyed out in the video mixer so cameras show through. */
export const CHROMA_DISPLAY_BACKGROUND: DisplayBackground = {
  kind: 'chroma',
  overlayOpacity: 0,
};

export function isOverlaySlide(slide: DisplaySlide | null | undefined): boolean {
  if (!slide) return false;
  return slide.type === 'overlay' || slide.background.kind === 'chroma';
}

/** Fill/congregation output — mixer-only overlay slides become hold. */
export function resolveCongregationSlide(slide: DisplaySlide | null | undefined): DisplaySlide | null {
  if (!slide || isOverlaySlide(slide)) return null;
  return slide;
}

export function createOverlaySlide(options?: {
  title?: string;
  imageUrl?: string;
  foregroundX?: number;
  foregroundY?: number;
  foregroundWidthPct?: number;
  foregroundHeightPct?: number;
}): DisplaySlide {
  return createEmptySlide({
    title: options?.title ?? 'Overlay',
    type: 'overlay',
    background: CHROMA_DISPLAY_BACKGROUND,
    layout: 'full',
    foregroundImageUrl: options?.imageUrl,
    foregroundX: options?.foregroundX ?? 50,
    foregroundY: options?.foregroundY ?? 50,
    foregroundWidthPct: options?.foregroundWidthPct,
    foregroundHeightPct: options?.foregroundHeightPct,
    fields: DEFAULT_DISPLAY_FIELDS.map((f, i) => ({
      ...f,
      id: `field-${i}`,
      visible: false,
      value: '',
    })),
  });
}

export function overlaySlideStyle(): { background: string } {
  return { background: CHROMA_KEY_GREEN };
}

/** Pixel box for foreground image on the 1920×1080 canvas. */
export function computeForegroundBox(
  slide: DisplaySlide,
  canvasW: number,
  canvasH: number,
  naturalW: number,
  naturalH: number,
): { x: number; y: number; w: number; h: number } {
  const placement = resolveForegroundPlacement(slide);
  const widthPct = slide.foregroundWidthPct ?? 100;
  const w = (widthPct / 100) * canvasW;
  const h = slide.foregroundHeightPct
    ? (slide.foregroundHeightPct / 100) * canvasH
    : w * (naturalH / naturalW);
  const x = (placement.x / 100) * canvasW - w / 2;
  const y = (placement.y / 100) * canvasH - h / 2;
  return { x, y, w, h };
}
