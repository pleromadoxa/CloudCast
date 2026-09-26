/**
 * Backdrop catalog for the 3D motion graphics stage.
 *
 * Two families render behind a template:
 *  - procedural fields drawn by the WebGPU backdrop shader (galaxies, nebulae,
 *    star fields, a lit 3D globe, data grids, aurora curtains…), and
 *  - real footage / stills — public-domain Earth and deep-space imagery cut
 *    into seamless looping clips (see `tools/generate-motion-backgrounds.mjs`).
 *
 * Anything dropped into `public/motion/bg/` and re-exported through the
 * generated manifest shows up in the picker automatically.
 */
import { MOTION_ASSETS, type MotionAssetEntry } from './motionAssets.generated';

/** Shader programs understood by the backdrop renderer (WGSL + canvas fallback). */
export const BACKDROP_MODE = {
  /** Video / photo plate: cover-fit, slow parallax drift, graded. */
  media: 0,
  /** Log-spiral galaxy with a hot core and dust lanes. */
  galaxy: 1,
  /** Domain-warped volumetric nebula. */
  nebula: 2,
  /** Layered drifting star field. */
  starfield: 3,
  /** Lit 3D globe textured from the NASA equirectangular world map. */
  globe: 4,
  /** Perspective data-grid floor (world-desk look). */
  grid: 5,
  /** Aurora curtains over a polar night. */
  aurora: 6,
  /** Ink / plasma smoke. */
  smoke: 7,
} as const;

export type MotionBackdropKind = 'none' | 'procedural' | 'video' | 'image';

export interface MotionBackdropDefinition {
  id: string;
  name: string;
  kind: MotionBackdropKind;
  /** Shader mode for procedural plates; `media` for footage and stills. */
  mode: number;
  /** Media source path (video / image backdrops). */
  src?: string;
  /** Thumbnail for the picker. */
  poster?: string;
  credit?: string;
  tags: string[];
  blurb: string;
  /** CSS preview used by the picker when there is no thumbnail. */
  swatch: string;
}

/** Equirectangular world map — also available standalone for the globe. */
export const MOTION_EQUIRECT = MOTION_ASSETS.find((a) => a.kind === 'equirect')?.file;

const PROCEDURAL: MotionBackdropDefinition[] = [
  {
    id: 'none',
    name: 'Void',
    kind: 'none',
    mode: BACKDROP_MODE.media,
    tags: [],
    blurb: 'No backdrop — the template paints its own black void.',
    swatch: 'linear-gradient(135deg,#050508 0%,#0b0d16 100%)',
  },
  {
    id: 'nebula',
    name: 'Nebula',
    kind: 'procedural',
    mode: BACKDROP_MODE.nebula,
    tags: ['space', 'procedural'],
    blurb: 'Volumetric gas clouds warped by layered noise, tinted to the accent.',
    swatch: 'radial-gradient(120% 90% at 30% 20%,#7c3aed66,transparent 60%), radial-gradient(100% 80% at 75% 70%,#38bdf844,transparent 60%),#050510',
  },
  {
    id: 'galaxy',
    name: 'Galaxy',
    kind: 'procedural',
    mode: BACKDROP_MODE.galaxy,
    tags: ['space', 'procedural'],
    blurb: 'A rotating log-spiral galaxy with a hot core, dust lanes and stars.',
    swatch: 'radial-gradient(60% 60% at 50% 50%,#fde68a55,transparent 55%), radial-gradient(120% 120% at 50% 50%,#a78bfa44,transparent 70%),#04040c',
  },
  {
    id: 'star_field',
    name: 'Star Field',
    kind: 'procedural',
    mode: BACKDROP_MODE.starfield,
    tags: ['space', 'procedural'],
    blurb: 'Three parallax layers of twinkling stars drifting across the void.',
    swatch: 'radial-gradient(140% 120% at 70% 10%,#1e293b,transparent 60%),#02020a',
  },
  {
    id: 'world_globe',
    name: 'World Globe',
    kind: 'procedural',
    mode: BACKDROP_MODE.globe,
    tags: ['map', '3d', 'procedural'],
    blurb: 'Lit 3D globe with atmosphere rim, ocean glint and graticule lines.',
    swatch: 'radial-gradient(52% 52% at 50% 50%,#38bdf855,#0b1b34 70%,#04060f)',
  },
  {
    id: 'data_grid',
    name: 'Data Grid',
    kind: 'procedural',
    mode: BACKDROP_MODE.grid,
    tags: ['studio', 'procedural'],
    blurb: 'Perspective grid floor with a horizon glow — the world-desk floor.',
    swatch: 'linear-gradient(180deg,#04060f 0%,#0a1024 55%,#12305680 78%,#04060f 100%)',
  },
  {
    id: 'aurora',
    name: 'Aurora',
    kind: 'procedural',
    mode: BACKDROP_MODE.aurora,
    tags: ['sky', 'procedural'],
    blurb: 'Noise-driven aurora curtains rippling over a polar night.',
    swatch: 'linear-gradient(180deg,#02040c 0%,#062b2a 55%,#0b5e4a88 75%,#02040c 100%)',
  },
  {
    id: 'plasma_smoke',
    name: 'Plasma Smoke',
    kind: 'procedural',
    mode: BACKDROP_MODE.smoke,
    tags: ['abstract', 'procedural'],
    blurb: 'Slow-rolling ink smoke lit from behind by the accent colour.',
    swatch: 'radial-gradient(90% 70% at 40% 60%,#f5c45133,transparent 60%), radial-gradient(70% 60% at 70% 30%,#33415566,transparent 60%),#05060b',
  },
];

function fromAsset(asset: MotionAssetEntry): MotionBackdropDefinition {
  const isVideo = asset.kind === 'video';
  return {
    id: asset.id,
    name: asset.name,
    kind: isVideo ? 'video' : 'image',
    mode: BACKDROP_MODE.media,
    src: asset.file,
    poster: asset.poster,
    credit: asset.credit,
    tags: asset.tags,
    blurb: `${asset.name} — ${asset.credit}.`,
    swatch: asset.poster
      ? `url(${asset.poster}) center/cover`
      : 'linear-gradient(135deg,#0b0d14,#050508)',
  };
}

/** Real footage / still plates, minus the equirect texture (used by the globe). */
const MEDIA_ASSETS: MotionBackdropDefinition[] = MOTION_ASSETS.filter(
  (asset) => asset.kind !== 'equirect',
).map(fromAsset);

export const MOTION_BACKDROPS: MotionBackdropDefinition[] = [...PROCEDURAL, ...MEDIA_ASSETS];

export const MOTION_BACKDROP_IDS: string[] = MOTION_BACKDROPS.map((b) => b.id);

export function getMotionBackdrop(id: string | null | undefined): MotionBackdropDefinition {
  return MOTION_BACKDROPS.find((b) => b.id === id) ?? PROCEDURAL[0];
}

/** Backdrops worth showing as one-tap suggestions for a template. */
export function motionBackdropSuggestions(): MotionBackdropDefinition[] {
  return MOTION_BACKDROPS;
}
