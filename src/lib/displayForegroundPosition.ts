import type { DisplaySlide } from '../types/displayFeed';

export const FOREGROUND_POSITION_PRESETS: Record<
  NonNullable<DisplaySlide['foregroundPosition']>,
  { x: number; y: number; label: string }
> = {
  center: { x: 50, y: 50, label: 'Center' },
  top: { x: 50, y: 18, label: 'Top' },
  bottom: { x: 50, y: 82, label: 'Bottom' },
  'lower-third': { x: 50, y: 82, label: 'Lower third' },
  left: { x: 18, y: 50, label: 'Left' },
  right: { x: 82, y: 50, label: 'Right' },
};

export function resolveForegroundPlacement(slide: DisplaySlide): { x: number; y: number } {
  if (slide.foregroundX != null && slide.foregroundY != null) {
    return {
      x: Math.max(0, Math.min(100, slide.foregroundX)),
      y: Math.max(0, Math.min(100, slide.foregroundY)),
    };
  }
  const preset = FOREGROUND_POSITION_PRESETS[slide.foregroundPosition ?? 'center'];
  return { x: preset.x, y: preset.y };
}
