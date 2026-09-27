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
 * The grade transform — one display-referred sRGB colour in, graded colour out.
 *
 * Shared by both engines: the R3F stage bakes it into a 3D lookup texture and
 * the Babylon stage into the flat strip its `ColorGradingTexture` loads, so a
 * show's grade is the identical math wherever the set renders.
 */
export function gradeColor(
  r: number,
  g: number,
  b: number,
  grade: GradeLutInput,
): { r: number; g: number; b: number } {
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

  // 1 — white balance
  let r1 = r * gainR;
  let g1 = g * gainG;
  let b1 = b * gainB;

  // 2 — contrast about mid grey
  r1 = (r1 - pivot) * (1 + contrast) + pivot;
  g1 = (g1 - pivot) * (1 + contrast) + pivot;
  b1 = (b1 - pivot) * (1 + contrast) + pivot;

  // 3 — saturation + vibrance
  const lum = 0.2126 * r1 + 0.7152 * g1 + 0.0722 * b1;
  const chroma = Math.max(r1, g1, b1) - Math.min(r1, g1, b1);
  const vibMask = 1 - Math.min(1, chroma * 1.8);
  const sat = 1 + satDelta + vibDelta * vibMask;
  r1 = lum + (r1 - lum) * sat;
  g1 = lum + (g1 - lum) * sat;
  b1 = lum + (b1 - lum) * sat;

  return { r: clamp(r1, 0, 1), g: clamp(g1, 0, 1), b: clamp(b1, 0, 1) };
}

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

  for (let bz = 0; bz < size; bz += 1) {
    for (let gy = 0; gy < size; gy += 1) {
      for (let rx = 0; rx < size; rx += 1) {
        const i = (rx + gy * size + bz * size * size) * 4;
        const out = gradeColor(rx / s, gy / s, bz / s, grade);
        data[i] = out.r;
        data[i + 1] = out.g;
        data[i + 2] = out.b;
        data[i + 3] = 1;
      }
    }
  }

  return new LookupTexture(data, size);
}

/**
 * The same grade baked into a flat 2D LUT strip — width `size²`, height `size`,
 * the blue slices laid out left to right (slice `b` occupies columns
 * `[b·size, (b+1)·size)`, column-in-slice = red, row = green). This is the
 * layout Babylon's `ColorGradingTexture` loads, so the Babylon stage runs the
 * identical show LUT as the R3F stage.
 */
export function buildGradeStripCanvas(grade: GradeLutInput, size = 32): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size * size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const img = ctx.createImageData(canvas.width, canvas.height);
  const s = size - 1;
  for (let bz = 0; bz < size; bz += 1) {
    for (let gy = 0; gy < size; gy += 1) {
      for (let rx = 0; rx < size; rx += 1) {
        const out = gradeColor(rx / s, gy / s, bz / s, grade);
        const o = (gy * canvas.width + (bz * size + rx)) * 4;
        img.data[o] = Math.round(out.r * 255);
        img.data[o + 1] = Math.round(out.g * 255);
        img.data[o + 2] = Math.round(out.b * 255);
        img.data[o + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
