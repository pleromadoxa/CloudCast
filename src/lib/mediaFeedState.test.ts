import { describe, expect, it } from 'vitest';
import { normalizeLayerSettings } from './layerSettings';
import {
  resolveLivePgmMediaFeed,
  resolveMediaFeedForRole,
  resolvePgmMediaFeed,
  resolvePstMediaFeed,
  resolveStagedMediaFeed,
} from './mediaFeedState';

function baseLayers() {
  return normalizeLayerSettings({
    mediaLibrary: [
      {
        id: 'clip-1',
        name: 'Intro',
        kind: 'video',
        playUrl: 'https://cdn.example/intro.mp4',
        mimeType: 'video/mp4',
        naturalWidth: 1920,
        naturalHeight: 1080,
        createdAt: 1_700_000_000_000,
      },
      {
        id: 'logo-1',
        name: 'Logo',
        kind: 'image',
        playUrl: 'https://cdn.example/logo.png',
        mimeType: 'image/png',
        naturalWidth: 400,
        naturalHeight: 400,
        createdAt: 1_700_000_000_000,
      },
    ],
    videoOverlays: [
      {
        id: 'clip-1',
        name: 'Intro',
        dataUrl: 'https://cdn.example/intro.mp4',
        naturalWidth: 1920,
        naturalHeight: 1080,
        scale: 100,
        opacity: 100,
        position: 'center',
        visible: true,
        liveOnPgm: false,
        fillScreen: true,
        loop: true,
        muted: false,
      },
    ],
    graphicsStackOrder: ['video:clip-1'],
  });
}

describe('mediaFeedState', () => {
  it('resolves staged media from selected layer id', () => {
    const feed = resolveStagedMediaFeed(baseLayers(), 'video:clip-1');
    expect(feed).toMatchObject({ id: 'clip-1', kind: 'video', liveOnPgm: false });
  });

  it('returns null for non-media layer ids', () => {
    expect(resolveStagedMediaFeed(baseLayers(), 'lower-third')).toBeNull();
  });

  it('resolves PST media only when PST bus is Media', () => {
    expect(resolvePstMediaFeed(baseLayers(), false, 'video:clip-1')).toBeNull();
    expect(resolvePstMediaFeed(baseLayers(), true, 'video:clip-1')?.kind).toBe('video');
  });

  it('prefers live PGM overlay when Media is on program', () => {
    const layers = baseLayers();
    const pgmLayers = normalizeLayerSettings({
      ...layers,
      videoOverlays: [{ ...layers.videoOverlays[0], liveOnPgm: true, visible: true }],
    });
    const feed = resolvePgmMediaFeed(layers, pgmLayers, true, 'video:clip-1');
    expect(feed).toMatchObject({ id: 'clip-1', liveOnPgm: true });
  });

  it('falls back to staged media on PGM when no live overlay exists', () => {
    const layers = baseLayers();
    const feed = resolvePgmMediaFeed(layers, layers, true, 'video:clip-1');
    expect(feed).toMatchObject({ id: 'clip-1', liveOnPgm: false });
  });

  it('resolveLivePgmMediaFeed reads live overlays from pgmLayers', () => {
    const layers = baseLayers();
    const pgmLayers = normalizeLayerSettings({
      ...layers,
      videoOverlays: [{ ...layers.videoOverlays[0], liveOnPgm: true, visible: true }],
    });
    expect(resolveLivePgmMediaFeed(layers, pgmLayers)?.liveOnPgm).toBe(true);
  });

  it('prefers library cloud URL over stale blob overlay URLs', () => {
    const layers = normalizeLayerSettings({
      ...baseLayers(),
      videoOverlays: [
        {
          ...baseLayers().videoOverlays[0],
          dataUrl: 'blob:http://localhost/revoked',
        },
      ],
    });
    const feed = resolveStagedMediaFeed(layers, 'video:clip-1');
    expect(feed?.playUrl).toBe('https://cdn.example/intro.mp4');
  });

  it('resolveMediaFeedForRole routes strip to PST then PGM', () => {
    const layers = baseLayers();
    expect(resolveMediaFeedForRole('strip', layers, layers, 'video:clip-1', true, false)?.kind).toBe(
      'video',
    );
    expect(resolveMediaFeedForRole('strip', layers, layers, 'video:clip-1', false, true)?.kind).toBe(
      'video',
    );
  });
});
