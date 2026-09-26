import { describe, expect, it } from 'vitest';
import {
  clampElementElevation,
  clampElementPosition,
  createPlacedElement,
  getStudioElement,
  isNonUniformScale,
  normalizeElementScale,
  spawnPosition,
  STAGE_BOUNDS,
  STUDIO_ELEMENTS,
  studioElementsForPlan,
} from './elementCatalog';

describe('element catalog', () => {
  it('ships a broad, de-duplicated library', () => {
    expect(STUDIO_ELEMENTS.length).toBeGreaterThanOrEqual(30);
    const ids = new Set(STUDIO_ELEMENTS.map((e) => e.id));
    expect(ids.size).toBe(STUDIO_ELEMENTS.length);
  });

  it('keeps every element grounded and physically plausible', () => {
    for (const def of STUDIO_ELEMENTS) {
      expect(def.elevation).toBeGreaterThanOrEqual(0);
      expect(def.elevation).toBeLessThanOrEqual(2.5);
      expect(def.scale).toBeGreaterThan(0);
      expect(def.footprint).toBeGreaterThan(0);
    }
  });

  it('locks nothing on free and everything on pro_master', () => {
    expect(studioElementsForPlan('free').every((e) => e.tier === 'free')).toBe(true);
    expect(studioElementsForPlan('pro_master')).toHaveLength(STUDIO_ELEMENTS.length);
    expect(studioElementsForPlan('pro').length).toBeGreaterThan(studioElementsForPlan('free').length);
  });

  it('clamps placement to the stage floor bounds', () => {
    expect(clampElementPosition(-99, -99)).toEqual([STAGE_BOUNDS.minX, STAGE_BOUNDS.minZ]);
    expect(clampElementPosition(99, 99)).toEqual([STAGE_BOUNDS.maxX, STAGE_BOUNDS.maxZ]);
    const [x, z] = spawnPosition(0);
    expect(x).toBeGreaterThanOrEqual(STAGE_BOUNDS.minX);
    expect(z).toBeLessThanOrEqual(STAGE_BOUNDS.maxZ);
  });

  it('spawns new elements without stacking', () => {
    expect(spawnPosition(0)).not.toEqual(spawnPosition(1));
    expect(spawnPosition(1)).not.toEqual(spawnPosition(6));
  });

  it('creates placed elements at the definition defaults', () => {
    const placed = createPlacedElement('monstera', 0);
    expect(placed).not.toBeNull();
    expect(placed?.scale).toBe(getStudioElement('monstera')?.scale);
    expect(placed?.rotation).toBe(0);
    expect(createPlacedElement('does_not_exist', 0)).toBeNull();
  });
});

describe('element transforms', () => {
  it('normalizes legacy uniform scales into vectors', () => {
    expect(normalizeElementScale(1.5)).toEqual([1.5, 1.5, 1.5]);
    expect(normalizeElementScale(undefined, 0.8)).toEqual([0.8, 0.8, 0.8]);
  });

  it('keeps per-axis scales independent and clamped', () => {
    expect(normalizeElementScale([1.2, 2, 0.5])).toEqual([1.2, 2, 0.5]);
    const clamped = normalizeElementScale([99, -3, Number.NaN], 1);
    expect(clamped[0]).toBe(4); // max
    expect(clamped[1]).toBe(0.2); // min
    expect(clamped[2]).toBe(1); // fallback for NaN
  });

  it('detects non-uniform stretch', () => {
    expect(isNonUniformScale(1)).toBe(false);
    expect(isNonUniformScale([1, 1, 1])).toBe(false);
    expect(isNonUniformScale([1, 1.5, 1])).toBe(true);
    expect(isNonUniformScale(undefined)).toBe(false);
  });

  it('clamps elevation to the stage rigging range', () => {
    expect(clampElementElevation(1.25)).toBe(1.25);
    expect(clampElementElevation(-1)).toBe(0);
    expect(clampElementElevation(12)).toBe(3);
    expect(clampElementElevation(Number.NaN)).toBe(0);
  });
});
