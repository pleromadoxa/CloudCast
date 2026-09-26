import type { LayerSettings } from '../types/mixer';
import { normalizeLayerSettings } from './layerSettings';
import { serializeMediaLibraryForStorage } from './mixerMediaService';

const STORAGE_KEY = 'cloudcast-overlay-layers';

type StoredLayers = Pick<
  LayerSettings,
  | 'imageOverlays'
  | 'videoOverlays'
  | 'mediaLibrary'
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
  | 'weather'
  | 'showWeather'
  | 'adZone'
  | 'showAdZone'
  | 'scoreboard'
  | 'showScoreboard'
  | 'countdown'
  | 'showCountdown'
  | 'sponsorBug'
  | 'showSponsorBug'
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
        videoOverlays: layers.videoOverlays.slice(0, 4),
        mediaLibrary: serializeMediaLibraryForStorage(layers.mediaLibrary).slice(0, 12),
        lowerThirdTemplate: layers.lowerThirdTemplate,
        lowerThirdCustomization: layers.lowerThirdCustomization,
        lowerThirdPresetId: layers.lowerThirdPresetId,
        lowerThirdText: layers.lowerThirdText,
        lowerThirdSubtext: layers.lowerThirdSubtext,
        showLowerThird: layers.showLowerThird,
        programLogo: layers.programLogo,
        crawler: { ...layers.crawler, lines: layers.crawler.lines.slice(0, 4) },
        breakingNews: layers.breakingNews,
        showLiveButton: layers.showLiveButton,
        liveButton: layers.liveButton,
        weather: { ...layers.weather, forecast: layers.weather.forecast.slice(0, 7) },
        showWeather: layers.showWeather,
        adZone: { ...layers.adZone, carousel: layers.adZone.carousel.slice(0, 6) },
        showAdZone: layers.showAdZone,
        scoreboard: layers.scoreboard,
        showScoreboard: layers.showScoreboard,
        countdown: layers.countdown,
        showCountdown: layers.showCountdown,
        sponsorBug: { ...layers.sponsorBug, entries: layers.sponsorBug.entries.slice(0, 8) },
        showSponsorBug: layers.showSponsorBug,
        graphicsStackOrder: layers.graphicsStackOrder,
      }),
    );
  } catch {
    /* quota */
  }
}
