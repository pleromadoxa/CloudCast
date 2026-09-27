/**
 * The carpet field — the numeric source every carpet surface is derived from.
 *
 * A real carpet is not a flat colour with noise on it. Up close it is thousands
 * of twisted yarn fibres standing in tufts: the pile height rises and falls in
 * clusters, the wool is *heathered* (each fibre carries a slightly different
 * dye lot, so the surface is a three- or four-tone mix, never one flat colour),
 * the pile leans one way and catches the key light as a directional sheen band,
 * and vacuuming leaves broad soft tracks across it.
 *
 * This module builds those three fields per texel — pile height, heather tone
 * and macro wear — as pure typed arrays on a wrapping lattice, so every map
 * derived from them (albedo, normal, roughness, displacement, anisotropy) is
 * tileable by construction and identical on every engine: the three.js bank,
 * the Babylon surface painters and the unit tests all read this one physics.
 */

export interface CarpetField {
  size: number;
  /** Tuft/pile height 0…1 — yarn bundle tops high, the backing valleys low. */
  height: Float32Array;
  /** Heather dye-lot tone 0…1 — per-cluster colour variation. */
  tone: Float32Array;
  /** Macro wear 0…1 — vacuum tracks, broad mottle, subtle soil. */
  wear: Float32Array;
}

/**
 * Value noise on a wrapping `cellsX × cellsY` lattice, bilinear-smoothstepped,
 * returned per texel in 0…1. Wraps by construction (indices modulo the lattice),
 * so anything composed from it tiles without seams.
 */
function latticeNoise(size: number, cellsX: number, cellsY: number, seed: number): Float32Array {
  const out = new Float32Array(size * size);
  const lattice = new Float32Array(cellsX * cellsY);
  let s = (seed * 16807 + 12345) % 2147483647;
  if (s <= 0) s += 2147483646;
  for (let i = 0; i < lattice.length; i += 1) {
    s = (s * 16807) % 2147483647;
    lattice[i] = (s & 0xffff) / 0xffff;
  }
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const fx = (x / size) * cellsX;
      const fy = (y / size) * cellsY;
      const x0 = Math.floor(fx) % cellsX;
      const y0 = Math.floor(fy) % cellsY;
      const x1 = (x0 + 1) % cellsX;
      const y1 = (y0 + 1) % cellsY;
      const tx = fx - Math.floor(fx);
      const ty = fy - Math.floor(fy);
      const sx = tx * tx * (3 - 2 * tx);
      const sy = ty * ty * (3 - 2 * ty);
      const v00 = lattice[y0 * cellsX + x0];
      const v10 = lattice[y0 * cellsX + x1];
      const v01 = lattice[y1 * cellsX + x0];
      const v11 = lattice[y1 * cellsX + x1];
      out[y * size + x] = v00 + (v10 - v00) * sx + (v01 - v00) * sy + (v00 - v10 - v01 + v11) * sx * sy;
    }
  }
  return out;
}

/**
 * Builds the carpet field at `size` texels.
 *
 * Composition, matching how the pile actually forms:
 *
 *  - **height** — mid-frequency tuft clusters (yarn bundles) shaped with a
 *    power curve so the tops are broad and the valleys pinch, plus anisotropic
 *    fibre striations running along the pile's lay (denser variation across
 *    the lay than along it) and a fine micro octave for individual fibres.
 *  - **tone** — independent dye-lot noise at tuft and fibre scale: the heather
 *    mix that stops wool reading as flat paint.
 *  - **wear** — very low-frequency mottle plus straight vacuum tracks (an
 *    integer-period sine along the track axis with a noise-wobbled phase).
 */
export function carpetField(seed: number, size = 256): CarpetField {
  // Tuft clusters + fibre lay + micro fibre.
  const tuft = latticeNoise(size, 16, 16, seed + 101);
  const fibre = latticeNoise(size, 64, 16, seed + 202); // stretched along the lay (y)
  const micro = latticeNoise(size, 96, 48, seed + 303);
  const broad = latticeNoise(size, 8, 8, seed + 404);

  // Heather dye lots.
  const toneTuft = latticeNoise(size, 12, 12, seed + 505);
  const toneFibre = latticeNoise(size, 48, 16, seed + 606);
  const toneMicro = latticeNoise(size, 64, 32, seed + 707);

  // Macro wear: mottle + straight vacuum tracks with wobbled phase.
  const wearMottle = latticeNoise(size, 3, 3, seed + 808);
  const wearWobble = latticeNoise(size, 6, 3, seed + 909);

  const height = new Float32Array(size * size);
  const tone = new Float32Array(size * size);
  const wear = new Float32Array(size * size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = y * size + x;

      // Pile height: cluster tops are broad, valleys pinch (power curve),
      // fibres ruffle the surface along the lay.
      const cluster = tuft[i] * 0.55 + broad[i] * 0.15;
      const shaped = Math.pow(Math.min(1, cluster + fibre[i] * 0.22 + micro[i] * 0.08), 1.18);
      height[i] = Math.min(1, Math.max(0, shaped));

      // Heather: tuft-scale dye lots with fibre-level streaks on top.
      tone[i] = toneTuft[i] * 0.5 + toneFibre[i] * 0.32 + toneMicro[i] * 0.18;

      // Vacuum tracks run straight across the pile; the phase wobbles slightly
      // so they never read as a printed stripe.
      const tracks = 0.5 + 0.5 * Math.sin(2 * Math.PI * (2 * y) / size + 3.1 * wearWobble[i]);
      wear[i] = Math.min(1, Math.max(0, wearMottle[i] * 0.62 + tracks * 0.38));
    }
  }

  return { size, height, tone, wear };
}

/**
 * The direction the pile leans in tangent space, in radians. Carpet pile is
 * laid in one direction when it is sheared and finished — this is the axis the
 * anisotropic sheen band smears along. The wear field bends it by a few degrees
 * across the surface so the sheen band drifts like real pile underfoot.
 */
export function carpetLayAngle(wear: number): number {
  return Math.PI / 2 + (wear - 0.5) * 0.42;
}
