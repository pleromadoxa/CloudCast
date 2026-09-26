import { describe, expect, it } from 'vitest';
import { LETTER_STAGGER, layoutExtrudedText } from './extrudedText';

describe('layoutExtrudedText', () => {
  it('extrudes every glyph of a headline and measures the line', () => {
    const layout = layoutExtrudedText('REGAL PRISM', 0.07, 'center');
    expect(layout).not.toBeNull();
    if (!layout) return;

    // Ten drawable glyphs — the space advances the cursor but emits no mesh.
    expect(layout.letters).toHaveLength(10);
    expect(layout.width).toBeGreaterThan(0);
    expect(Number.isFinite(layout.centerY)).toBe(true);

    const xs = layout.letters.map((letter) => letter.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    // Centred line starts half a line-width to the left of the anchor.
    expect(layout.letters[0].x).toBeCloseTo(-layout.width / 2, 5);
  });

  it('anchors a left-aligned lower third at the origin', () => {
    const layout = layoutExtrudedText('AMARA OKAFOR', 0.04, 'left');
    expect(layout).not.toBeNull();
    if (!layout) return;
    expect(layout.letters[0].x).toBe(0);
    expect(layout.width).toBeGreaterThan(0);
  });

  it('adds tracking only between glyphs', () => {
    const tight = layoutExtrudedText('WORLD REPORT', 0, 'center');
    const loose = layoutExtrudedText('WORLD REPORT', 0.3, 'center');
    expect(tight && loose).toBeTruthy();
    if (!tight || !loose) return;
    expect(loose.width - tight.width).toBeCloseTo(0.3 * 11, 4);
  });

  it('staggers letters across the head of the reveal window', () => {
    const layout = layoutExtrudedText('GALAXY DRIFT', 0.05, 'center');
    expect(layout).not.toBeNull();
    if (!layout) return;
    const delays = layout.letters.map((letter) => letter.delay);
    expect(Math.min(...delays)).toBe(0);
    expect(Math.max(...delays)).toBeCloseTo(LETTER_STAGGER, 4);
    expect(new Set(delays).size).toBeGreaterThan(1);
  });

  it('falls back to raster text for glyphs the typeface cannot draw', () => {
    expect(layoutExtrudedText('Orbit \u{1F680}', 0.06, 'center')).toBeNull();
    expect(layoutExtrudedText('', 0.06, 'center')).toBeNull();
  });

  it('reuses cached glyph geometry across calls', () => {
    const a = layoutExtrudedText('ORBIT REVEAL', 0.07, 'center');
    const b = layoutExtrudedText('ORBIT REVEAL', 0.07, 'center');
    expect(a && b).toBeTruthy();
    if (!a || !b) return;
    expect(a.letters[0].geometry).toBe(b.letters[0].geometry);
  });
});
