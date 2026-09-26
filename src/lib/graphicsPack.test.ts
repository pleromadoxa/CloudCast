// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
  carouselTiming,
  formatCountdownClock,
  formatGameClock,
  formatTimeOfDay,
  resolveCountdownDisplay,
} from './graphicsPack';
import {
  DEFAULT_WEATHER,
  MAX_AD_CAROUSEL_ENTRIES,
  MAX_SPONSOR_BUG_ENTRIES,
  MAX_TICKER_LINES,
  MAX_WEATHER_FORECAST_DAYS,
  resolveAdZoneSettings,
  resolveCountdownSettings,
  resolveCrawlerSettings,
  resolveScoreboardSettings,
  resolveSponsorBugSettings,
  resolveWeatherSettings,
} from '../types/overlays';

describe('formatGameClock', () => {
  it('formats mm:ss with padded seconds', () => {
    expect(formatGameClock(0)).toBe('0:00');
    expect(formatGameClock(9)).toBe('0:09');
    expect(formatGameClock(65)).toBe('1:05');
    expect(formatGameClock(720)).toBe('12:00');
    expect(formatGameClock(3723)).toBe('62:03');
  });

  it('clamps invalid and negative values to zero', () => {
    expect(formatGameClock(-12)).toBe('0:00');
    expect(formatGameClock(Number.NaN)).toBe('0:00');
    expect(formatGameClock(59.9)).toBe('0:59');
  });
});

describe('formatCountdownClock', () => {
  it('shows mm:ss below an hour and h:mm:ss above', () => {
    expect(formatCountdownClock(45)).toBe('0:45');
    expect(formatCountdownClock(300)).toBe('5:00');
    expect(formatCountdownClock(3725)).toBe('01:02:05');
  });
});

describe('formatTimeOfDay', () => {
  it('renders 24h wall clock with padded parts', () => {
    expect(formatTimeOfDay(new Date(2026, 8, 26, 17, 42, 9))).toBe('17:42:09');
  });
});

describe('resolveCountdownDisplay', () => {
  it('counts down to zero and reports done', () => {
    const settings = { mode: 'countdown' as const, targetSeconds: 300 };
    expect(resolveCountdownDisplay(settings, 30)).toEqual({
      seconds: 270,
      progress: 0.1,
      done: false,
    });
    const atZero = resolveCountdownDisplay(settings, 300);
    expect(atZero.seconds).toBe(0);
    expect(atZero.done).toBe(true);
    expect(resolveCountdownDisplay(settings, 999).seconds).toBe(0);
  });

  it('counts up toward the target', () => {
    const settings = { mode: 'count-up' as const, targetSeconds: 120 };
    expect(resolveCountdownDisplay(settings, 30)).toEqual({
      seconds: 30,
      progress: 0.25,
      done: false,
    });
    expect(resolveCountdownDisplay(settings, 120).done).toBe(true);
    expect(resolveCountdownDisplay(settings, 200).seconds).toBe(200);
  });

  it('never reports done for a zero-length countdown target', () => {
    const settings = { mode: 'countdown' as const, targetSeconds: 0 };
    expect(resolveCountdownDisplay(settings, 5)).toEqual({
      seconds: 0,
      progress: 0,
      done: false,
    });
  });
});

describe('carouselTiming (ad carousel rotation math)', () => {
  const entries = [
    { durationSeconds: 6 },
    { durationSeconds: 6 },
    { durationSeconds: 6 },
  ];

  it('advances through entries and wraps around the loop', () => {
    expect(carouselTiming(entries, 0).index).toBe(0);
    expect(carouselTiming(entries, 5).index).toBe(0);
    expect(carouselTiming(entries, 6).index).toBe(1);
    expect(carouselTiming(entries, 13).index).toBe(2);
    // 18s = one full rotation → back to the first creative
    expect(carouselTiming(entries, 18).index).toBe(0);
    expect(carouselTiming(entries, 19).index).toBe(0);
    expect(carouselTiming(entries, 24).index).toBe(1);
  });

  it('reports progress inside the active entry and total duration', () => {
    const timing = carouselTiming(entries, 7);
    expect(timing.progress).toBeCloseTo(1 / 6, 5);
    expect(timing.totalDuration).toBe(18);
  });

  it('supports sponsor-bug entries shaped with `seconds`', () => {
    const sponsors = [{ seconds: 8 }, { seconds: 4 }];
    expect(carouselTiming(sponsors, 0).index).toBe(0);
    expect(carouselTiming(sponsors, 9).index).toBe(1);
    expect(carouselTiming(sponsors, 12).index).toBe(0);
    expect(carouselTiming(sponsors, 9).totalDuration).toBe(12);
  });

  it('resolves empty carousels safely and falls back on zero durations', () => {
    expect(carouselTiming([], 5)).toEqual({ index: 0, progress: 0, totalDuration: 0 });
    const fallback = carouselTiming([{ durationSeconds: 0 }], 5);
    expect(fallback.totalDuration).toBe(6);
    expect(fallback.index).toBe(0);
  });
});

describe('weather settings defaults & normalization', () => {
  it('ships a broadcast-ready 4-day default', () => {
    expect(DEFAULT_WEATHER.forecast).toHaveLength(4);
    expect(DEFAULT_WEATHER.unit).toBe('C');
    expect(DEFAULT_WEATHER.showClock).toBe(true);
  });

  it('caps the forecast strip and fills day fields', () => {
    const forecast = Array.from({ length: 10 }, (_, i) => ({ hi: i, lo: i - 5 }));
    const resolved = resolveWeatherSettings({ forecast, unit: 'F', icon: 'storm' });
    expect(resolved.forecast).toHaveLength(MAX_WEATHER_FORECAST_DAYS);
    expect(resolved.forecast[0].day).toBe('Day 1');
    expect(resolved.forecast[0].icon).toBe('storm');
    expect(resolved.unit).toBe('F');
  });

  it('falls back to safe values for invalid input', () => {
    const resolved = resolveWeatherSettings({
      temperature: Number.NaN,
      unit: 'K' as never,
      icon: 'hurricane' as never,
      style: 'neon' as never,
      opacity: 400,
      forecast: [{ day: '', icon: 'comet' as never, hi: Number.NaN, lo: Number.NaN }],
    });
    expect(resolved.temperature).toBe(0);
    expect(resolved.unit).toBe('C');
    expect(resolved.icon).toBe('sun');
    expect(resolved.style).toBe('glass');
    expect(resolved.opacity).toBe(100);
    expect(resolved.forecast[0]).toEqual({ day: 'Day 1', icon: 'sun', hi: 0, lo: 0 });
  });
});

describe('crawler settings normalization', () => {
  it('caps ticker lines and normalizes per-line fields', () => {
    const lines = Array.from({ length: 6 }, (_, i) => ({
      id: `l${i}`,
      text: `line ${i}`,
      enabled: i % 2 === 0,
      speed: 9 as never,
      height: 'huge' as never,
      background: 'neon' as never,
      fontScale: 500,
    }));
    const resolved = resolveCrawlerSettings({ lines, breaking: true });
    expect(resolved.lines).toHaveLength(MAX_TICKER_LINES);
    expect(resolved.lines[1].speed).toBe(2);
    expect(resolved.lines[1].height).toBe('md');
    expect(resolved.lines[1].fontScale).toBe(180);
    expect(resolved.breaking).toBe(true);
  });

  it('seeds a single ticker line from legacy `text` data', () => {
    const resolved = resolveCrawlerSettings({ text: 'Legacy crawl line' });
    expect(resolved.lines).toHaveLength(1);
    expect(resolved.lines[0].text).toBe('Legacy crawl line');
    expect(resolved.lines[0].enabled).toBe(true);
  });
});

describe('ad-zone settings normalization', () => {
  it('caps the carousel and validates source fields', () => {
    const carousel = Array.from({ length: 9 }, (_, i) => ({
      id: `c${i}`,
      imageDataUrl: `data:${i}`,
      durationSeconds: 0,
    }));
    const resolved = resolveAdZoneSettings({
      carousel,
      sourceKind: 'hologram' as never,
      liveVideoSource: 'stream:1' as never,
      widthPercent: 500,
    });
    expect(resolved.carousel).toHaveLength(MAX_AD_CAROUSEL_ENTRIES);
    expect(resolved.carousel[0].durationSeconds).toBe(6);
    expect(resolved.sourceKind).toBe('image');
    expect(resolved.liveVideoSource).toBe('none');
    expect(resolved.widthPercent).toBe(60);
  });

  it('keeps media:* live sources', () => {
    const resolved = resolveAdZoneSettings({
      sourceKind: 'live-video',
      liveVideoSource: 'media:abc',
    });
    expect(resolved.liveVideoSource).toBe('media:abc');
    expect(resolved.sourceKind).toBe('live-video');
  });
});

describe('scoreboard settings normalization', () => {
  it('clamps scores and the game clock', () => {
    const resolved = resolveScoreboardSettings({
      home: { name: 'Lakers', score: -4, logoDataUrl: 'data:x' },
      away: { name: '', score: 12345 },
      clockSeconds: 99999,
      possession: 'sideline' as never,
    });
    expect(resolved.home).toEqual({ name: 'Lakers', score: 0, logoDataUrl: 'data:x' });
    expect(resolved.away.name).toBe('AWAY');
    expect(resolved.away.score).toBe(999);
    expect(resolved.clockSeconds).toBe(99 * 60 + 59);
    expect(resolved.possession).toBe('none');
  });
});

describe('sponsor-bug settings normalization', () => {
  it('caps entries and gives logos a safe duration', () => {
    const entries = Array.from({ length: 12 }, (_, i) => ({
      id: `s${i}`,
      logoDataUrl: `data:${i}`,
      seconds: 0,
    }));
    const resolved = resolveSponsorBugSettings({ entries, size: 99 });
    expect(resolved.entries).toHaveLength(MAX_SPONSOR_BUG_ENTRIES);
    expect(resolved.entries[0].seconds).toBe(8);
    expect(resolved.size).toBe(30);
  });
});

describe('countdown settings normalization', () => {
  it('validates mode and clamps the target', () => {
    const resolved = resolveCountdownSettings({
      mode: 'stopwatch' as never,
      targetSeconds: -30,
      opacity: 1,
    });
    expect(resolved.mode).toBe('countdown');
    expect(resolved.targetSeconds).toBe(0);
    expect(resolved.opacity).toBe(10);
  });
});
