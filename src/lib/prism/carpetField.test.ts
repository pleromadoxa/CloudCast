import { describe, expect, it } from 'vitest';
import { carpetField, carpetLayAngle } from './carpetField';

function stats(values: Float32Array): { mean: number; variance: number } {
  let sum = 0;
  for (const v of values) sum += v;
  const mean = sum / values.length;
  let sq = 0;
  for (const v of values) sq += (v - mean) * (v - mean);
  return { mean, variance: sq / values.length };
}

function meanNeighbourDelta(values: Float32Array, size: number): number {
  let total = 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      total += Math.abs(values[y * size + ((x + 1) % size)] - values[y * size + x]);
    }
  }
  return total / values.length;
}

describe('carpet field — the physics every carpet map derives from', () => {
  it('produces real pile statistics instead of flat noise', () => {
    const { height, tone, wear } = carpetField(7, 128);
    for (const field of [height, tone, wear]) {
      for (const v of field) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
    // The pile actually rises and falls in tufts…
    const h = stats(height);
    expect(h.mean).toBeGreaterThan(0.25);
    expect(h.mean).toBeLessThan(0.75);
    expect(h.variance).toBeGreaterThan(0.002);
    // …the wool is heathered (multiple dye lots, not one flat colour)…
    expect(stats(tone).variance).toBeGreaterThan(0.002);
    // …and the floor has macro wear structure.
    expect(stats(wear).variance).toBeGreaterThan(0.001);
  });

  it('tiles without seams', () => {
    const size = 128;
    const { height, tone, wear } = carpetField(11, size);
    for (const field of [height, tone, wear]) {
      // The wrap-around neighbour delta must read like any interior delta —
      // a seam would spike it well above the mean step.
      const interior = meanNeighbourDelta(field, size);
      let seam = 0;
      for (let y = 0; y < size; y += 1) {
        seam += Math.abs(field[y * size] - field[y * size + (size - 1)]);
      }
      seam /= size;
      expect(seam).toBeLessThan(interior * 3 + 0.02);
    }
  });

  it('is deterministic per seed and distinct across seeds', () => {
    const a = carpetField(3, 64);
    const b = carpetField(3, 64);
    const c = carpetField(4, 64);
    expect(Array.from(a.height)).toEqual(Array.from(b.height));
    expect(Array.from(a.height)).not.toEqual(Array.from(c.height));
  });

  it('lays the pile in one direction that drifts with the wear', () => {
    // The pile lay is the axis the anisotropic sheen band smears along —
    // near-vertical in tangent space, drifting a few degrees with the wear.
    expect(carpetLayAngle(0.5)).toBeCloseTo(Math.PI / 2, 5);
    expect(carpetLayAngle(0)).toBeLessThan(Math.PI / 2);
    expect(carpetLayAngle(1)).toBeGreaterThan(Math.PI / 2);
    expect(Math.abs(carpetLayAngle(1) - carpetLayAngle(0))).toBeLessThan(0.5);
  });
});
