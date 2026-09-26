// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
  buildDefaultGraphicsStackOrder,
  ensureStackId,
  normalizeGraphicsStackOrder,
  zIndexForStackId,
} from './graphicsStackOrder';
import {
  hasLivePgmGraphics,
  normalizeLayerSettings,
  pickAdZoneFields,
  pickCountdownFields,
  pickScoreboardFields,
  pickSponsorBugFields,
  pickWeatherFields,
  syncLivePgmGraphics,
} from './layerSettings';
import {
  DEFAULT_CRAWLER,
  DEFAULT_WEATHER,
  resolveWeatherSettings,
} from '../types/overlays';

describe('normalizeLayerSettings (graphics pack defaults)', () => {
  it('fills every graphics pack field on empty input', () => {
    const layers = normalizeLayerSettings({});
    expect(layers.showWeather).toBe(false);
    expect(layers.showAdZone).toBe(false);
    expect(layers.showScoreboard).toBe(false);
    expect(layers.showCountdown).toBe(false);
    expect(layers.showSponsorBug).toBe(false);
    expect(layers.weather.location).toBe(DEFAULT_WEATHER.location);
    expect(layers.scoreboard.home.name).toBe('HOME');
    expect(layers.countdown.mode).toBe('countdown');
    expect(layers.adZone.sourceKind).toBe('image');
    expect(layers.sponsorBug.entries).toEqual([]);
  });

  it('normalizes nested graphics pack settings from partial data', () => {
    const layers = normalizeLayerSettings({
      weather: { ...DEFAULT_WEATHER, forecast: Array.from({ length: 9 }, (_, i) => ({ day: `D${i}`, icon: 'sun', hi: 20, lo: 10 })) },
      scoreboard: { ...normalizeLayerSettings({}).scoreboard, clockSeconds: -20 },
      sponsorBug: {
        ...normalizeLayerSettings({}).sponsorBug,
        entries: Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, logoDataUrl: 'data:x', seconds: 5 })),
      },
    });
    expect(layers.weather.forecast).toHaveLength(7);
    expect(layers.scoreboard.clockSeconds).toBe(0);
    expect(layers.sponsorBug.entries).toHaveLength(8);
  });

  it('migrates legacy single-line crawler data into a ticker line', () => {
    const layers = normalizeLayerSettings({
      crawler: { ...DEFAULT_CRAWLER, text: 'Legacy crawl', lines: [] },
    });
    expect(layers.crawler.lines).toHaveLength(1);
    expect(layers.crawler.lines[0].text).toBe('Legacy crawl');
  });
});

describe('pick*Fields', () => {
  it('stages graphics content and deep-copies nested collections', () => {
    const draft = normalizeLayerSettings({
      weather: resolveWeatherSettings({ ...DEFAULT_WEATHER, location: 'ACCRA' }),
    });
    const picked = pickWeatherFields(draft);
    expect(picked.showWeather).toBe(true);
    expect(picked.weather?.location).toBe('ACCRA');

    picked.weather!.forecast[0].hi = -99;
    expect(draft.weather.forecast[0].hi).not.toBe(-99);
  });

  it('covers every graphics pack layer', () => {
    const draft = normalizeLayerSettings({});
    expect(pickAdZoneFields(draft).showAdZone).toBe(true);
    expect(pickScoreboardFields(draft).showScoreboard).toBe(true);
    expect(pickCountdownFields(draft).showCountdown).toBe(true);
    expect(pickSponsorBugFields(draft).showSponsorBug).toBe(true);
  });
});

describe('syncLivePgmGraphics + hasLivePgmGraphics', () => {
  it('reports live graphics for each new layer', () => {
    const base = normalizeLayerSettings({});
    expect(hasLivePgmGraphics(base)).toBe(false);
    expect(hasLivePgmGraphics({ ...base, showWeather: true })).toBe(true);
    expect(hasLivePgmGraphics({ ...base, showAdZone: true })).toBe(true);
    expect(hasLivePgmGraphics({ ...base, showScoreboard: true })).toBe(true);
    expect(hasLivePgmGraphics({ ...base, showCountdown: true })).toBe(true);
    expect(hasLivePgmGraphics({ ...base, showSponsorBug: true })).toBe(true);
  });

  it('copies staged content to PGM only for layers already on air', () => {
    const draft = normalizeLayerSettings({
      weather: resolveWeatherSettings({ ...DEFAULT_WEATHER, location: 'ACCRA' }),
      countdown: { ...normalizeLayerSettings({}).countdown, title: 'LAUNCH IN' },
    });
    const pgm = normalizeLayerSettings({
      showWeather: true,
      weather: resolveWeatherSettings({ ...DEFAULT_WEATHER, location: 'OLD TOWN' }),
    });
    const synced = syncLivePgmGraphics(draft, pgm);
    // weather is live on PGM → content follows the draft
    expect(synced.weather.location).toBe('ACCRA');
    // countdown is staged but not live → stays off on PGM, content not pushed
    expect(synced.showCountdown).toBe(false);
    expect(synced.countdown.title).not.toBe('LAUNCH IN');
  });

  it('keeps the graphics stack order aligned with the draft', () => {
    const draft = normalizeLayerSettings({
      graphicsStackOrder: ['countdown', 'weather', 'logo', 'chroma', 'transition'],
    });
    const pgm = normalizeLayerSettings({ showWeather: true });
    const synced = syncLivePgmGraphics(draft, pgm);
    expect(synced.graphicsStackOrder).toEqual(['countdown', 'weather', 'logo', 'chroma', 'transition']);
    expect(synced.weather.location).toBe(DEFAULT_WEATHER.location);
  });
});

describe('graphics stack order integration', () => {
  it('places the graphics pack after the lower third and above the logo', () => {
    const order = buildDefaultGraphicsStackOrder(normalizeLayerSettings({}));
    expect(order).toEqual([
      'transition',
      'breaking',
      'live-button',
      'lower-third',
      'weather',
      'scoreboard',
      'ad-zone',
      'sponsor-bug',
      'countdown',
      'logo',
      'crawler',
      'chroma',
    ]);
  });

  it('preserves operator-removed layers during normalization', () => {
    const layers = normalizeLayerSettings({});
    const order = ['lower-third', 'weather', 'logo', 'crawler', 'chroma', 'transition'];
    const normalized = normalizeGraphicsStackOrder(order, layers);
    expect(normalized).toEqual(order);
    expect(normalized).not.toContain('countdown');
    expect(normalized).not.toContain('ad-zone');
  });

  it('ensureStackId restores a removed layer at its canonical position', () => {
    const order = ['lower-third', 'logo', 'crawler', 'chroma', 'transition'];
    const withWeather = ensureStackId(order, 'weather');
    expect(withWeather).toEqual(['lower-third', 'weather', 'logo', 'crawler', 'chroma', 'transition']);
    expect(ensureStackId(withWeather, 'weather')).toBe(withWeather);
    expect(ensureStackId(order, 'countdown')).toEqual([
      'lower-third',
      'countdown',
      'logo',
      'crawler',
      'chroma',
      'transition',
    ]);
  });

  it('keeps z-index monotonic with stack position (front = highest)', () => {
    const order = buildDefaultGraphicsStackOrder(normalizeLayerSettings({}));
    expect(zIndexForStackId('weather', order)).toBeGreaterThan(zIndexForStackId('logo', order));
    expect(zIndexForStackId('logo', order)).toBeGreaterThan(zIndexForStackId('chroma', order));
    expect(zIndexForStackId('image:missing', order)).toBe(10);
  });
});
