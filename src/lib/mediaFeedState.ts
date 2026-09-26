import type { LayerSettings } from '../types/mixer';
import type { LayerStackId } from '../types/graphicsStack';
import type { ActiveMediaFeed } from '../types/mediaFeed';
import type { MediaLibraryItem } from '../types/overlays';
import { resolveMediaPlayUrl } from '../types/overlays';

/** Prefer Regal Cloud library URLs over stale/revoked blob overlay URLs. */
export function resolveClipPlayUrl(
  overlayUrl: string | undefined,
  library: Pick<MediaLibraryItem, 'playUrl' | 'thumbUrl' | 'dataUrl' | 'storagePath'> | undefined,
): string {
  const fromLibrary = library ? resolveMediaPlayUrl(library) : '';
  const fromOverlay = overlayUrl?.trim() ?? '';
  if (fromLibrary && (!fromOverlay || fromOverlay.startsWith('blob:'))) {
    return fromLibrary;
  }
  return fromOverlay || fromLibrary;
}

function mediaFromLibrary(
  layers: LayerSettings,
  id: string,
  kind: 'image' | 'video',
  liveOnPgm: boolean,
): ActiveMediaFeed | null {
  const library = layers.mediaLibrary.find((m) => m.id === id);
  if (!library || library.kind !== kind) return null;

  const videoOverlay = kind === 'video' ? layers.videoOverlays.find((o) => o.id === id) : null;
  const imageOverlay = kind === 'image' ? layers.imageOverlays.find((o) => o.id === id) : null;

  return {
    kind,
    id: library.id,
    name: library.name,
    playUrl: resolveClipPlayUrl(
      kind === 'video' ? videoOverlay?.dataUrl : imageOverlay?.dataUrl,
      library,
    ),
    naturalWidth: library.naturalWidth,
    naturalHeight: library.naturalHeight,
    muted: kind === 'video' ? (videoOverlay?.muted ?? false) : true,
    liveOnPgm,
    loop: kind === 'video' ? (videoOverlay?.loop ?? true) : undefined,
  };
}

/** Staged media selected in the Media panel (preview only — never reads PGM live state). */
export function resolveStagedMediaFeed(
  layers: LayerSettings,
  selectedLayerId: LayerStackId,
): ActiveMediaFeed | null {
  if (!selectedLayerId.startsWith('image:') && !selectedLayerId.startsWith('video:')) {
    return null;
  }
  const id = selectedLayerId.slice(selectedLayerId.indexOf(':') + 1);
  const kind = selectedLayerId.startsWith('video:') ? 'video' as const : 'image' as const;
  return mediaFromLibrary(layers, id, kind, false);
}

/** Media that is live on program (overlay or full media source). */
export function resolveLivePgmMediaFeed(
  layers: LayerSettings,
  pgmLayers: LayerSettings,
): ActiveMediaFeed | null {
  const liveVideo = pgmLayers.videoOverlays.find((o) => o.liveOnPgm && o.visible);
  if (liveVideo) {
    const library = layers.mediaLibrary.find((m) => m.id === liveVideo.id);
    return {
      kind: 'video',
      id: liveVideo.id,
      name: liveVideo.name,
      playUrl: resolveClipPlayUrl(liveVideo.dataUrl, library),
      naturalWidth: liveVideo.naturalWidth,
      naturalHeight: liveVideo.naturalHeight,
      muted: liveVideo.muted,
      liveOnPgm: true,
      loop: liveVideo.loop,
    };
  }

  const liveImage = pgmLayers.imageOverlays.find((o) => o.liveOnPgm && o.visible);
  if (liveImage) {
    const library = layers.mediaLibrary.find((m) => m.id === liveImage.id);
    return {
      kind: 'image',
      id: liveImage.id,
      name: liveImage.name,
      playUrl: resolveClipPlayUrl(liveImage.dataUrl, library),
      naturalWidth: liveImage.naturalWidth,
      naturalHeight: liveImage.naturalHeight,
      muted: true,
      liveOnPgm: true,
    };
  }

  return null;
}

export function resolvePstMediaFeed(
  layers: LayerSettings,
  pstIsMedia: boolean,
  selectedLayerId: LayerStackId,
): ActiveMediaFeed | null {
  if (!pstIsMedia) return null;
  return resolveStagedMediaFeed(layers, selectedLayerId);
}

export function resolvePgmMediaFeed(
  layers: LayerSettings,
  pgmLayers: LayerSettings,
  pgmIsMedia: boolean,
  selectedLayerId: LayerStackId,
): ActiveMediaFeed | null {
  if (!pgmIsMedia) return null;
  return resolveLivePgmMediaFeed(layers, pgmLayers) ?? resolveStagedMediaFeed(layers, selectedLayerId);
}

export type MediaFeedRole = 'pst' | 'pgm' | 'strip';

export function resolveMediaFeedForRole(
  role: MediaFeedRole,
  layers: LayerSettings,
  pgmLayers: LayerSettings,
  selectedLayerId: LayerStackId,
  pstIsMedia: boolean,
  pgmIsMedia: boolean,
): ActiveMediaFeed | null {
  if (role === 'pst') return resolvePstMediaFeed(layers, pstIsMedia, selectedLayerId);
  if (role === 'pgm') return resolvePgmMediaFeed(layers, pgmLayers, pgmIsMedia, selectedLayerId);
  if (pstIsMedia) return resolvePstMediaFeed(layers, true, selectedLayerId);
  if (pgmIsMedia) return resolvePgmMediaFeed(layers, pgmLayers, true, selectedLayerId);
  return null;
}
