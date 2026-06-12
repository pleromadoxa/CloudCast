import type { LayerStackId } from '../types/graphicsStack';
import type { LayerSettings } from '../types/mixer';

const Z_BASE = 10;

/** Default stack: first entry = front (highest z). */
export function buildDefaultGraphicsStackOrder(layers: LayerSettings): LayerStackId[] {
  const imageIds = layers.imageOverlays.map((o) => `image:${o.id}` as LayerStackId);
  return [
    'transition',
    'breaking',
    'live-button',
    'lower-third',
    ...imageIds,
    'logo',
    'crawler',
    'chroma',
  ];
}

const CORE_STACK_IDS: LayerStackId[] = ['transition', 'chroma'];

function validStackIds(layers: LayerSettings): Set<LayerStackId> {
  const imageIds = layers.imageOverlays.map((o) => `image:${o.id}` as LayerStackId);
  return new Set<LayerStackId>([
    'transition',
    'breaking',
    'live-button',
    'lower-third',
    'logo',
    'crawler',
    'chroma',
    ...imageIds,
  ]);
}

export function removeStackId(order: LayerStackId[], id: LayerStackId): LayerStackId[] {
  return order.filter((entry) => entry !== id);
}

/** Preserve user-removed layers; only auto-append core system layers and new image overlays. */
export function normalizeGraphicsStackOrder(
  order: LayerStackId[] | undefined,
  layers: LayerSettings,
): LayerStackId[] {
  const valid = validStackIds(layers);
  const imageIds = layers.imageOverlays.map((o) => `image:${o.id}` as LayerStackId);
  const baseOrder = order?.length ? order : buildDefaultGraphicsStackOrder(layers);

  const seen = new Set<LayerStackId>();
  const result: LayerStackId[] = [];

  for (const id of baseOrder) {
    if (valid.has(id) && !seen.has(id)) {
      result.push(id);
      seen.add(id);
    }
  }

  for (const id of CORE_STACK_IDS) {
    if (!seen.has(id)) {
      result.push(id);
      seen.add(id);
    }
  }

  for (const id of imageIds) {
    if (!seen.has(id)) {
      const logoIdx = result.indexOf('logo');
      const insertAt = logoIdx >= 0 ? logoIdx : Math.max(result.length - 1, 0);
      result.splice(insertAt, 0, id);
      seen.add(id);
    }
  }

  return result;
}

export function zIndexForStackId(id: LayerStackId, order: LayerStackId[]): number {
  const idx = order.indexOf(id);
  if (idx < 0) return Z_BASE;
  return Z_BASE + (order.length - idx);
}

export function reorderStackOrder(
  order: LayerStackId[],
  fromIndex: number,
  toIndex: number,
): LayerStackId[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return order;
  const next = [...order];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function stackOrderForDisplay(order: LayerStackId[]): LayerStackId[] {
  return [...order];
}
