import type { LayerSettings } from '../types/mixer';
import { normalizeLayerSettings } from './layerSettings';

const STORAGE_KEY = 'cloudcast-overlay-layers';

type StoredLayers = Pick<
  LayerSettings,
  | 'imageOverlays'
  | 'lowerThirdTemplate'
  | 'lowerThirdCustomization'
  | 'lowerThirdPresetId'
  | 'lowerThirdText'
  | 'lowerThirdSubtext'
  | 'showLowerThird'
  | 'programLogo'
  | 'crawler'
  | 'breakingNews'
  | 'showLiveButton'
  | 'liveButton'
  | 'graphicsStackOrder'
>;

export function loadStoredOverlayLayers(): Partial<StoredLayers> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredLayers>;
    return normalizeLayerSettings(parsed);
  } catch {
    return null;
  }
}

export function saveOverlayLayers(layers: StoredLayers): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        imageOverlays: layers.imageOverlays.slice(0, 8),
        lowerThirdTemplate: layers.lowerThirdTemplate,
        lowerThirdCustomization: layers.lowerThirdCustomization,
        lowerThirdPresetId: layers.lowerThirdPresetId,
        lowerThirdText: layers.lowerThirdText,
        lowerThirdSubtext: layers.lowerThirdSubtext,
        showLowerThird: layers.showLowerThird,
        programLogo: layers.programLogo,
        crawler: layers.crawler,
        breakingNews: layers.breakingNews,
        showLiveButton: layers.showLiveButton,
        liveButton: layers.liveButton,
        graphicsStackOrder: layers.graphicsStackOrder,
      }),
    );
  } catch {
    /* quota */
  }
}
