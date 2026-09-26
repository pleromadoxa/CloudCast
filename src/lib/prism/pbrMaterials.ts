import * as THREE from 'three';
import {
  getProceduralMetalness,
  getProceduralNormal,
  getProceduralRoughness,
  getProceduralTexture,
  type ProceduralTextureKind,
} from './proceduralTextures';
import { getMicroMetalness, getMicroNormal, getMicroRoughness } from './proceduralTextures';

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
   * Upgrade to a `MeshPhysicalMaterial` with a clearcoat/energy-preserving
   * microfacet lobe — lacquer, glazed ceramic, polished stone.
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
}

export function pbrFromTexture(
  kind: ProceduralTextureKind,
  seed = 0,
  opts: PbrMaterialOptions = {},
): THREE.MeshStandardMaterial {
  const map = getProceduralTexture(kind, seed);
  const normalMap = getProceduralNormal(kind, seed);
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
  const roughnessMap = getProceduralRoughness(kind, seed, baseRoughness);
  const metalnessMap = getProceduralMetalness(kind, seed, baseMetalness);
  return new THREE.MeshStandardMaterial({
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
  });
}

/**
 * A solid-finish PBR surface with the complete map set — normal + roughness +
 * metallic — derived from a shared micro-surface so no material is a perfectly
 * flat plane. `metalness`/`roughness` scalars act as the base values; the maps
 * carry per-texel variation around them.
 */
export function pbrSolid(
  color: THREE.ColorRepresentation,
  opts: PbrMaterialOptions = {},
): THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial {
  const baseRoughness = opts.roughness ?? 0.5;
  const baseMetalness = opts.metalness ?? 0.1;
  const relief = opts.normalScale ?? (opts.bumpScale != null ? Math.min(2.6, opts.bumpScale * 60) : 1);
  const normalMap = relief > 0 ? getMicroNormal(Math.min(1.6, relief)) : null;
  const roughnessMap = getMicroRoughness(baseRoughness);
  const metalnessMap = getMicroMetalness(baseMetalness);

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
  };

  if (opts.physical) {
    return new THREE.MeshPhysicalMaterial({
      ...shared,
      clearcoat: opts.clearcoat ?? 0.4,
      clearcoatRoughness: opts.clearcoatRoughness ?? 0.3,
      ...(opts.sheen !== undefined ? { sheen: opts.sheen } : {}),
      ...(opts.sheenRoughness !== undefined ? { sheenRoughness: opts.sheenRoughness } : {}),
      ...(opts.sheenColor !== undefined ? { sheenColor: new THREE.Color(opts.sheenColor) } : {}),
      ...(opts.transmission !== undefined ? { transmission: opts.transmission } : {}),
      ...(opts.thickness !== undefined ? { thickness: opts.thickness } : {}),
      ...(opts.ior !== undefined ? { ior: opts.ior } : {}),
      ...(opts.reflectivity !== undefined ? { reflectivity: opts.reflectivity } : {}),
      ...(opts.iridescence !== undefined ? { iridescence: opts.iridescence } : {}),
    });
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

/** Lacquered wood — real grain under a thin polished topcoat. */
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

/** Low-iron glass with beveled-edge response — tabletops, shelves. */
export function glassMaterial(tint = '#eaf3f7', opacity = 0.16): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: tint,
    transparent: true,
    opacity,
    // Polished float glass: micro-relief is negligible at set distance, so the
    // maps stay near-neutral — present for a complete PBR set without frosting
    // the reflection.
    normalMap: getMicroNormal(0.12),
    normalScale: new THREE.Vector2(0.12, 0.12),
    roughnessMap: getMicroRoughness(0.04, 0.05),
    roughness: 1,
    metalnessMap: getMicroMetalness(0),
    metalness: 1,
    transmission: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.7,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

/** Brushed/painted metal with a soft anisotropic-ish response for legs/frames. */
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
    envMapIntensity: 1.5,
  });
}
