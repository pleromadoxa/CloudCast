import { describe, expect, it } from 'vitest';
import {
  STUDIO_SCENES,
  getStudioScene,
  getStudioSceneSlot,
  scenesForCategory,
  studioScenesForPlan,
  validateStudioScenes,
} from './sceneRegistry';
import {
  clampSceneSettings,
  graphicContentId,
  isSourceActive,
  resolveSlotSource,
  serializeBindings,
  deserializeBindings,
  serializeScreenSource,
  sourceIdentity,
  suggestedTextureSize,
} from './screenSources';
import {
  autoQualityTier,
  degradeQuality,
  improveQuality,
  shouldDegrade,
  shouldImprove,
  studioQualityPreset,
} from './quality';
import type { StudioScreenSource } from './types';

const canvasSource = (w = 640, h = 360): StudioScreenSource => ({
  kind: 'canvas',
  canvas: { width: w, height: h } as unknown as HTMLCanvasElement,
});

describe('virtualStudio scene registry', () => {
  it('ships structurally valid scenes', () => {
    expect(validateStudioScenes()).toEqual([]);
  });

  it('exposes every documented scene id', () => {
    for (const id of [
      'newsroom',
      'sports_arena',
      'living_room',
      'talk_show',
      'worship_stage',
      'weather_center',
      'kitchen_set',
      'bedroom_suite',
      'conference_room',
      'house_exterior',
      'green_room',
      'xr_concert',
      'cyclorama',
      'global_news_arena',
      'classic_blue_news',
      'amber_talk_studio',
      'crimson_ring_studio',
      'violet_hud_news',
    ]) {
      expect(getStudioScene(id)?.id).toBe(id);
    }
    expect(getStudioScene('nope')).toBeUndefined();
  });

  it('wires the reference-matched sets with their signature screens', () => {
    const arena = getStudioScene('global_news_arena')!;
    expect(arena.screens.map((s) => s.id)).toEqual(
      expect.arrayContaining(['video_wall', 'ticker', 'side_screen', 'desk_monitor', 'backdrop']),
    );
    expect(arena.screens.find((s) => s.id === 'video_wall')?.required).toBe(true);
    for (const id of ['classic_blue_news', 'amber_talk_studio', 'crimson_ring_studio', 'violet_hud_news']) {
      const scene = getStudioScene(id)!;
      expect(scene.screens.filter((s) => s.required), id).toHaveLength(1);
      expect(scene.backdropSlotId, id).toBeTruthy();
    }
  });

  it('gives each scene a talent placement and one required screen', () => {
    for (const scene of STUDIO_SCENES) {
      expect(scene.talent, `${scene.id} talent`).toBeTruthy();
      expect(scene.screens.filter((s) => s.required)).toHaveLength(1);
    }
  });

  it('resolves backdrop slots to real slots', () => {
    for (const scene of STUDIO_SCENES) {
      expect(scene.backdropSlotId).toBeTruthy();
      expect(getStudioSceneSlot(scene.id, scene.backdropSlotId!)).toBeTruthy();
    }
  });

  it('defaults ready-to-air content on media slots', () => {
    const newsroom = getStudioScene('newsroom')!;
    const ticker = newsroom.screens.find((s) => s.id === 'ticker')!;
    expect(ticker.defaultSource?.kind).toBe('graphic');
    const wall = newsroom.screens.find((s) => s.id === 'video_wall')!;
    expect(wall.defaultSource?.kind).toBe('graphic');
  });

  it('filters scenes by plan tier', () => {
    expect(studioScenesForPlan('free').every((s) => s.tier === 'free')).toBe(true);
    expect(studioScenesForPlan('free').length).toBeLessThan(STUDIO_SCENES.length);
    expect(studioScenesForPlan('pro_master')).toHaveLength(STUDIO_SCENES.length);
    expect(studioScenesForPlan('universal')).toHaveLength(STUDIO_SCENES.length);
    expect(studioScenesForPlan('pro', 2)).toHaveLength(2);
  });

  it('filters scenes by category', () => {
    expect(scenesForCategory('news').map((s) => s.id)).toEqual([
      'newsroom',
      'global_news_arena',
      'classic_blue_news',
      'crimson_ring_studio',
      'violet_hud_news',
    ]);
    expect(scenesForCategory('blank').map((s) => s.id)).toEqual(['cyclorama']);
    expect(scenesForCategory('weather').map((s) => s.id)).toEqual(['weather_center']);
  });

  it('ships the weather center with a map wall, radar bank and ticker', () => {
    const scene = getStudioScene('weather_center')!;
    const slotIds = scene.screens.map((s) => s.id);
    expect(slotIds).toEqual(
      expect.arrayContaining(['map_wall', 'forecast_ticker', 'radar_left', 'radar_right', 'desk_monitor', 'backdrop']),
    );
    expect(scene.screens.find((s) => s.id === 'map_wall')?.required).toBe(true);
    expect(scene.screens.find((s) => s.id === 'forecast_ticker')?.form).toBe('ribbon');
  });
});

describe('screen source routing', () => {
  it('prefers operator binding, then scene default, then off', () => {
    const def: StudioScreenSource = { kind: 'graphic', content: { style: 'logo', text: 'A' } };
    const bound: StudioScreenSource = { kind: 'image-url', url: 'https://x/y.png' };
    expect(resolveSlotSource({ sources: { tv: bound } }, 'tv', def)).toEqual(bound);
    expect(resolveSlotSource({ sources: {} }, 'tv', def)).toEqual(def);
    expect(resolveSlotSource(undefined, 'tv', undefined)).toEqual({ kind: 'off' });
  });

  it('builds stable identities for cache keys', () => {
    const a: StudioScreenSource = { kind: 'image-url', url: 'https://x/a.png' };
    const b: StudioScreenSource = { kind: 'image-url', url: 'https://x/a.png' };
    const c: StudioScreenSource = { kind: 'video-url', url: 'https://x/a.mp4', loop: true };
    expect(sourceIdentity(a)).toBe(sourceIdentity(b));
    expect(sourceIdentity(a)).not.toBe(sourceIdentity(c));
    expect(sourceIdentity({ kind: 'off' })).toBeNull();
    expect(sourceIdentity(undefined)).toBeNull();
  });

  it('gives each canvas a unique identity', () => {
    expect(sourceIdentity(canvasSource())).not.toBe(sourceIdentity(canvasSource()));
    const shared = canvasSource();
    expect(sourceIdentity(shared)).toBe(sourceIdentity(shared));
  });

  it('knows when a source paints pixels', () => {
    expect(isSourceActive({ kind: 'off' })).toBe(false);
    expect(isSourceActive({ kind: 'image-url', url: '  ' })).toBe(false);
    expect(isSourceActive({ kind: 'image-url', url: 'https://x/a.png' })).toBe(true);
    expect(isSourceActive({ kind: 'video-url', url: 'https://x/a.mp4' })).toBe(true);
    expect(isSourceActive(canvasSource(0, 0))).toBe(false);
    expect(isSourceActive(canvasSource())).toBe(true);
    expect(isSourceActive({ kind: 'graphic', content: { style: 'logo' } })).toBe(true);
    expect(isSourceActive(undefined)).toBe(false);
  });

  it('keys graphic identity by content', () => {
    expect(
      graphicContentId({ style: 'lower-third', text: 'News', accent: '#fff' }),
    ).toBe(graphicContentId({ style: 'lower-third', text: 'News', accent: '#fff' }));
    expect(
      graphicContentId({ style: 'lower-third', text: 'News' }),
    ).not.toBe(graphicContentId({ style: 'lower-third', text: 'Sport' }));
  });

  it('clamps operator settings to safe ranges', () => {
    expect(clampSceneSettings({ sources: {}, lighting: 9 }).lighting).toBe(1.6);
    expect(clampSceneSettings({ sources: {}, lighting: 0.1 }).lighting).toBe(0.6);
    expect(clampSceneSettings({ sources: {}, tickerSpeed: -40 }).tickerSpeed).toBe(0);
    expect(clampSceneSettings({ sources: {} }).lighting).toBe(1);
  });

  it('sizes textures per screen form', () => {
    expect(suggestedTextureSize('ribbon').height).toBeLessThan(256);
    expect(suggestedTextureSize('video-wall').width).toBe(1920);
    expect(suggestedTextureSize('monitor').width).toBe(1024);
  });
});

describe('scene persistence projection', () => {
  it('drops session-only sources and keeps plain ones', () => {
    const live: StudioScreenSource = {
      kind: 'live-video',
      video: {} as HTMLVideoElement,
    };
    expect(serializeScreenSource(live)).toBeNull();
    expect(serializeScreenSource({ kind: 'image-url', url: 'https://x/a.png' })).toEqual({
      kind: 'image-url',
      url: 'https://x/a.png',
    });
  });

  it('round-trips bindings', () => {
    const bindings = {
      tv: { kind: 'image-url', url: 'https://x/tv.png' } as StudioScreenSource,
      ticker: {
        kind: 'graphic',
        content: { style: 'lower-third' as const, text: 'Hi' },
      } as StudioScreenSource,
      side: canvasSource(),
    };
    const serialized = serializeBindings(bindings);
    expect(Object.keys(serialized).sort()).toEqual(['ticker', 'tv']);
    const restored = deserializeBindings(serialized);
    expect(restored).toEqual(serialized);
  });

  it('ignores malformed stored bindings', () => {
    const restored = deserializeBindings({
      bad: { nonsense: true } as unknown as StudioScreenSource,
      good: { kind: 'off' } as StudioScreenSource,
    });
    expect(Object.keys(restored)).toEqual(['good']);
  });
});

describe('adaptive quality', () => {
  it('degrades and improves within bounds', () => {
    expect(degradeQuality('balanced')).toBe('low');
    expect(degradeQuality('low')).toBe('low');
    expect(improveQuality('ultra')).toBe('ultra');
    expect(improveQuality('high')).toBe('ultra');
  });

  it('reacts to sustained frame time', () => {
    expect(shouldDegrade(40, 'high')).toBe(true);
    expect(shouldDegrade(40, 'low')).toBe(false);
    expect(shouldImprove(10, 'ultra')).toBe(false);
    expect(shouldImprove(10, 'high')).toBe(true);
    expect(shouldImprove(20, 'high')).toBe(false);
  });

  it('keeps mobile devices on conservative tiers', () => {
    expect(autoQualityTier({ isMobile: true, cores: 4, memoryGb: 4 })).toBe('low');
    expect(autoQualityTier({ isMobile: true, cores: 8, memoryGb: 8 })).toBe('balanced');
    expect(autoQualityTier({ isMobile: false, cores: 16, memoryGb: 32 })).toBe('high');
  });

  it('exposes a preset for every tier', () => {
    for (const tier of ['low', 'balanced', 'high', 'ultra'] as const) {
      const preset = studioQualityPreset(tier);
      expect(preset.tier).toBe(tier);
      expect(preset.maxDpr).toBeGreaterThan(0);
      expect(preset.envResolution).toBeGreaterThan(0);
    }
    expect(studioQualityPreset('ultra').depthOfField).toBe(true);
    expect(studioQualityPreset('low').shadows).toBe(false);
  });
});
