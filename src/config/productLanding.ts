import type { CloudCastProductId } from '../types/products';
import { PRODUCT_GUIDE_SECTIONS } from './productGuideContent';

/** URL slug → product id for SEO landing pages at /products/:slug */
export const PRODUCT_SLUGS: Record<string, CloudCastProductId> = {
  'video-mixer': 'video_mixer',
  'audio-mixer': 'audio_mixer',
  symphony: 'symphony_studio',
  replay: 'instant_replay',
  'regal-display': 'regal_display',
  'regal-prism': 'regal_prism',
};

export const PRODUCT_SLUG_BY_ID: Record<CloudCastProductId, string> = {
  video_mixer: 'video-mixer',
  audio_mixer: 'audio-mixer',
  symphony_studio: 'symphony',
  instant_replay: 'replay',
  regal_display: 'regal-display',
  regal_prism: 'regal-prism',
};

export function parseProductSlug(slug: string | undefined): CloudCastProductId | null {
  if (!slug) return null;
  return PRODUCT_SLUGS[slug] ?? null;
}

/** Long-tail search keywords per product — used in meta tags and landing copy. */
export const PRODUCT_SEO_KEYWORDS: Record<CloudCastProductId, string[]> = {
  video_mixer: [
    'browser video mixer',
    'online broadcast switcher',
    'PST PGM switcher',
    'multi-camera live stream',
    'YouTube live production',
    'Twitch stream switcher',
    'cloud video production',
    'RTMP live streaming',
    'chroma key live stream',
    'replace vMix OBS',
  ],
  audio_mixer: [
    'browser audio mixer',
    'online broadcast console',
    '16 channel audio mixer',
    'live event audio mixing',
    'church sound console',
    'StudioLive alternative',
    'digital audio console cloud',
  ],
  symphony_studio: [
    'online DAW',
    'browser music production',
    'cloud DAW',
    'web audio workstation',
    'online beat maker',
    'browser synthesizer',
    'music production in browser',
  ],
  instant_replay: [
    'instant replay software',
    'live sports replay',
    'rolling buffer replay',
    'slow motion replay live',
    'multi-angle instant replay',
    'broadcast replay system',
  ],
  regal_display: [
    'church presentation software',
    'worship lyrics display',
    'EasyWorship alternative',
    'scripture presentation',
    'ProPresenter alternative cloud',
    'worship slide software',
    'congregation display feed',
  ],
  regal_prism: [
    'virtual production software',
    'browser chroma key',
    'virtual set studio',
    'augmented reality broadcast',
    'Unreal Engine alternative browser',
    'VP studio cloud',
    'green screen virtual studio',
  ],
};

export function getProductGuideSection(productId: CloudCastProductId) {
  return PRODUCT_GUIDE_SECTIONS.find((s) => s.id === productId);
}

export function productLandingPath(productId: CloudCastProductId): string {
  return `/products/${PRODUCT_SLUG_BY_ID[productId]}`;
}
