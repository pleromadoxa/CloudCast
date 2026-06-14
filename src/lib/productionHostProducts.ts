import type { CloudCastProductId } from '../types/products';

/** Product dashboards rendered by ProductionHost — route pages are auth gates only. */
export const PRODUCTION_HOST_PRODUCTS = new Set<CloudCastProductId>([
  'video_mixer',
  'audio_mixer',
  'instant_replay',
  'regal_display',
  'regal_prism',
]);

export function isProductionHostProduct(product: CloudCastProductId): boolean {
  return PRODUCTION_HOST_PRODUCTS.has(product);
}
