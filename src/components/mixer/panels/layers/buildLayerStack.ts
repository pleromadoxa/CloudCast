import type { LayerSettings } from '../../../../types/mixer';
import type { LayerStackId } from '../../../../types/graphicsStack';
import { zIndexForStackId } from '../../../../lib/graphicsStackOrder';
import type { LayerStackItem } from './layerStackTypes';

const ITEM_DEFS: Record<
  Exclude<LayerStackId, `image:${string}` | `video:${string}`>,
  Omit<LayerStackItem, 'id' | 'zIndex' | 'isPreview' | 'isLive' | 'sublabel'> & {
    sublabel: (layers: LayerSettings) => string;
    isPreview: (layers: LayerSettings) => boolean;
    isLive: (layers: LayerSettings, pgm: LayerSettings) => boolean;
  }
> = {
  transition: {
    label: 'Transition Stinger',
    sublabel: (l) => l.transitionGraphic.title || l.transitionGraphic.headline || 'One-shot fullscreen',
    isPreview: (l) => l.transitionGraphic.firing,
    isLive: (l, p) => l.transitionGraphic.firing || p.transitionGraphic.firing,
    canPreview: false,
    canGoLive: false,
    canDelete: false,
    canReorder: false,
  },
  breaking: {
    label: 'Breaking Banner',
    sublabel: (l) => l.breakingNews.headline || 'Top banner',
    isPreview: (l) => l.showBreakingNews,
    isLive: (_, p) => p.showBreakingNews,
    canPreview: true,
    canGoLive: true,
    canDelete: true,
    canReorder: true,
  },
  'live-button': {
    label: 'Live Button',
    sublabel: (l) => l.liveButton.label || 'ON AIR badge',
    isPreview: (l) => l.showLiveButton,
    isLive: (_, p) => p.showLiveButton,
    canPreview: true,
    canGoLive: true,
    canDelete: true,
    canReorder: true,
  },
  'lower-third': {
    label: 'Lower Third',
    sublabel: (l) => l.lowerThirdText || 'Title / subtitle',
    isPreview: (l) => l.showLowerThird,
    isLive: (_, p) => p.showLowerThird,
    canPreview: true,
    canGoLive: true,
    canDelete: true,
    canReorder: true,
  },
  weather: {
    label: 'Weather Panel',
    sublabel: (l) => `${l.weather.location || 'Weather'} · ${Math.round(l.weather.temperature)}°${l.weather.unit}`,
    isPreview: (l) => l.showWeather,
    isLive: (_, p) => p.showWeather,
    canPreview: true,
    canGoLive: true,
    canDelete: true,
    canReorder: true,
  },
  scoreboard: {
    label: 'Scoreboard',
    sublabel: (l) => `${l.scoreboard.home.name} ${l.scoreboard.home.score} – ${l.scoreboard.away.score} ${l.scoreboard.away.name}`,
    isPreview: (l) => l.showScoreboard,
    isLive: (_, p) => p.showScoreboard,
    canPreview: true,
    canGoLive: true,
    canDelete: true,
    canReorder: true,
  },
  'ad-zone': {
    label: 'Ad Zone',
    sublabel: (l) => `${l.adZone.adName} · ${l.adZone.sourceKind.replace('-', ' ')}`,
    isPreview: (l) => l.showAdZone,
    isLive: (_, p) => p.showAdZone,
    canPreview: true,
    canGoLive: true,
    canDelete: true,
    canReorder: true,
  },
  'sponsor-bug': {
    label: 'Sponsor Bug',
    sublabel: (l) =>
      l.sponsorBug.entries.length
        ? `${l.sponsorBug.entries.length} sponsor${l.sponsorBug.entries.length > 1 ? 's' : ''}`
        : 'Rotating corner logo',
    isPreview: (l) => l.showSponsorBug,
    isLive: (_, p) => p.showSponsorBug,
    canPreview: true,
    canGoLive: true,
    canDelete: true,
    canReorder: true,
  },
  countdown: {
    label: 'Countdown',
    sublabel: (l) => `${l.countdown.title || 'Clock'} · ${l.countdown.mode.replace('-', ' ')}`,
    isPreview: (l) => l.showCountdown,
    isLive: (_, p) => p.showCountdown,
    canPreview: true,
    canGoLive: true,
    canDelete: true,
    canReorder: true,
  },
  logo: {
    label: 'Program Logo',
    sublabel: (l) => (l.programLogo.mode === 'image' ? 'PNG logo' : l.programLogo.text),
    isPreview: (l) => l.showLogo,
    isLive: (_, p) => p.showLogo,
    canPreview: true,
    canGoLive: true,
    canDelete: true,
    canReorder: true,
  },
  crawler: {
    label: 'News Crawler',
    sublabel: (l) => l.crawler.text.slice(0, 40) || 'Ticker text',
    isPreview: (l) => l.showCrawler,
    isLive: (_, p) => p.showCrawler,
    canPreview: true,
    canGoLive: true,
    canDelete: true,
    canReorder: true,
  },
  chroma: {
    label: 'KEY',
    sublabel: () => 'Chroma / Luma',
    isPreview: () => false,
    isLive: () => false,
    canPreview: false,
    canGoLive: false,
    canDelete: false,
    canReorder: false,
  },
};

export function buildLayerStack(layers: LayerSettings, pgmLayers: LayerSettings): LayerStackItem[] {
  const order = layers.graphicsStackOrder;
  const items: LayerStackItem[] = [];

  for (const id of order) {
    if (id.startsWith('image:')) {
      const imgId = id.slice(6);
      const o = layers.imageOverlays.find((x) => x.id === imgId);
      if (!o) continue;
      items.push({
        id,
        zIndex: zIndexForStackId(id, order),
        label: `Image · ${o.name}`,
        sublabel: o.fillScreen ? 'Full screen' : o.position.replace('-', ' '),
        isPreview: o.visible,
        isLive: o.liveOnPgm,
        canPreview: true,
        canGoLive: true,
        canDelete: true,
        canReorder: true,
      });
      continue;
    }

    if (id.startsWith('video:')) {
      const vidId = id.slice(6);
      const v = layers.videoOverlays.find((x) => x.id === vidId);
      if (!v) continue;
      items.push({
        id,
        zIndex: zIndexForStackId(id, order),
        label: `Video · ${v.name}`,
        sublabel: v.fillScreen ? 'Full screen' : v.position.replace('-', ' '),
        isPreview: v.visible,
        isLive: v.liveOnPgm,
        canPreview: true,
        canGoLive: true,
        canDelete: true,
        canReorder: true,
      });
      continue;
    }

    const def = ITEM_DEFS[id as Exclude<LayerStackId, `image:${string}` | `video:${string}`>];
    if (!def) continue;

    items.push({
      id,
      zIndex: zIndexForStackId(id, order),
      label: def.label,
      sublabel: def.sublabel(layers),
      isPreview: def.isPreview(layers),
      isLive: def.isLive(layers, pgmLayers),
      canPreview: def.canPreview,
      canGoLive: def.canGoLive,
      canDelete: def.canDelete,
      canReorder: def.canReorder,
    });
  }

  return items;
}
