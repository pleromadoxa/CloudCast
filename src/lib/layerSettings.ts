import type { LayerSettings } from '../types/mixer';
import {
  DEFAULT_BREAKING,
  DEFAULT_CRAWLER,
  DEFAULT_LIVE_BUTTON,
  DEFAULT_LOWER_THIRD_CUSTOMIZATION,
  DEFAULT_PROGRAM_LOGO,
  DEFAULT_TRANSITION,
  resolveTransitionGraphic,
} from '../types/overlays';
import type { LayerStackId } from '../types/graphicsStack';
import { normalizeGraphicsStackOrder } from './graphicsStackOrder';
import { seedFirstTimeLiveButton } from './liveButtonSeed';

const DEFAULT_GRAPHICS_STACK_ORDER: LayerStackId[] = [
  'transition',
  'breaking',
  'live-button',
  'lower-third',
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
  transitionGraphic: { ...DEFAULT_TRANSITION },
  showSafeZone: false,
  showCrosshair: false,
  imageOverlays: [],
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
    crawler: { ...DEFAULT_CRAWLER, ...partial.crawler },
    breakingNews: { ...DEFAULT_BREAKING, ...partial.breakingNews },
    liveButton: { ...DEFAULT_LIVE_BUTTON, ...partial.liveButton },
    transitionGraphic: resolveTransitionGraphic(partial.transitionGraphic),
    lowerThirdCustomization: resolveLowerThirdCustomization(
      partial.lowerThirdTemplate ?? LAYER_DEFAULTS.lowerThirdTemplate,
      partial.lowerThirdCustomization,
    ),
    imageOverlays: (partial.imageOverlays ?? LAYER_DEFAULTS.imageOverlays).map((o) => ({
      ...o,
      liveOnPgm: o.liveOnPgm ?? false,
    })),
    graphicsStackOrder: normalizeGraphicsStackOrder(
      partial.graphicsStackOrder ?? LAYER_DEFAULTS.graphicsStackOrder,
      {
        ...LAYER_DEFAULTS,
        ...partial,
        imageOverlays: partial.imageOverlays ?? LAYER_DEFAULTS.imageOverlays,
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
    transitionGraphic: { ...l.transitionGraphic },
    imageOverlays: l.imageOverlays.map((o) => ({ ...o })),
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
    pgm.imageOverlays.length > 0 ||
    pgm.transitionGraphic.firing
  );
}

/** Keep PGM graphics aligned with PST draft — position, content, and z-order. */
export function syncLivePgmGraphics(draft: LayerSettings, pgm: LayerSettings): LayerSettings {
  let next = cloneLayerSettings(pgm);
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

  const liveImages = draft.imageOverlays
    .filter((o) => o.liveOnPgm)
    .map((o) => ({ ...o, visible: true }));
  next.imageOverlays = liveImages;

  return normalizeLayerSettings(next);
}
