import { describe, expect, it } from 'vitest';
import {
  clampBloomIntensity,
  clampCameraPreset,
  clampEffectOverrides,
  clampExposure,
  clampLighting,
  clampRundown,
  clampTemperature,
  depthOfFieldForShot,
  emptyShotMemories,
  MAX_RUNDOWN_STEPS,
  MAX_SHOT_MEMORIES,
  MOOD_PRESETS,
  normalizeShotMemories,
  resolveShot,
  rigGradeFor,
  saveShotMemory,
  SHOT_ORDER,
  temperatureColor,
} from './productionDesk';
import type { StudioCameraPreset } from './types';

const base: StudioCameraPreset = { yaw: 0, pitch: 0.14, zoom: 1 };

describe('camera desk', () => {
  it('clamps poses to safe rig ranges', () => {
    const p = clampCameraPreset({ yaw: 99, pitch: -3, zoom: 40 });
    expect(p.zoom).toBe(3.4);
    // Free camera covers crane-high through low-angle framings.
    expect(p.pitch).toBe(-1.25);
    expect(clampCameraPreset({ yaw: -99, pitch: 3, zoom: 0.1 }).pitch).toBe(1.35);
    expect(clampCameraPreset({ yaw: -99, pitch: 3, zoom: 0.1 }).zoom).toBe(0.55);
  });

  it('preserves and clamps the free-camera pan target', () => {
    const p = clampCameraPreset({ yaw: 0, pitch: 0, zoom: 1, target: [40, -2, 22] });
    expect(p.target).toEqual([9, 0.15, 8]);
    // Legacy presets without a pan keep it undefined.
    expect(clampCameraPreset({ yaw: 0, pitch: 0, zoom: 1 }).target).toBeUndefined();
  });

  it('clamps lens fov to the supported range and preserves it otherwise', () => {
    expect(clampCameraPreset({ yaw: 0, pitch: 0, zoom: 1, fov: 5 }).fov).toBe(22);
    expect(clampCameraPreset({ yaw: 0, pitch: 0, zoom: 1, fov: 90 }).fov).toBe(55);
    expect(clampCameraPreset({ yaw: 0, pitch: 0, zoom: 1, fov: 38 }).fov).toBe(38);
    // Legacy presets without a lens keep it undefined.
    expect(clampCameraPreset({ yaw: 0, pitch: 0, zoom: 1 }).fov).toBeUndefined();
  });

  it('resolves every shot inside the rig ranges and pushes in for close-ups', () => {
    for (const shot of SHOT_ORDER) {
      const pose = resolveShot(base, shot);
      expect(pose.zoom).toBeGreaterThanOrEqual(0.55);
      expect(pose.zoom).toBeLessThanOrEqual(3.4);
      expect(pose.pitch).toBeGreaterThanOrEqual(-0.35);
      expect(pose.pitch).toBeLessThanOrEqual(0.55);
    }
    expect(resolveShot(base, 'wide').zoom).toBeLessThan(base.zoom);
    expect(resolveShot(base, 'close').zoom).toBeGreaterThan(resolveShot(base, 'medium').zoom);
  });

  it('always returns fixed-length shot memories', () => {
    expect(emptyShotMemories()).toHaveLength(MAX_SHOT_MEMORIES);
    expect(normalizeShotMemories(undefined)).toHaveLength(MAX_SHOT_MEMORIES);
    expect(normalizeShotMemories([base, null])).toHaveLength(MAX_SHOT_MEMORIES);
    expect(normalizeShotMemories([{ yaw: 0, pitch: 0, zoom: 99 }])[0]?.zoom).toBe(3.4);
  });

  it('saves into a slot without mutating the input and ignores bad indices', () => {
    const shots = emptyShotMemories();
    const next = saveShotMemory(shots, 1, base);
    expect(shots[1]).toBeNull();
    expect(next[1]).toEqual(base);
    expect(saveShotMemory(shots, 99, base)).toEqual(shots);
  });
});

describe('look desk clamps', () => {
  it('clamps every operator control', () => {
    expect(clampLighting(9)).toBe(1.6);
    expect(clampLighting(0)).toBe(0.6);
    expect(clampTemperature(-1)).toBe(0);
    expect(clampTemperature(2)).toBe(1);
    expect(clampExposure(3)).toBe(1.6);
    expect(clampBloomIntensity(0)).toBe(0.15);
    expect(clampBloomIntensity(5)).toBe(1.2);
  });

  it('ships moods inside the control ranges', () => {
    for (const mood of MOOD_PRESETS) {
      expect(clampLighting(mood.lighting)).toBe(mood.lighting);
      expect(clampTemperature(mood.temperature)).toBe(mood.temperature);
      expect(clampExposure(mood.exposure)).toBe(mood.exposure);
    }
  });

  it('normalises effect overrides and drops empty objects', () => {
    expect(clampEffectOverrides(undefined)).toBeUndefined();
    expect(clampEffectOverrides({ bloom: true, bloomIntensity: 99 })).toEqual({
      bloom: true,
      bloomIntensity: 1.2,
    });
    expect(clampEffectOverrides({ ao: 0 as unknown as boolean })).toEqual({ ao: false });
  });

  it('blends temperature into a hex colour', () => {
    expect(temperatureColor(0)).toMatch(/^#[0-9a-f]{6}$/);
    expect(temperatureColor(1)).toMatch(/^#[0-9a-f]{6}$/);
    expect(temperatureColor(0)).not.toBe(temperatureColor(1));
  });
});

describe('autocam rundown', () => {
  it('clamps poses and hold durations', () => {
    const [step] = clampRundown([
      { label: 'Wide', pose: { yaw: 0, pitch: 0.1, zoom: 99 }, duration: 999 },
    ])!;
    expect(step.pose.zoom).toBe(3.4);
    expect(step.duration).toBe(60);
  });

  it('caps the rundown length and drops nothing on empty', () => {
    expect(clampRundown(undefined)).toBeUndefined();
    const steps = Array.from({ length: 40 }, (_, i) => ({
      label: `S${i}`,
      pose: { yaw: 0, pitch: 0, zoom: 1 },
      duration: 3,
    }));
    expect(clampRundown(steps)).toHaveLength(MAX_RUNDOWN_STEPS);
  });
});

describe('shot-driven depth of field', () => {
  it('keeps wide shots deep and racks focus shallow on close-ups', () => {
    const wide = depthOfFieldForShot(resolveShot(base, 'wide').zoom, undefined, [0, 1.05, 0]);
    const close = depthOfFieldForShot(resolveShot(base, 'close').zoom, undefined, [0, 1.05, 0]);
    // Wide framings keep the whole dressed set readable…
    expect(wide.focusRange).toBeGreaterThanOrEqual(8);
    // …while a close-up narrows onto the subject and melts the set behind it.
    expect(close.focusRange).toBeLessThan(4);
    expect(close.focusRange).toBeLessThan(wide.focusRange);
    expect(close.bokehScale).toBeGreaterThan(wide.bokehScale);
  });

  it('counts a telephoto lens as tightness and clamps extreme poses', () => {
    const normal = depthOfFieldForShot(1, 38, undefined);
    const tele = depthOfFieldForShot(1, 22, undefined);
    expect(tele.focusRange).toBeLessThan(normal.focusRange);
    expect(tele.bokehScale).toBeGreaterThan(normal.bokehScale);
    // Missing pan target falls back to the stage's framing anchor.
    expect(normal.focusTarget).toEqual([0, 1.05, 0]);
    // Zoom/fov outside the rig ranges clamp instead of exploding the lens.
    const extreme = depthOfFieldForShot(99, 5, [1, 2, 3]);
    expect(extreme.focusRange).toBeCloseTo(1.6, 5);
    expect(extreme.focusTarget).toEqual([1, 2, 3]);
  });
});

describe('rig grades', () => {
  it('grades the rig for each genre', () => {
    // Broadcast sets: contrasty key and a rim that separates talent from the wall.
    const news = rigGradeFor('news');
    expect(news.key).toBeGreaterThan(1);
    expect(news.rim).toBeGreaterThan(1);
    // Performance stages: punchy key in a dark room.
    const concert = rigGradeFor('concert');
    expect(concert.key).toBeGreaterThan(1.1);
    expect(concert.bounce).toBeLessThan(1);
    expect(concert.fill).toBeLessThan(1);
    // Home/talk: soft, bounce-heavy warmth.
    expect(rigGradeFor('home').fill).toBeGreaterThan(1);
    expect(rigGradeFor('home').bounce).toBeGreaterThan(1);
    // Noir chiaroscuro: ambient almost off, key does the work.
    const noir = rigGradeFor('cinematic');
    expect(noir.fill).toBeLessThan(0.75);
    expect(noir.bounce).toBeLessThan(0.8);
    expect(noir.key).toBeGreaterThan(noir.fill);
  });
});
