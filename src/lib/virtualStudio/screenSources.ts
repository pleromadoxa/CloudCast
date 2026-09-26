import type { StudioGraphicContent, StudioScreenForm, StudioScreenSource, StudioSceneSettings } from './types';

/**
 * Pure helpers for resolving what ends up on a virtual studio screen.
 * Kept free of three.js so the routing logic is unit-testable.
 */

let graphicSeq = 0;

export function graphicContentId(content: StudioGraphicContent): string {
  return `g:${content.style}:${content.text ?? ''}:${content.subtext ?? ''}:${content.detail ?? ''}:${content.background ?? ''}:${content.accent ?? ''}`;
}

/**
 * Stable identity for a source. Used as a React/texture cache key — two
 * sources with the same identity can share a texture.
 */
export function sourceIdentity(source: StudioScreenSource | undefined): string | null {
  if (!source) return null;
  switch (source.kind) {
    case 'live-video':
      return `v:${sourceIdentityOfVideo(source.video)}`;
    case 'image-url':
      return `i:${source.url}`;
    case 'video-url':
      return `u:${source.url}:${source.loop ? 'loop' : 'once'}`;
    case 'canvas':
      return `c:${identityOfObject(source.canvas)}`;
    case 'graphic':
      return graphicContentId(source.content);
    case 'off':
      return null;
  }
}

function sourceIdentityOfVideo(video: HTMLVideoElement): string {
  const src = video.getAttribute?.('src') ?? '';
  const id = identityOfObject(video);
  return src ? `${id}|${src}` : id;
}

const objectIds = new WeakMap<object, string>();
let objectSeq = 0;

function identityOfObject(obj: object): string {
  let id = objectIds.get(obj);
  if (!id) {
    objectSeq += 1;
    id = `o${objectSeq}`;
    objectIds.set(obj, id);
  }
  return id;
}

/** True when the source actually paints pixels (i.e. counts as "on air"). */
export function isSourceActive(source: StudioScreenSource | undefined): boolean {
  if (!source) return false;
  switch (source.kind) {
    case 'live-video':
      return source.video.readyState >= 2;
    case 'image-url':
      return source.url.trim().length > 0;
    case 'video-url':
      return source.url.trim().length > 0;
    case 'canvas':
      return source.canvas.width > 0 && source.canvas.height > 0;
    case 'graphic':
      return true;
    case 'off':
      return false;
  }
}

export function sourcesEqual(
  a: StudioScreenSource | undefined,
  b: StudioScreenSource | undefined,
): boolean {
  return sourceIdentity(a) === sourceIdentity(b);
}

/**
 * Resolve the effective source for a slot: operator binding wins, then the
 * scene's built-in default, then "off".
 */
export function resolveSlotSource(
  settings: Pick<StudioSceneSettings, 'sources'> | undefined,
  slotId: string,
  defaultSource: StudioScreenSource | undefined,
): StudioScreenSource {
  const bound = settings?.sources?.[slotId];
  return bound ?? defaultSource ?? { kind: 'off' };
}

/** True when any screen in the scene is painting. */
export function hasActiveScreen(
  sources: Record<string, StudioScreenSource | undefined>,
): boolean {
  return Object.values(sources).some((source) => isSourceActive(source));
}

/** Clamp operator-facing numeric settings into safe broadcast ranges. */
export function clampSceneSettings(settings: StudioSceneSettings): StudioSceneSettings {
  const lighting = settings.lighting === undefined ? 1 : Math.min(1.6, Math.max(0.6, settings.lighting));
  const tickerSpeed =
    settings.tickerSpeed === undefined ? 120 : Math.min(600, Math.max(0, settings.tickerSpeed));
  return { ...settings, lighting, tickerSpeed };
}

/** Suggested texture resolution for a screen so 4K walls don't over-allocate. */
export function suggestedTextureSize(
  form: StudioScreenForm,
  /**
   * Physical surface aspect (width/height). When given, the allocation keeps
   * the form's pixel budget but matches the surface aspect so procedural
   * graphics aren't stretched across curved walls and wide backdrops.
   */
  aspect?: number,
): { width: number; height: number } {
  const base = (() => {
    switch (form) {
      case 'video-wall':
        return { width: 1920, height: 1080 };
      case 'television':
        return { width: 1280, height: 720 };
      case 'window':
        return { width: 1600, height: 900 };
      case 'ribbon':
        return { width: 2048, height: 128 };
      case 'banner':
        return { width: 1024, height: 512 };
      case 'monitor':
      default:
        return { width: 1024, height: 576 };
    }
  })();
  if (!aspect || !Number.isFinite(aspect) || aspect <= 0) return base;
  const budget = base.width * base.height;
  const width = Math.min(4096, Math.max(256, Math.round(Math.sqrt(budget * aspect))));
  const height = Math.min(4096, Math.max(96, Math.round(width / aspect)));
  return { width, height };
}

/** Monotonic counter used to stamp generated graphic canvases. */
export function nextGraphicSeq(): number {
  graphicSeq += 1;
  return graphicSeq;
}

/**
 * Serializable projection of a source for cloud scene storage. Live video
 * elements and canvases are session-bound, so they degrade to `null` (the
 * caller keeps the binding out of the payload).
 */
export function serializeScreenSource(
  source: StudioScreenSource | undefined,
): StudioScreenSource | null {
  if (!source) return null;
  switch (source.kind) {
    case 'image-url':
    case 'video-url':
    case 'graphic':
      return source;
    case 'off':
      return source;
    case 'live-video':
    case 'canvas':
      return null;
  }
}

/** Serializable projection of a whole binding map (nulls dropped). */
export function serializeBindings(
  bindings: Record<string, StudioScreenSource> | undefined,
): Record<string, StudioScreenSource> {
  const out: Record<string, StudioScreenSource> = {};
  for (const [slotId, source] of Object.entries(bindings ?? {})) {
    const serializable = serializeScreenSource(source);
    if (serializable) out[slotId] = serializable;
  }
  return out;
}

/** Rehydrate bindings loaded from storage (shape is already plain objects). */
export function deserializeBindings(
  raw: Record<string, StudioScreenSource> | undefined,
): Record<string, StudioScreenSource> {
  const out: Record<string, StudioScreenSource> = {};
  for (const [slotId, source] of Object.entries(raw ?? {})) {
    if (source && typeof source === 'object' && 'kind' in source) out[slotId] = source;
  }
  return out;
}
