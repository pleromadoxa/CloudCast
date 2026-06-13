import type { DisplayTextSize } from '../types/displayFeed';

/** Fixed 16:9 design resolution for Regal Display slides. */
export const DISPLAY_CANVAS_WIDTH = 1920;
export const DISPLAY_CANVAS_HEIGHT = 1080;

/** Typography sizes tuned for the 1080p canvas (scale with the canvas transform). */
export const DISPLAY_TEXT_SIZE_PX: Record<DisplayTextSize, number> = {
  sm: 28,
  md: 42,
  lg: 58,
  xl: 80,
  '2xl': 100,
};

export const DISPLAY_SCRIPTURE_REFERENCE_PX = 48;
export const DISPLAY_SCRIPTURE_TEXT_PX = 64;
export const DISPLAY_SCRIPTURE_TRANSLATION_PX = 28;
