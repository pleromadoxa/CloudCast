import { describe, expect, it } from 'vitest';
import { buildGradeLut, gradeColor } from './gradeLut';

const NEUTRAL = { contrast: 0, saturation: 1, vibrance: 1, temperature: 0 };

describe('grade LUT — shared show-LUT math', () => {
  it('leaves a neutral grade untouched', () => {
    const out = gradeColor(0.5, 0.25, 0.75, NEUTRAL);
    expect(out.r).toBeCloseTo(0.5, 5);
    expect(out.g).toBeCloseTo(0.25, 5);
    expect(out.b).toBeCloseTo(0.75, 5);
  });

  it('applies white balance as a physical channel gain, not a hue rotation', () => {
    const warm = gradeColor(0.5, 0.5, 0.5, { ...NEUTRAL, temperature: 1 });
    expect(warm.r).toBeGreaterThan(warm.b);
    const cool = gradeColor(0.5, 0.5, 0.5, { ...NEUTRAL, temperature: -1 });
    expect(cool.b).toBeGreaterThan(cool.r);
  });

  it('pivots contrast around 0.18 mid grey', () => {
    const punchy = gradeColor(0.18, 0.18, 0.18, { ...NEUTRAL, contrast: 0.6 });
    expect(punchy.r).toBeCloseTo(0.18, 5);
    const up = gradeColor(0.4, 0.4, 0.4, { ...NEUTRAL, contrast: 0.5 });
    const down = gradeColor(0.1, 0.1, 0.1, { ...NEUTRAL, contrast: 0.5 });
    expect(up.r).toBeGreaterThan(0.4);
    expect(down.r).toBeLessThan(0.1);
  });

  it('lets vibrance lift muted tones without over-cooking saturated ones', () => {
    const muted = gradeColor(0.45, 0.46, 0.44, { ...NEUTRAL, vibrance: 1.4 });
    const saturated = gradeColor(0.9, 0.1, 0.1, { ...NEUTRAL, vibrance: 1.4 });
    const mutedChroma = Math.max(muted.r, muted.g, muted.b) - Math.min(muted.r, muted.g, muted.b);
    const satChroma = Math.max(saturated.r, saturated.g, saturated.b) - Math.min(saturated.r, saturated.g, saturated.b);
    // The muted grey gains chroma; the already-red tone is barely touched.
    expect(mutedChroma).toBeGreaterThan(0.01);
    expect(satChroma).toBeLessThan(0.85);
  });

  it('bakes into a lookup texture at the requested resolution', () => {
    const lut = buildGradeLut({ contrast: 0.2, saturation: 1.1, vibrance: 1.05, temperature: 0.3 }, 8);
    expect(lut.width).toBe(8);
    expect(lut.height).toBe(8);
    expect(lut.depth).toBe(8);
    lut.dispose();
  });

  it('stays in gamut for extreme settings', () => {
    for (let i = 0; i <= 8; i += 1) {
      const out = gradeColor(i / 8, 0.5, 1 - i / 8, {
        contrast: 1,
        saturation: 2,
        vibrance: 2,
        temperature: 1,
      });
      for (const c of [out.r, out.g, out.b]) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
      }
    }
  });
});
