import type { VideoAspectRatio } from '../types/mixer';

/** CSS aspect-ratio values for video frames */
export const ASPECT_RATIO_CSS: Record<VideoAspectRatio, string> = {
  '16:9': '16 / 9',
  '9:16': '9 / 16',
  '4:3': '4 / 3',
  '1:1': '1 / 1',
};

export const ASPECT_RATIO_LABELS: Record<VideoAspectRatio, string> = {
  '16:9': 'Landscape 16:9',
  '9:16': 'Portrait 9:16',
  '4:3': 'Standard 4:3',
  '1:1': 'Square 1:1',
};

export function isLandscape(ratio: VideoAspectRatio): boolean {
  return ratio === '16:9' || ratio === '4:3';
}
