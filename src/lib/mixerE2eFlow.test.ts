import { describe, expect, it } from 'vitest';
import { resolveBrowserUrl } from './browserUrl';
import { normalizeLayerSettings } from './layerSettings';
import {
  resolveLivePgmMediaFeed,
  resolvePgmMediaFeed,
  resolvePstMediaFeed,
} from './mediaFeedState';
import { shotFeedRolesForTile } from './shotFeedRoles';
import { trimMediaLibrary } from './mediaUpload';
import { syncLayersWithMediaLibrary } from './mixerMediaService';
import { relayUrlProblem } from './broadcast/relayProtocol';
import { REGAL_BROWSER_DEVICE_ID } from '../types/browserFeed';
import { REGAL_MEDIA_DEVICE_ID } from '../types/mediaFeed';

/** Mirrors MediaFeedContext program-audio gating for E2E assertions. */
function programAudioAllowed(input: {
  masterMuted: boolean;
  isProgramMuted: boolean;
  pgmIsMedia: boolean;
  pgmMediaKind?: 'video' | 'image';
  transportPlaying: boolean;
  livePgmMedia?: { kind: 'video' | 'image'; liveOnPgm: boolean; muted?: boolean } | null;
}) {
  if (input.masterMuted || input.isProgramMuted) return false;
  if (input.pgmIsMedia) {
    return Boolean(input.pgmMediaKind === 'video' && input.transportPlaying);
  }
  if (!input.livePgmMedia || input.livePgmMedia.kind !== 'video') return false;
  return input.livePgmMedia.liveOnPgm && !input.livePgmMedia.muted && input.transportPlaying;
}

function previewAudioAllowed(input: {
  pstIsMedia: boolean;
  pstMediaKind?: 'video' | 'image';
  transportPlaying: boolean;
  isPreviewMuted: boolean;
  monitorMasterMuted: boolean;
}) {
  return (
    input.pstIsMedia &&
    input.pstMediaKind === 'video' &&
    input.transportPlaying &&
    !input.isPreviewMuted &&
    !input.monitorMasterMuted
  );
}

describe('mixer E2E — media upload pipeline', () => {
  it('trims library to max items after upload', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      id: `m-${i}`,
      name: `Clip ${i}`,
      kind: 'video' as const,
      playUrl: `blob:${i}`,
      naturalWidth: 1920,
      naturalHeight: 1080,
      mimeType: 'video/mp4',
      createdAt: i,
    }));
    expect(trimMediaLibrary(items)).toHaveLength(16);
    expect(trimMediaLibrary(items)[0].id).toBe('m-0');
  });

  it('syncs overlay URLs when library is hydrated', () => {
    const library = [
      {
        id: 'clip-a',
        name: 'Intro',
        kind: 'video' as const,
        playUrl: 'https://cdn.example/intro.mp4',
        mimeType: 'video/mp4',
        naturalWidth: 1920,
        naturalHeight: 1080,
        createdAt: 1,
      },
    ];
    const layers = normalizeLayerSettings({
      mediaLibrary: library,
      videoOverlays: [
        {
          id: 'clip-a',
          name: 'Intro',
          dataUrl: 'stale-url',
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
      graphicsStackOrder: ['video:clip-a'],
    });
    const patched = syncLayersWithMediaLibrary(layers, library);
    expect(patched.videoOverlays?.[0]?.dataUrl).toBe('https://cdn.example/intro.mp4');
  });
});

describe('mixer E2E — audio play and mute', () => {
  it('allows program audio when Media is on PGM, playing, and unmuted', () => {
    expect(
      programAudioAllowed({
        masterMuted: false,
        isProgramMuted: false,
        pgmIsMedia: true,
        pgmMediaKind: 'video',
        transportPlaying: true,
      }),
    ).toBe(true);
  });

  it('blocks program audio when program mute is on', () => {
    expect(
      programAudioAllowed({
        masterMuted: false,
        isProgramMuted: true,
        pgmIsMedia: true,
        pgmMediaKind: 'video',
        transportPlaying: true,
      }),
    ).toBe(false);
  });

  it('blocks program audio when transport is paused', () => {
    expect(
      programAudioAllowed({
        masterMuted: false,
        isProgramMuted: false,
        pgmIsMedia: true,
        pgmMediaKind: 'video',
        transportPlaying: false,
      }),
    ).toBe(false);
  });

  it('allows preview audio on PST Media when unmuted and playing', () => {
    expect(
      previewAudioAllowed({
        pstIsMedia: true,
        pstMediaKind: 'video',
        transportPlaying: true,
        isPreviewMuted: false,
        monitorMasterMuted: false,
      }),
    ).toBe(true);
  });

  it('blocks preview audio when preview mute is on', () => {
    expect(
      previewAudioAllowed({
        pstIsMedia: true,
        pstMediaKind: 'video',
        transportPlaying: true,
        isPreviewMuted: true,
        monitorMasterMuted: false,
      }),
    ).toBe(false);
  });
});

describe('mixer E2E — toggle to live (Media + Browser bus)', () => {
  const layers = normalizeLayerSettings({
    mediaLibrary: [
      {
        id: 'clip-live',
        name: 'Live Clip',
        kind: 'video',
        playUrl: 'https://cdn.example/live.mp4',
        mimeType: 'video/mp4',
        naturalWidth: 1920,
        naturalHeight: 1080,
        createdAt: 1,
      },
    ],
    videoOverlays: [
      {
        id: 'clip-live',
        name: 'Live Clip',
        dataUrl: 'https://cdn.example/live.mp4',
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
    graphicsStackOrder: ['video:clip-live'],
  });

  it('routes Media to PGM after take-live overlay flag', () => {
    const pgmLayers = normalizeLayerSettings({
      ...layers,
      videoOverlays: [{ ...layers.videoOverlays[0], liveOnPgm: true, visible: true }],
    });
    const feed = resolvePgmMediaFeed(layers, pgmLayers, true, 'video:clip-live');
    expect(feed).toMatchObject({ id: 'clip-live', liveOnPgm: true, kind: 'video' });
    expect(resolveLivePgmMediaFeed(layers, pgmLayers)?.playUrl).toContain('live.mp4');
  });

  it('keeps PST preview separate from PGM live overlay', () => {
    const pgmLayers = normalizeLayerSettings({
      ...layers,
      videoOverlays: [{ ...layers.videoOverlays[0], liveOnPgm: true, visible: true }],
    });
    const pstFeed = resolvePstMediaFeed(layers, true, 'video:clip-live');
    expect(pstFeed?.liveOnPgm).toBe(false);
    const pgmFeed = resolvePgmMediaFeed(layers, pgmLayers, true, 'video:clip-live');
    expect(pgmFeed?.liveOnPgm).toBe(true);
  });

  it('assigns correct feed roles when Media/Browser are on program', () => {
    expect(
      shotFeedRolesForTile(REGAL_MEDIA_DEVICE_ID, 'cam-1', REGAL_MEDIA_DEVICE_ID),
    ).toEqual({ mediaFeedRole: 'pgm', browserFeedRole: 'pgm' });
    expect(
      shotFeedRolesForTile(REGAL_BROWSER_DEVICE_ID, REGAL_BROWSER_DEVICE_ID, 'cam-1'),
    ).toEqual({ mediaFeedRole: 'pst', browserFeedRole: 'pst' });
  });

  it('uses strip roles on broadcast encode clone so iframe stays on visible PGM', () => {
    expect(
      shotFeedRolesForTile(REGAL_BROWSER_DEVICE_ID, 'cam-1', REGAL_BROWSER_DEVICE_ID, {
        captureClone: true,
      }),
    ).toEqual({ mediaFeedRole: 'strip', browserFeedRole: 'strip' });
  });
});

describe('mixer E2E — browser seamless flow', () => {
  it('resolves YouTube watch URL to embed for seamless iframe load', () => {
    const result = resolveBrowserUrl('https://www.youtube.com/watch?v=abc123XYZ_-');
    expect(result.kind).toBe('youtube');
    expect(result.embedUrl).toContain('youtube.com/embed/abc123XYZ_-');
    expect(result.embedUrl).toContain('enablejsapi=1');
  });

  it('resolves generic HTTPS URLs for web apps', () => {
    const result = resolveBrowserUrl('https://docs.cloudcast.live/guide');
    expect(result.kind).toBe('generic');
    expect(result.embedUrl).toBe('https://docs.cloudcast.live/guide');
  });

  it('rejects invalid browser URLs before preview/take', () => {
    const result = resolveBrowserUrl('');
    expect(result.kind).toBe('empty');
    expect(resolveBrowserUrl('%%%').kind).toBe('invalid');
  });

  it('allows wss relay from https pages (production config)', () => {
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      value: { location: { protocol: 'https:', hostname: 'cloudcast.live' } },
      configurable: true,
    });
    expect(relayUrlProblem()).toBeNull();
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true,
    });
  });
});
