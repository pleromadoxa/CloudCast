import { LookupTexture } from 'postprocessing';
import type { ColorGradeSettings } from './types';

/** The grading controls baked into the LUT (exposure is applied at the lens). */
export type GradeLutInput = Pick<ColorGradeSettings, 'contrast' | 'saturation' | 'vibrance' | 'temperature'>;

/**
 * LUT-based colour grading.
 *
 * The display-space grade (white balance / contrast / saturation / vibrance) is
 * baked into a 3D lookup texture and applied by the `postprocessing` LUT effect
 * with tetrahedral interpolation — the same pipeline a real DI suite uses when
 * it prints a `.cube` LUT for a show LUT. Baking the grade into a LUT (instead
 * of chaining per-adjustment effects) means every template gets the identical,
 * film-consistent transform, it stays cheap on the GPU (one 3D texture fetch),
 * and the look can later be swapped for a creative `.cube` without touching the
 * stage.
 *
 * The LUT is authored over display-referred sRGB (after the tone map), matching
 * where a show LUT sits in a real colour-managed pipeline.
 */

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/**
 * Build the grading LUT for the given engine grade.
 *
 * Voxel layout follows `LookupTexture`'s contract (verified against its own
 * `applyLUT`): the texel at linear index `x + y·size + z·size²` stores the
 * output colour for the input `(x, y, z)/(size-1)`.
 */
export function buildGradeLut(grade: GradeLutInput, size = 32): LookupTexture {
  const data = new Float32Array(size * size * size * 4);
  const s = size - 1;

  // Colour temperature as a physical white-balance gain: warm pushes toward
  // amber (more red, less blue), cool toward blue — the same channel balance a
  // Kelvin CCT shift produces, not a hue rotation.
  const temp = clamp(grade.temperature, -1, 1);
  const gainR = 1 + temp * 0.12;
  const gainG = 1 + temp * 0.015;
  const gainB = 1 - temp * 0.12;

  // −1..1 pivot contrast around 0.18 mid grey (the engine's documented pivot).
  const contrast = clamp(grade.contrast, -1, 1);
  const pivot = 0.18;

  // Saturation (0..2) plus a low-chroma-weighted vibrance (0..2): vibrance lifts
  // muted tones without over-cooking skin/already-saturated colours.
  const satDelta = clamp(grade.saturation - 1, -1, 1);
  const vibDelta = clamp(grade.vibrance - 1, -1, 1);

  for (let bz = 0; bz < size; bz += 1) {
    for (let gy = 0; gy < size; gy += 1) {
      for (let rx = 0; rx < size; rx += 1) {
        const i = (rx + gy * size + bz * size * size) * 4;
        let r = rx / s;
        let g = gy / s;
        let b = bz / s;

        // 1 — white balance
        r *= gainR;
        g *= gainG;
        b *= gainB;

        // 2 — contrast about mid grey
        r = (r - pivot) * (1 + contrast) + pivot;
        g = (g - pivot) * (1 + contrast) + pivot;
        b = (b - pivot) * (1 + contrast) + pivot;

        // 3 — saturation + vibrance
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const chroma = Math.max(r, g, b) - Math.min(r, g, b);
        const vibMask = 1 - Math.min(1, chroma * 1.8);
        const sat = 1 + satDelta + vibDelta * vibMask;
        r = lum + (r - lum) * sat;
        g = lum + (g - lum) * sat;
        b = lum + (b - lum) * sat;

        data[i] = clamp(r, 0, 1);
        data[i + 1] = clamp(g, 0, 1);
        data[i + 2] = clamp(b, 0, 1);
        data[i + 3] = 1;
      }
    }
  }

  return new LookupTexture(data, size);
}
