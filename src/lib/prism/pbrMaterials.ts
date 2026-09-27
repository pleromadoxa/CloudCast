import * as THREE from 'three';
import {
  getProceduralAnisotropy,
  getProceduralDisplacement,
  getProceduralMetalness,
  getProceduralNormal,
  getProceduralRoughness,
  getProceduralTexture,
  getMicroAnisotropy,
  getMicroDisplacement,
  getMicroMetalness,
  getMicroNormal,
  getMicroRoughness,
  type ProceduralTextureKind,
} from './proceduralTextures';

export interface PbrMaterialOptions {
  metalness?: number;
  roughness?: number;
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
  /** Strength of the derived normal map (0 disables relief). */
  normalScale?: number;
  /**
   * Height relief for the surface — kept for callers; translated into the
   * derived normal map strength so lighting breaks up realistically across
   * wood grain, weave, veins and plaster.
   */
  bumpScale?: number;
  envMapIntensity?: number;
  /** Render without the display transform (LED walls, practicals, light cards). */
  toneMapped?: boolean;
  /** Flat-shaded facets (low-poly props). */
  flatShading?: boolean;
  depthWrite?: boolean;
  /** Explicit colour/AO map (e.g. a scanned carpet or soil texture). */
  map?: THREE.Texture | null;
  /**
   * Explicit data-map overrides. When omitted the shared procedural bank
   * derives them; a surface that knows its own physical maps (carpet pile,
   * scanned materials) passes them here and they win.
   */
  normalMap?: THREE.Texture | null;
  roughnessMap?: THREE.Texture | null;
  metalnessMap?: THREE.Texture | null;
  /** Fresnel-weighted specular strength — dielectric fabrics sit low (~0.2). */
  specularIntensity?: number;
  specularColor?: THREE.ColorRepresentation;
  /**
   * Upgrade to a `MeshPhysicalMaterial` with a clearcoat/energy-preserving
   * microfacet lobe — lacquer, glazed ceramic, polished stone. Also applied
   * automatically when anisotropy or refraction is requested (those lobes only
   * exist on the physical material).
   */
  physical?: boolean;
  clearcoat?: number;
  clearcoatRoughness?: number;
  /** Fabric microfibre sheen (physical materials only). */
  sheen?: number;
  sheenRoughness?: number;
  sheenColor?: THREE.ColorRepresentation;
  /** Refractive transmission (glass/water). */
  transmission?: number;
  thickness?: number;
  ior?: number;
  reflectivity?: number;
  iridescence?: number;
  /**
   * Anisotropic highlight strength (0–1) — brushed metal, silk, carpet pile:
   * the highlight smears along a grain direction instead of sitting as a round
   * dot. When no explicit `anisotropyMap` is given the grain field is derived
   * from the material's own texture (or the shared micro-surface for solids).
   */
  anisotropy?: number;
  /** Grain direction in tangent space, radians. */
  anisotropyRotation?: number;
  /** Explicit direction/strength field (RG direction, B strength). */
  anisotropyMap?: THREE.Texture | null;
  /**
   * Vertex displacement scale in metres — real geometric relief from the
   * height field. The mesh needs enough segments to resolve it (see
   * `scaledDisplacement`); otherwise use `bumpScale` relief instead.
   */
  displacement?: number;
  displacementBias?: number;
  displacementMap?: THREE.Texture | null;
  /** Per-wavelength IOR spread for refractive media (chromatic dispersion). */
  dispersion?: number;
  /** Absorption tint acquired after `attenuationDistance` metres of medium. */
  attenuationColor?: THREE.ColorRepresentation;
  attenuationDistance?: number;
}

/**
 * The wool-fibre BRDF every carpet gets, automatically. Wool is a dielectric
 * textile: it is *not* shiny paint with noise on it. What makes a floor read as
 * pile is the sheen lobe (fibre tips catch grazing light), a very low
 * dielectric specular, and highlights smeared along the pile lay — so these
 * terms are applied to every carpet surface regardless of call site, and callers
 * override per rug. Displacement is deliberately absent here: vertex relief
 * needs subdivided geometry and is requested by the surfaces that have it.
 */
export const CARPET_GRADE: PbrMaterialOptions = {
  physical: true,
  sheen: 1,
  sheenRoughness: 0.48,
  sheenColor: '#cfc4b6',
  specularIntensity: 0.22,
  anisotropy: 0.5,
  anisotropyRotation: 0,
};

export function pbrFromTexture(
  kind: ProceduralTextureKind,
  seed = 0,
  opts: PbrMaterialOptions = {},
): THREE.MeshStandardMaterial {
  // No call site can produce a flat-paint carpet — the wool BRDF is the
  // baseline and per-rug options layer on top.
  if (kind === 'carpet') opts = { ...CARPET_GRADE, ...opts };
  const map = getProceduralTexture(kind, seed);
  const normalMap = opts.normalMap ?? getProceduralNormal(kind, seed);
  // Legacy `bumpScale` (0.008–0.03) maps onto a sane normal-map range.
  const relief = opts.normalScale ?? (opts.bumpScale != null ? Math.min(2.6, opts.bumpScale * 60) : 1);
  const baseRoughness =
    opts.roughness ?? (kind === 'metal_brushed' ? 0.25 : kind.includes('fabric') || kind === 'leather' ? 0.82 : 0.55);
  const baseMetalness = opts.metalness ?? (kind === 'metal_brushed' ? 0.85 : 0.05);
  // Per-texel roughness + metallic variation from the grain (green channel
  // carries both, three samples roughnessMap/metalnessMap from green). The
  // scalar is pinned to 1 so the maps carry the real value — this is what makes
  // the surface a full PBR set (normal + roughness + metallic) rather than a
  // flat scalar.
  const roughnessMap = opts.roughnessMap ?? getProceduralRoughness(kind, seed, baseRoughness);
  const metalnessMap = opts.metalnessMap ?? getProceduralMetalness(kind, seed, baseMetalness);
  // Grain direction + height fields — anisotropic highlight smearing and real
  // vertex relief, both derived from the material's own grain.
  const anisotropyMap = opts.anisotropyMap ?? (opts.anisotropy ? getProceduralAnisotropy(kind, seed) : null);
  const displacementMap =
    opts.displacementMap ?? (opts.displacement ? getProceduralDisplacement(kind, seed) : null);

  const shared = {
    map,
    ...(normalMap && relief > 0
      ? { normalMap, normalScale: new THREE.Vector2(relief, relief) }
      : {}),
    ...(metalnessMap ? { metalnessMap, metalness: 1 } : { metalness: baseMetalness }),
    ...(roughnessMap ? { roughnessMap, roughness: 1 } : { roughness: baseRoughness }),
    emissive: opts.emissive ?? '#000000',
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: opts.transparent,
    opacity: opts.opacity,
    side: opts.side,
    envMapIntensity: opts.envMapIntensity ?? 1,
    ...(opts.toneMapped !== undefined ? { toneMapped: opts.toneMapped } : {}),
    ...(opts.flatShading !== undefined ? { flatShading: opts.flatShading } : {}),
    ...(opts.depthWrite !== undefined ? { depthWrite: opts.depthWrite } : {}),
    ...displacementParams(opts, displacementMap),
  };

  if (wantsPhysical(opts)) {
    return buildPhysical(shared, opts, anisotropyMap);
  }
  return new THREE.MeshStandardMaterial(shared);
}

/** True when an option needs the physical (microfacet) material to exist. */
function wantsPhysical(opts: PbrMaterialOptions): boolean {
  return (
    opts.physical === true ||
    opts.transmission !== undefined ||
    opts.anisotropy !== undefined ||
    opts.dispersion !== undefined ||
    opts.iridescence !== undefined ||
    // Fibre sheen and Fresnel-weighted specular are physical-material lobes.
    opts.sheen !== undefined ||
    opts.specularIntensity !== undefined
  );
}

/** Displacement relief params — only meaningful on subdivided geometry. */
function displacementParams(
  opts: PbrMaterialOptions,
  displacementMap: THREE.Texture | null | undefined,
): Partial<THREE.MeshStandardMaterialParameters> {
  if (!displacementMap) return {};
  const scale = opts.displacement ?? 0.01;
  return {
    displacementMap,
    displacementScale: scale,
    displacementBias: opts.displacementBias ?? -scale / 2,
  };
}

/** Anisotropic lobe + dispersion/absorption — physical-material-only fields. */
function buildPhysical(
  shared: THREE.MeshStandardMaterialParameters,
  opts: PbrMaterialOptions,
  anisotropyMap: THREE.Texture | null | undefined,
): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    ...shared,
    clearcoat: opts.clearcoat ?? (opts.physical ? 0.4 : 0),
    clearcoatRoughness: opts.clearcoatRoughness ?? 0.3,
    ...(opts.sheen !== undefined ? { sheen: opts.sheen } : {}),
    ...(opts.sheenRoughness !== undefined ? { sheenRoughness: opts.sheenRoughness } : {}),
    ...(opts.sheenColor !== undefined ? { sheenColor: new THREE.Color(opts.sheenColor) } : {}),
    // Fresnel-weighted dielectric specular — fabrics sit low, glazed/high-IOR
    // surfaces higher.
    ...(opts.specularIntensity !== undefined ? { specularIntensity: opts.specularIntensity } : {}),
    ...(opts.specularColor !== undefined ? { specularColor: new THREE.Color(opts.specularColor) } : {}),
    ...(opts.transmission !== undefined ? { transmission: opts.transmission } : {}),
    ...(opts.thickness !== undefined ? { thickness: opts.thickness } : {}),
    ...(opts.ior !== undefined ? { ior: opts.ior } : {}),
    ...(opts.reflectivity !== undefined ? { reflectivity: opts.reflectivity } : {}),
    ...(opts.iridescence !== undefined ? { iridescence: opts.iridescence } : {}),
    // Directional highlight smearing — direction/strength from the grain map.
    ...(opts.anisotropy !== undefined ? { anisotropy: opts.anisotropy } : {}),
    ...(opts.anisotropyRotation !== undefined ? { anisotropyRotation: opts.anisotropyRotation } : {}),
    ...(anisotropyMap ? { anisotropyMap } : {}),
    // Chromatic dispersion + medium absorption — real-world refraction.
    ...(opts.dispersion !== undefined ? { dispersion: opts.dispersion } : {}),
    ...(opts.attenuationColor !== undefined ? { attenuationColor: new THREE.Color(opts.attenuationColor) } : {}),
    ...(opts.attenuationDistance !== undefined ? { attenuationDistance: opts.attenuationDistance } : {}),
  });
}

/**
 * A solid-finish PBR surface with the complete map set — normal + roughness +
 * metallic — derived from a shared micro-surface so no material is a perfectly
 * flat plane. `metalness`/`roughness` scalars act as the base values; the maps
 * carry per-texel variation around them.
 *
 * Anisotropy, refraction (transmission + dispersion) and displacement promote
 * the material to a `MeshPhysicalMaterial` automatically — those lobes only
 * exist on the physical material.
 */
export function pbrSolid(
  color: THREE.ColorRepresentation,
  opts: PbrMaterialOptions = {},
): THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial {
  const baseRoughness = opts.roughness ?? 0.5;
  const baseMetalness = opts.metalness ?? 0.1;
  const relief = opts.normalScale ?? (opts.bumpScale != null ? Math.min(2.6, opts.bumpScale * 60) : 1);
  const normalMap = opts.normalMap ?? (relief > 0 ? getMicroNormal(Math.min(1.6, relief)) : null);
  const roughnessMap = opts.roughnessMap ?? getMicroRoughness(baseRoughness);
  const metalnessMap = opts.metalnessMap ?? getMicroMetalness(baseMetalness);
  // Grain + height fields for solid finishes — shared micro-surface maps.
  const anisotropyMap =
    opts.anisotropyMap ?? (opts.anisotropy ? getMicroAnisotropy() : null);
  const displacementMap =
    opts.displacementMap ?? (opts.displacement ? getMicroDisplacement() : null);

  const shared = {
    color,
    ...(opts.map ? { map: opts.map } : {}),
    ...(normalMap ? { normalMap, normalScale: new THREE.Vector2(relief, relief) } : {}),
    ...(roughnessMap ? { roughnessMap, roughness: 1 } : { roughness: baseRoughness }),
    ...(metalnessMap ? { metalnessMap, metalness: 1 } : { metalness: baseMetalness }),
    emissive: opts.emissive ?? '#000000',
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: opts.transparent,
    opacity: opts.opacity,
    side: opts.side,
    envMapIntensity: opts.envMapIntensity ?? 1,
    ...(opts.toneMapped !== undefined ? { toneMapped: opts.toneMapped } : {}),
    ...(opts.flatShading !== undefined ? { flatShading: opts.flatShading } : {}),
    ...(opts.depthWrite !== undefined ? { depthWrite: opts.depthWrite } : {}),
    ...displacementParams(opts, displacementMap),
  };

  if (wantsPhysical(opts)) {
    return buildPhysical(shared, opts, anisotropyMap);
  }
  return new THREE.MeshStandardMaterial(shared);
}

/** Alias — the canonical "full PBR surface" entry point used by `<PbrSurface>`. */
export const pbrSurface = pbrSolid;

/**
 * Injects the missing normal/roughness/metallic maps into a material, encoding
 * the authored scalar roughness/metalness into their maps (scalars pinned to 1)
 * so the value is preserved while the surface gains per-texel micro-variation.
 */
function applyMicroSurface(mat: THREE.MeshStandardMaterial): void {
  const relief = mat.normalScale?.x ?? 1;
  if (!mat.normalMap && relief > 0) {
    mat.normalMap = getMicroNormal(Math.min(1.6, relief));
    mat.normalScale = new THREE.Vector2(relief, relief);
  }
  if (!mat.roughnessMap) {
    mat.roughnessMap = getMicroRoughness(mat.roughness);
    mat.roughness = 1;
  }
  if (!mat.metalnessMap) {
    mat.metalnessMap = getMicroMetalness(mat.metalness);
    mat.metalness = 1;
  }
}

/**
 * Drop-in for `new THREE.MeshStandardMaterial(params)` that injects the full
 * PBR map set (normal + roughness + metallic) when the params don't already
 * provide them — so a raw `MeshStandardMaterial` call site becomes PBR-complete
 * without changing its parameter object.
 */
export function pbrStandard(
  params: THREE.MeshStandardMaterialParameters = {},
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial(params);
  applyMicroSurface(mat);
  return mat;
}

/** Drop-in for `new THREE.MeshPhysicalMaterial(params)` with the map set injected. */
export function pbrPhysical(
  params: THREE.MeshPhysicalMaterialParameters = {},
): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial(params);
  applyMicroSurface(mat);
  return mat;
}

/* ------------------------------------------- physical (microfacet) finishes */

/**
 * Woven upholstery with fabric sheen — the soft velvet/linen microfibre look
 * where grazing light picks up the nap of the cloth.
 */
export function upholsteryMaterial(
  color: string,
  opts: { kind?: ProceduralTextureKind; seed?: number; sheen?: number; sheenColor?: string; roughness?: number } = {},
): THREE.MeshPhysicalMaterial {
  const kind = opts.kind ?? 'fabric_velvet';
  const seed = opts.seed ?? 5;
  const map = getProceduralTexture(kind, seed);
  const normalMap = getProceduralNormal(kind, seed);
  const roughnessMap = getProceduralRoughness(kind, seed, opts.roughness ?? 0.9);
  const metalnessMap = getProceduralMetalness(kind, seed, 0);
  const mat = new THREE.MeshPhysicalMaterial({
    color,
    map: map ?? undefined,
    ...(normalMap ? { normalMap, normalScale: new THREE.Vector2(0.7, 0.7) } : {}),
    ...(roughnessMap ? { roughnessMap, roughness: 1 } : { roughness: opts.roughness ?? 0.9 }),
    ...(metalnessMap ? { metalnessMap, metalness: 1 } : { metalness: 0 }),
    sheen: opts.sheen ?? 1,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color(opts.sheenColor ?? '#cfc6bb'),
    // Woven cloth is anisotropic at the thread level — the weave smears the
    // highlight along warp/weft instead of leaving a round specular dot.
    anisotropy: 0.32,
    anisotropyMap: getProceduralAnisotropy(kind, seed),
    envMapIntensity: 0.8,
  });
  return mat;
}

/** Full-grain leather with a soft clearcoat and cellular grain relief. */
export function leatherMaterial(color: string, seed = 7): THREE.MeshPhysicalMaterial {
  const map = getProceduralTexture('leather', seed);
  const normalMap = getProceduralNormal('leather', seed);
  const roughnessMap = getProceduralRoughness('leather', seed, 0.52);
  const metalnessMap = getProceduralMetalness('leather', seed, 0);
  return new THREE.MeshPhysicalMaterial({
    color,
    map: map ?? undefined,
    ...(normalMap ? { normalMap, normalScale: new THREE.Vector2(0.9, 0.9) } : {}),
    ...(roughnessMap ? { roughnessMap, roughness: 1 } : { roughness: 0.52 }),
    ...(metalnessMap ? { metalnessMap, metalness: 1 } : { metalness: 0 }),
    clearcoat: 0.32,
    clearcoatRoughness: 0.42,
    envMapIntensity: 1.1,
  });
}

/** Lacquered wood — real grain under a thin polished topcoat, with grain relief. */
export function lacqueredWoodMaterial(
  kind: ProceduralTextureKind,
  seed = 1,
  opts: { color?: string; gloss?: number } = {},
): THREE.MeshPhysicalMaterial {
  const map = getProceduralTexture(kind, seed);
  const normalMap = getProceduralNormal(kind, seed);
  const roughnessMap = getProceduralRoughness(kind, seed, 0.42);
  const metalnessMap = getProceduralMetalness(kind, seed, 0.02);
  return new THREE.MeshPhysicalMaterial({
    ...(map ? { map } : {}),
    ...(opts.color ? { color: opts.color } : {}),
    ...(normalMap ? { normalMap, normalScale: new THREE.Vector2(0.65, 0.65) } : {}),
    ...(roughnessMap ? { roughnessMap, roughness: 1 } : { roughness: 0.42 }),
    ...(metalnessMap ? { metalnessMap, metalness: 1 } : { metalness: 0.02 }),
    clearcoat: opts.gloss ?? 0.5,
    clearcoatRoughness: 0.28,
    // Grain relief + anisotropic pore structure — grazing light walks across
    // the board instead of sliding off it.
    displacementMap: getProceduralDisplacement(kind, seed),
    displacementScale: 0.012,
    displacementBias: -0.006,
    anisotropy: 0.3,
    anisotropyMap: getProceduralAnisotropy(kind, seed),
    envMapIntensity: 1.15,
  });
}

/** Glazed ceramic — pots, vases, tableware. */
export function ceramicMaterial(color: string): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    normalMap: getMicroNormal(0.35),
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughnessMap: getMicroRoughness(0.24),
    roughness: 1,
    metalnessMap: getMicroMetalness(0),
    metalness: 1,
    clearcoat: 0.85,
    clearcoatRoughness: 0.16,
    envMapIntensity: 1.35,
  });
}

/**
 * Real refractive glass — the scene behind genuinely bends through the surface.
 * Transmission renders the world a second time through the material's IOR,
 * `dispersion` spreads the refraction per wavelength so edges fringe like real
 * float glass, and the Beer-Lambert absorption pair tints light by how far it
 * travelled through the medium.
 */
export function refractiveGlassMaterial(
  opts: {
    tint?: string;
    roughness?: number;
    thickness?: number;
    ior?: number;
    dispersion?: number;
    attenuationDistance?: number;
  } = {},
): THREE.MeshPhysicalMaterial {
  const tint = opts.tint ?? '#eaf3f7';
  return new THREE.MeshPhysicalMaterial({
    color: tint,
    transmission: 1,
    thickness: opts.thickness ?? 0.012,
    ior: opts.ior ?? 1.52,
    dispersion: opts.dispersion ?? 0.028,
    attenuationColor: new THREE.Color(tint),
    attenuationDistance: opts.attenuationDistance ?? 2.4,
    roughness: 1,
    metalness: 1,
    // Polished float glass: micro-relief is negligible at set distance, so the
    // maps stay near-neutral — present for a complete PBR set without frosting
    // the reflection. Scalars are pinned to 1 so the maps carry the value.
    normalMap: getMicroNormal(0.12),
    normalScale: new THREE.Vector2(0.12, 0.12),
    roughnessMap: getMicroRoughness(opts.roughness ?? 0.045, 0.05),
    metalnessMap: getMicroMetalness(0),
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.7,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

/**
 * Low-iron glass with beveled-edge response — tabletops, shelves, vessels.
 *
 * The legacy `opacity` argument (from the alpha-blend era) now scales the
 * medium's body: low values give a light thin pane, high values a heavy tinted
 * slab — while the background always genuinely refracts through the surface.
 */
export function glassMaterial(tint = '#eaf3f7', opacity = 0.16): THREE.MeshPhysicalMaterial {
  const glass = refractiveGlassMaterial({
    tint,
    // Thin pane for light bodies, thick slab for heavy ones.
    thickness: 0.004 + Math.max(0, Math.min(1, opacity)) * 0.04,
  });
  glass.opacity = Math.max(0.35, Math.min(1, opacity + 0.35));
  return glass;
}

/**
 * Brushed/painted metal with an anisotropic response for legs/frames — the
 * highlight smears along the tube's extrusion direction like real brushed
 * stock instead of sitting as a round dot.
 */
export function metalTubeMaterial(color = '#3f3f46', roughness = 0.32): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    normalMap: getMicroNormal(0.5),
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughnessMap: getMicroRoughness(roughness),
    roughness: 1,
    metalnessMap: getMicroMetalness(0.92),
    metalness: 1,
    clearcoat: 0.25,
    clearcoatRoughness: 0.3,
    anisotropy: 0.55,
    anisotropyRotation: Math.PI / 2,
    anisotropyMap: getMicroAnisotropy(0.8),
    envMapIntensity: 1.5,
  });
}

/**
 * Carpet pile — the canonical "very real carpet" surface. Every carpet in the
 * product funnels through here or through `pbrFromTexture('carpet')` (which
 * applies the same wool BRDF via `CARPET_GRADE`).
 *
 * What makes it read as real pile rather than textured paint:
 *
 *  - **Heathered wool albedo** — three dye lots plus flecks, pile self-shading
 *    baked between the tufts (see `carpetField`).
 *  - **Sheen lobe** — fibre tips catch grazing light (the velvet-like nap),
 *    tinted a lightened copy of the rug's colour so a red rug sheens red.
 *  - **Low dielectric specular (0.22)** — wool scatters; it never chrome-glints.
 *  - **Anisotropy along the pile lay** — the highlight smears the way the pile
 *    was laid when the carpet was finished, drifting a few degrees across the
 *    floor from the vacuum tracks.
 *  - **Tuft displacement** — real vertex relief from the pile height on
 *    subdivided geometry, with parallax-grade normal relief everywhere else.
 */
export function carpetMaterial(
  color = '#ffffff',
  seed = 4,
  opts: { repeat?: [number, number]; displacement?: number } = {},
): THREE.MeshPhysicalMaterial {
  const map = getProceduralTexture('carpet', seed);
  const normalMap = getProceduralNormal('carpet', seed);
  const roughnessMap = getProceduralRoughness('carpet', seed, 0.94);
  const metalnessMap = getProceduralMetalness('carpet', seed, 0);
  const anisotropyMap = getProceduralAnisotropy('carpet', seed);
  const displacementMap = getProceduralDisplacement('carpet', seed);
  // Sheen rides a lightened copy of the rug's own colour — grazing fibre tips
  // pick up the dye lot, not a fixed grey.
  const sheenColor = new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.42);
  const scale = opts.displacement ?? 0.018;

  // Per-surface tiling at physical scale: clone the shared bank so each rug
  // tiles without stretching one 256px canvas across a whole floor.
  const tile = <T extends THREE.Texture | null>(tex: T): T => {
    if (!tex || !opts.repeat) return tex;
    const clone = tex.clone();
    clone.wrapS = THREE.RepeatWrapping;
    clone.wrapT = THREE.RepeatWrapping;
    clone.repeat.set(opts.repeat[0], opts.repeat[1]);
    clone.needsUpdate = true;
    return clone as T;
  };

  return new THREE.MeshPhysicalMaterial({
    color,
    map: tile(map),
    ...(normalMap ? { normalMap: tile(normalMap), normalScale: new THREE.Vector2(1.9, 1.9) } : {}),
    roughnessMap: tile(roughnessMap),
    roughness: 1,
    metalnessMap: tile(metalnessMap),
    metalness: 1,
    sheen: 1,
    sheenRoughness: 0.48,
    sheenColor,
    specularIntensity: 0.22,
    anisotropy: 0.55,
    anisotropyRotation: 0,
    ...(anisotropyMap ? { anisotropyMap: tile(anisotropyMap) } : {}),
    ...(displacementMap
      ? {
          displacementMap: tile(displacementMap),
          displacementScale: scale,
          displacementBias: -scale / 2,
        }
      : {}),
    envMapIntensity: 0.55,
  });
}

/**
 * Carpet-grade surface props for `<PbrSurface>` consumers — the same wool
 * BRDF as `carpetMaterial`, as a spreadable prop bag:
 *
 *   `<PbrSurface color={rug} {...carpetPbrOptions()} />`
 */
export function carpetPbrOptions(seed = 4): PbrMaterialOptions {
  return {
    ...CARPET_GRADE,
    map: getProceduralTexture('carpet', seed),
    normalMap: getProceduralNormal('carpet', seed),
    roughnessMap: getProceduralRoughness('carpet', seed, 0.94),
    metalnessMap: getProceduralMetalness('carpet', seed, 0),
    anisotropyMap: getProceduralAnisotropy('carpet', seed),
    displacementMap: getProceduralDisplacement('carpet', seed),
    normalScale: 1.9,
    roughness: 1,
    metalness: 1,
    // Tuft relief: on flat geometry the extra vertices are cheap and the pile
    // genuinely lifts off the backing under grazing light.
    displacement: 0.018,
    displacementBias: -0.009,
    envMapIntensity: 0.55,
  };
}
