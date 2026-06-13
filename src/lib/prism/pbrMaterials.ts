import * as THREE from 'three';
import { getProceduralTexture, type ProceduralTextureKind } from './proceduralTextures';

export interface PbrMaterialOptions {
  metalness?: number;
  roughness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
  normalScale?: number;
  envMapIntensity?: number;
}

export function pbrFromTexture(
  kind: ProceduralTextureKind,
  seed = 0,
  opts: PbrMaterialOptions = {},
): THREE.MeshStandardMaterial {
  const map = getProceduralTexture(kind, seed);
  return new THREE.MeshStandardMaterial({
    map,
    metalness: opts.metalness ?? (kind === 'metal_brushed' ? 0.85 : 0.05),
    roughness: opts.roughness ?? (kind === 'metal_brushed' ? 0.25 : kind.includes('fabric') || kind === 'leather' ? 0.82 : 0.55),
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
