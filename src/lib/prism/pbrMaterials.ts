import * as THREE from 'three';
import {
  getProceduralNormal,
  getProceduralRoughness,
  getProceduralTexture,
  type ProceduralTextureKind,
} from './proceduralTextures';

export interface PbrMaterialOptions {
  metalness?: number;
  roughness?: number;
  emissive?: string;
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
  // Per-texel roughness variation from the grain (green channel carries it).
  const roughnessMap = getProceduralRoughness(kind, seed, baseRoughness);
  return new THREE.MeshStandardMaterial({
    map,
    ...(normalMap && relief > 0
      ? { normalMap, normalScale: new THREE.Vector2(relief, relief) }
      : {}),
    metalness: opts.metalness ?? (kind === 'metal_brushed' ? 0.85 : 0.05),
    ...(roughnessMap ? { roughnessMap, roughness: 1 } : { roughness: baseRoughness }),
    emissive: opts.emissive ?? '#000000',
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: opts.transparent,
    opacity: opts.opacity,
    side: opts.side,
    envMapIntensity: opts.envMapIntensity ?? 1,
  });
}

export function pbrSolid(color: string, opts: PbrMaterialOptions = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: opts.metalness ?? 0.1,
    roughness: opts.roughness ?? 0.5,
    emissive: opts.emissive ?? '#000000',
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: opts.transparent,
    opacity: opts.opacity,
    side: opts.side,
    envMapIntensity: opts.envMapIntensity ?? 1,
  });
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
  const map = getProceduralTexture(kind, opts.seed ?? 5);
  const normalMap = getProceduralNormal(kind, opts.seed ?? 5);
  const roughnessMap = getProceduralRoughness(kind, opts.seed ?? 5, opts.roughness ?? 0.9);
  const mat = new THREE.MeshPhysicalMaterial({
    color,
    map: map ?? undefined,
    ...(normalMap ? { normalMap, normalScale: new THREE.Vector2(0.7, 0.7) } : {}),
    ...(roughnessMap ? { roughnessMap, roughness: 1 } : { roughness: opts.roughness ?? 0.9 }),
    metalness: 0,
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
  return new THREE.MeshPhysicalMaterial({
    color,
    map: map ?? undefined,
    ...(normalMap ? { normalMap, normalScale: new THREE.Vector2(0.9, 0.9) } : {}),
    roughness: 0.52,
    metalness: 0,
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
  return new THREE.MeshPhysicalMaterial({
    ...(map ? { map } : {}),
    ...(opts.color ? { color: opts.color } : {}),
    ...(normalMap ? { normalMap, normalScale: new THREE.Vector2(0.65, 0.65) } : {}),
    ...(roughnessMap ? { roughnessMap, roughness: 1 } : { roughness: 0.42 }),
    metalness: 0.02,
    clearcoat: opts.gloss ?? 0.5,
    clearcoatRoughness: 0.28,
    envMapIntensity: 1.15,
  });
}

/** Glazed ceramic — pots, vases, tableware. */
export function ceramicMaterial(color: string): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.24,
    metalness: 0,
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
    roughness: 0.04,
    metalness: 0,
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
    metalness: 0.92,
    roughness,
    clearcoat: 0.25,
    clearcoatRoughness: 0.3,
    envMapIntensity: 1.5,
  });
}
