import type { LayerSettings } from '../types/mixer';
import {
  DEFAULT_AD_ZONE,
  DEFAULT_BREAKING,
  DEFAULT_COUNTDOWN,
  DEFAULT_CRAWLER,
  DEFAULT_LIVE_BUTTON,
  DEFAULT_LOWER_THIRD_CUSTOMIZATION,
  DEFAULT_PROGRAM_LOGO,
  DEFAULT_SCOREBOARD,
  DEFAULT_SPONSOR_BUG,
  DEFAULT_TRANSITION,
  DEFAULT_WEATHER,
  resolveAdZoneSettings,
  resolveCountdownSettings,
  resolveCrawlerSettings,
  resolveScoreboardSettings,
  resolveSponsorBugSettings,
  resolveTransitionGraphic,
  resolveWeatherSettings,
} from '../types/overlays';
import type { LayerStackId } from '../types/graphicsStack';
import { normalizeGraphicsStackOrder } from './graphicsStackOrder';
import { seedFirstTimeLiveButton } from './liveButtonSeed';

const DEFAULT_GRAPHICS_STACK_ORDER: LayerStackId[] = [
  'transition',
  'breaking',
  'live-button',
  'lower-third',
  'weather',
  'scoreboard',
  'ad-zone',
  'sponsor-bug',
  'countdown',
  'logo',
  'crawler',
  'chroma',
];
import { DEFAULT_LOWER_THIRD_TEMPLATE, resolveLowerThirdCustomization } from './lowerThirdTemplates';

const LAYER_DEFAULTS: LayerSettings = {
  globalOverlay: 'none',
  overlays: {},
  lowerThirdText: '',
  lowerThirdSubtext: '',
  lowerThirdTemplate: DEFAULT_LOWER_THIRD_TEMPLATE,
  lowerThirdCustomization: { ...DEFAULT_LOWER_THIRD_CUSTOMIZATION },
  lowerThirdPresetId: null,
  showLowerThird: false,
  logoText: 'CLOUDCAST',
  showLogo: false,
  programLogo: { ...DEFAULT_PROGRAM_LOGO },
  showCrawler: false,
  crawler: { ...DEFAULT_CRAWLER },
  showBreakingNews: false,
  breakingNews: { ...DEFAULT_BREAKING },
  showLiveButton: false,
  liveButton: { ...DEFAULT_LIVE_BUTTON },
  weather: { ...DEFAULT_WEATHER },
  showWeather: false,
  adZone: { ...DEFAULT_AD_ZONE },
  showAdZone: false,
  scoreboard: { ...DEFAULT_SCOREBOARD },
  showScoreboard: false,
  countdown: { ...DEFAULT_COUNTDOWN },
  showCountdown: false,
  sponsorBug: { ...DEFAULT_SPONSOR_BUG },
  showSponsorBug: false,
  transitionGraphic: { ...DEFAULT_TRANSITION },
  showSafeZone: false,
  showCrosshair: false,
  imageOverlays: [],
  videoOverlays: [],
  mediaLibrary: [],
  graphicsStackOrder: DEFAULT_GRAPHICS_STACK_ORDER,
};

/** Ensures nested graphics settings always exist — prevents blank-screen crashes on tab switch. */
export function normalizeLayerSettings(input?: Partial<LayerSettings>): LayerSettings {
  const partial = input ?? {};
  return {
    ...LAYER_DEFAULTS,
    ...partial,
    overlays: { ...LAYER_DEFAULTS.overlays, ...partial.overlays },
    programLogo: { ...DEFAULT_PROGRAM_LOGO, ...partial.programLogo },
    crawler: resolveCrawlerSettings(partial.crawler),
    breakingNews: { ...DEFAULT_BREAKING, ...partial.breakingNews },
    liveButton: { ...DEFAULT_LIVE_BUTTON, ...partial.liveButton },
    weather: resolveWeatherSettings(partial.weather),
    adZone: resolveAdZoneSettings(partial.adZone),
    scoreboard: resolveScoreboardSettings(partial.scoreboard),
    countdown: resolveCountdownSettings(partial.countdown),
    sponsorBug: resolveSponsorBugSettings(partial.sponsorBug),
    transitionGraphic: resolveTransitionGraphic(partial.transitionGraphic),
    lowerThirdCustomization: resolveLowerThirdCustomization(
      partial.lowerThirdTemplate ?? LAYER_DEFAULTS.lowerThirdTemplate,
      partial.lowerThirdCustomization,
    ),
    imageOverlays: (partial.imageOverlays ?? LAYER_DEFAULTS.imageOverlays).map((o) => ({
      ...o,
      liveOnPgm: o.liveOnPgm ?? false,
      fillScreen: o.fillScreen ?? false,
    })),
    videoOverlays: (partial.videoOverlays ?? LAYER_DEFAULTS.videoOverlays).map((o) => ({
      ...o,
      liveOnPgm: o.liveOnPgm ?? false,
      fillScreen: o.fillScreen ?? false,
      loop: o.loop ?? true,
      muted: o.muted ?? true,
    })),
    mediaLibrary: (partial.mediaLibrary ?? LAYER_DEFAULTS.mediaLibrary).map((item) => ({
      ...item,
      playUrl: item.playUrl || item.dataUrl || item.thumbUrl || '',
    })),
    graphicsStackOrder: normalizeGraphicsStackOrder(
      partial.graphicsStackOrder ?? LAYER_DEFAULTS.graphicsStackOrder,
      {
        ...LAYER_DEFAULTS,
        ...partial,
        imageOverlays: partial.imageOverlays ?? LAYER_DEFAULTS.imageOverlays,
        videoOverlays: partial.videoOverlays ?? LAYER_DEFAULTS.videoOverlays,
      } as LayerSettings,
    ),
  };
}

export function createEmptyLayerSettings(overrides?: Partial<LayerSettings>): LayerSettings {
  return normalizeLayerSettings(seedFirstTimeLiveButton(overrides ?? {}));
}

export function cloneLayerSettings(l: LayerSettings): LayerSettings {
  return normalizeLayerSettings({
    ...l,
    overlays: { ...l.overlays },
    programLogo: { ...l.programLogo },
    crawler: { ...l.crawler },
    breakingNews: { ...l.breakingNews },
    weather: { ...l.weather },
    adZone: { ...l.adZone },
    scoreboard: { ...l.scoreboard },
    countdown: { ...l.countdown },
    sponsorBug: { ...l.sponsorBug },
    transitionGraphic: { ...l.transitionGraphic },
    imageOverlays: l.imageOverlays.map((o) => ({ ...o })),
    videoOverlays: l.videoOverlays.map((o) => ({ ...o })),
    mediaLibrary: l.mediaLibrary.map((m) => ({ ...m })),
    graphicsStackOrder: [...l.graphicsStackOrder],
  });
}

export function pickLowerThirdFields(l: LayerSettings): Partial<LayerSettings> {
  return {
    lowerThirdText: l.lowerThirdText,
    lowerThirdSubtext: l.lowerThirdSubtext,
    lowerThirdTemplate: l.lowerThirdTemplate,
    lowerThirdCustomization: { ...l.lowerThirdCustomization },
    lowerThirdPresetId: l.lowerThirdPresetId,
    showLowerThird: true,
  };
}

export function pickLogoFields(l: LayerSettings): Partial<LayerSettings> {
  return {
    programLogo: { ...l.programLogo },
    showLogo: true,
    logoText: l.programLogo.text,
  };
}

export function pickCrawlerFields(l: LayerSettings): Partial<LayerSettings> {
  return {
    crawler: { ...l.crawler },
    showCrawler: true,
  };
}

export function pickBreakingFields(l: LayerSettings): Partial<LayerSettings> {
  return {
    breakingNews: { ...l.breakingNews },
    showBreakingNews: true,
  };
}

export function pickLiveButtonFields(l: LayerSettings): Partial<LayerSettings> {
  return {
    liveButton: { ...l.liveButton },
    showLiveButton: true,
  };
}

export function pickWeatherFields(l: LayerSettings): Partial<LayerSettings> {
  return {
    weather: resolveWeatherSettings(l.weather),
    showWeather: true,
  };
}

export function pickAdZoneFields(l: LayerSettings): Partial<LayerSettings> {
  return {
    adZone: resolveAdZoneSettings(l.adZone),
    showAdZone: true,
  };
}

export function pickScoreboardFields(l: LayerSettings): Partial<LayerSettings> {
  return {
    scoreboard: resolveScoreboardSettings(l.scoreboard),
    showScoreboard: true,
  };
}

export function pickCountdownFields(l: LayerSettings): Partial<LayerSettings> {
  return {
    countdown: resolveCountdownSettings(l.countdown),
    showCountdown: true,
  };
}

export function pickSponsorBugFields(l: LayerSettings): Partial<LayerSettings> {
  return {
    sponsorBug: resolveSponsorBugSettings(l.sponsorBug),
    showSponsorBug: true,
  };
}

export function pickGraphicsLayoutFields(l: LayerSettings): Partial<LayerSettings> {
  return {
    graphicsStackOrder: [...l.graphicsStackOrder],
  };
}

export function hasLivePgmGraphics(pgm: LayerSettings): boolean {
  return (
    pgm.showLowerThird ||
    pgm.showLogo ||
    pgm.showCrawler ||
    pgm.showBreakingNews ||
    pgm.showLiveButton ||
    pgm.showWeather ||
    pgm.showAdZone ||
    pgm.showScoreboard ||
    pgm.showCountdown ||
    pgm.showSponsorBug ||
    pgm.imageOverlays.length > 0 ||
    pgm.videoOverlays.length > 0 ||
    pgm.transitionGraphic.firing
  );
}

/** Keep PGM graphics aligned with PST draft — position, content, and z-order. */
export function syncLivePgmGraphics(draft: LayerSettings, pgm: LayerSettings): LayerSettings {
  const next = cloneLayerSettings(pgm);
  next.graphicsStackOrder = [...draft.graphicsStackOrder];

  if (next.showLowerThird) {
    Object.assign(next, pickLowerThirdFields(draft));
  }
  if (next.showLogo) {
    Object.assign(next, pickLogoFields(draft));
  }
  if (next.showCrawler) {
    Object.assign(next, pickCrawlerFields(draft));
  }
  if (next.showBreakingNews) {
    Object.assign(next, pickBreakingFields(draft));
  }
  if (next.showLiveButton) {
    Object.assign(next, pickLiveButtonFields(draft));
  }
  if (next.showWeather) {
    Object.assign(next, pickWeatherFields(draft));
  }
  if (next.showAdZone) {
    Object.assign(next, pickAdZoneFields(draft));
  }
  if (next.showScoreboard) {
    Object.assign(next, pickScoreboardFields(draft));
  }
  if (next.showCountdown) {
    Object.assign(next, pickCountdownFields(draft));
  }
  if (next.showSponsorBug) {
    Object.assign(next, pickSponsorBugFields(draft));
  }

  const liveImages = draft.imageOverlays
    .filter((o) => o.liveOnPgm)
    .map((o) => ({ ...o, visible: true }));
  next.imageOverlays = liveImages;

  const liveVideos = draft.videoOverlays
    .filter((o) => o.liveOnPgm)
    .map((o) => ({ ...o, visible: true }));
  next.videoOverlays = liveVideos;

  return normalizeLayerSettings(next);
}
