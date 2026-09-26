import type { CloudCastProductId } from '../types/products';
import regalPrismHeroVideo from '../assets/video/regal-prism-hero.mp4';
import regalPrismHeroPoster from '../assets/video/regal-prism-hero-poster.jpg';

/**
 * Immersive background video for a product landing hero.
 * The video is decorative ambience — always muted, looping, and blended into
 * the dark marketing theme beneath the readable foreground content.
 */
export interface ProductHeroMedia {
  /** MP4 (H.264) source — universally supported, used as the primary source. */
  videoSrc: string;
  /** Poster shown instantly (and when motion is reduced / video is paused). */
  posterSrc: string;
  /** CSS `mix-blend-mode` used to fuse the video into the dark page background. */
  blendMode: 'screen' | 'overlay' | 'soft-light' | 'luminosity' | 'normal';
  /** Overall video layer opacity after blending (0–1). */
  opacity: number;
  /** CSS `filter` applied to the clip (e.g. darkening) so copy stays readable. */
  filter: string;
  /** Documents intent — the video layer itself is `aria-hidden`. */
  label: string;
}

/** Per-product hero ambience. Products without an entry get the plain gradient hero. */
export const PRODUCT_HERO_MEDIA: Partial<Record<CloudCastProductId, ProductHeroMedia>> = {
  regal_prism: {
    videoSrc: regalPrismHeroVideo,
    posterSrc: regalPrismHeroPoster,
    blendMode: 'normal',
    opacity: 0.9,
    filter: 'brightness(0.42) saturate(1.08) contrast(1.05)',
    label: 'Regal Prism virtual production studio ambience',
  },
};

export function productHeroMedia(productId: CloudCastProductId): ProductHeroMedia | null {
  return PRODUCT_HERO_MEDIA[productId] ?? null;
}
