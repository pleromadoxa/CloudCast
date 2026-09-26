import { useMemo } from 'react';
import type * as THREE from 'three';
import { pbrSurface, type PbrMaterialOptions } from '../../../lib/prism/pbrMaterials';

/**
 * A lit PBR surface material with the complete map set — normal + roughness +
 * metallic — attached automatically from the shared micro-surface.
 *
 * Drop-in replacement for a bare `<meshStandardMaterial … />` or
 * `<meshPhysicalMaterial … />`: it takes the same surface props (color, map,
 * roughness, metalness, clearcoat, sheen, emissive…) but always ships a full PBR
 * texture set so light breaks across the micro-relief instead of sliding off a
 * perfectly flat plane. Memoised per prop signature so repeated instances in a
 * scene share one material (materials are the expensive part of a render).
 *
 * Emissive light cards / LED screens are *not* run through this — a display is a
 * light emitter, physically correct as an unlit emissive, so those stay
 * `meshBasicMaterial` primitives.
 */
export interface PbrSurfaceProps extends PbrMaterialOptions {
  color?: THREE.ColorRepresentation;
}

export function PbrSurface(props: PbrSurfaceProps) {
  const {
    color = '#808080',
    map,
    roughness,
    metalness,
    envMapIntensity,
    emissive,
    emissiveIntensity,
    transparent,
    opacity,
    side,
    normalScale,
    bumpScale,
    toneMapped,
    flatShading,
    depthWrite,
    physical,
    clearcoat,
    clearcoatRoughness,
    sheen,
    sheenRoughness,
    sheenColor,
    transmission,
    thickness,
    ior,
    reflectivity,
    iridescence,
  } = props;
  const material = useMemo(
    () =>
      pbrSurface(color, {
        map,
        roughness,
        metalness,
        envMapIntensity,
        emissive,
        emissiveIntensity,
        transparent,
        opacity,
        side,
        normalScale,
        bumpScale,
        toneMapped,
        flatShading,
        depthWrite,
        physical,
        clearcoat,
        clearcoatRoughness,
        sheen,
        sheenRoughness,
        sheenColor,
        transmission,
        thickness,
        ior,
        reflectivity,
        iridescence,
      }),
    [
      color,
      map,
      roughness,
      metalness,
      envMapIntensity,
      emissive,
      emissiveIntensity,
      transparent,
      opacity,
      side,
      normalScale,
      bumpScale,
      toneMapped,
      flatShading,
      depthWrite,
      physical,
      clearcoat,
      clearcoatRoughness,
      sheen,
      sheenRoughness,
      sheenColor,
      transmission,
      thickness,
      ior,
      reflectivity,
      iridescence,
    ],
  );
  return <primitive object={material as THREE.Material} attach="material" />;
}

export default PbrSurface;
