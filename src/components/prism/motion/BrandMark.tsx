import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PrismBrandKit } from '../../../lib/prism/brandKit';
import { shiftAccent } from '../../../lib/prism/motionGraphics';
import { PrismMark, type PrismMarkProps } from './PrismMark';
import { MetalText, useMotionClock } from './kit';
import { useLogoTexture, logoPlaneSize } from './logoTexture';
import { backOut, clamp01, easeOutCubic, easeOutExpo, getRadialGlowTexture, seg } from './motionMath';

/**
 * The replaceable brand mark — renders the operator's uploaded logo (PNG /
 * SVG / JPG) with broadcast sign treatment: aspect-corrected plane, chrome
 * bevel frame, backlit edge glow and the same entrance timing as the
 * procedural `PrismMark`, which it falls back to when no logo is set.
 */
export interface BrandMarkProps {
  accent: string;
  /** Brand kit (or any subset) — `logoDataUrl` swaps in the uploaded logo. */
  logo?: Partial<PrismBrandKit> | null;
  position?: [number, number, number];
  scale?: number;
  /** [assembly start, assembly end] seconds on the timeline. */
  assemble?: [number, number];
  /** Sway rate once locked (rad/s). */
  spin?: number;
  /** Hidden until the timeline reaches the assembly window. */
  hideBefore?: boolean;
  /** Extra multiplier on the brand `logoScale` (template override). */
  logoScale?: number;
  thickness?: number;
  depth?: number;
  /** Render the brand wordmark line under the mark. */
  showWordmark?: boolean;
}

export function BrandMark({
  accent,
  logo,
  position = [0, 0, 0],
  scale = 1,
  assemble = [0.6, 2.4],
  spin = 0.18,
  hideBefore = true,
  logoScale = 1,
  thickness,
  depth,
  showWordmark = true,
}: BrandMarkProps) {
  const clock = useMotionClock();
  const dataUrl = logo?.logoDataUrl ?? null;
  const loaded = useLogoTexture(dataUrl);
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Group>(null);
  const glowMap = useMemo(() => getRadialGlowTexture(), []);

  const opacity = clamp01(logo?.logoOpacity ?? 1);
  const sizeMul = Math.max(0.1, (logo?.logoScale ?? 1) * logoScale);
  const wordmark = (logo?.wordmark ?? '').trim();
  const hasWordmark = showWordmark && wordmark.length > 0;
  const hideProcedural = logo?.hideProceduralMark === true;

  // Sign materials: glow halo + chrome bevel frame + the flat-lit logo plane.
  const mats = useMemo(() => {
    const glow = new THREE.MeshBasicMaterial({
      map: glowMap,
      color: accent,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      fog: false,
    });
    const frame = new THREE.MeshStandardMaterial({
      color: accent,
      metalness: 1,
      roughness: 0.22,
      envMapIntensity: 2.2,
      transparent: true,
      opacity: 0,
    });
    const image = new THREE.MeshBasicMaterial({
      map: loaded?.texture ?? null,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    return { glow, frame, image };
  }, [accent, glowMap, loaded]);
  useEffect(() => () => {
    mats.glow.dispose();
    mats.frame.dispose();
    mats.image.dispose();
  }, [mats]);

  /* eslint-disable react-hooks/immutability -- imperative Three.js scene updates in the render loop */
  useFrame(() => {
    const t = clock.t;
    const group = groupRef.current;
    if (!group) return;
    if (hideBefore && t < assemble[0]) {
      group.visible = false;
      return;
    }
    group.visible = true;
    group.position.set(position[0], position[1], position[2]);
    group.scale.setScalar(scale);

    // Entrance matches the prism assembly: hidden until the window opens, then
    // the sign settles out of depth into place and sways gently once locked.
    const p = clamp01(seg(t, assemble[0], assemble[1], (x) => backOut(x, 1.5)));
    const lock = clamp01(seg(t, assemble[0], assemble[1], easeOutExpo));
    const inner = innerRef.current;
    if (inner) {
      const inv = 1 - p;
      inner.position.set(0, -inv * 0.3, -inv * 0.55);
      inner.rotation.y = Math.sin(Math.max(0, t - assemble[0]) * spin * 2.4) * 0.24 * lock;
      inner.rotation.x = Math.sin(t * 0.5) * 0.045 * lock;
      inner.scale.setScalar((0.74 + 0.26 * p) * (1 + 0.018 * Math.sin(t * 1.1)));
    }

    const fade =
      clamp01(seg(t, assemble[0], assemble[0] + (assemble[1] - assemble[0]) * 0.6, easeOutCubic)) * opacity;
    mats.glow.opacity = fade * 0.32;
    mats.glow.visible = mats.glow.opacity > 0.004;
    mats.frame.opacity = fade;
    mats.frame.visible = fade > 0.004;
    mats.image.opacity = fade;
    mats.image.visible = fade > 0.004;
  });
  /* eslint-enable react-hooks/immutability */

  const wordmarkNode = hasWordmark ? (
    <MetalText
      text={wordmark}
      accent={logo?.secondaryAccent ?? shiftAccent(accent, 0.6)}
      size={0.22 * Math.max(0.6, sizeMul)}
      position={[0, loaded ? -((logoPlaneSize(loaded.aspect)[1] * sizeMul) / 2) - 0.34 : -0.9, 0.02]}
      letterSpacing={0.26}
      reveal={assemble}
      rise={0.07}
      metalness={0.6}
      roughness={0.35}
    />
  ) : null;

  // No uploaded logo: the procedural prism mark is the fallback — unless the
  // operator explicitly suppressed it (then only the wordmark remains).
  if (!loaded) {
    if (hideProcedural) {
      if (!hasWordmark) return null;
      return (
        <group position={position} scale={scale}>
          {wordmarkNode}
        </group>
      );
    }
    return (
      <PrismMark
        accent={accent}
        position={position}
        scale={scale}
        assemble={assemble}
        spin={spin}
        hideBefore={hideBefore}
        {...(thickness !== undefined ? { thickness } : {})}
        {...(depth !== undefined ? { depth } : {})}
      />
    );
  }

  const [pw, ph] = logoPlaneSize(loaded.aspect);
  const w = pw * sizeMul;
  const h = ph * sizeMul;

  return (
    <group ref={groupRef} visible={!hideBefore} position={position} scale={scale}>
      <group ref={innerRef}>
        {/* Backlit edge glow — the sign halo behind the mark. */}
        <mesh renderOrder={1} material={mats.glow}>
          <planeGeometry args={[w * 2.4, h * 2.4]} />
        </mesh>

        {/* Chrome bevel frame — four machined bars around the logo plate. */}
        <mesh position={[0, h / 2 + 0.018, -0.01]} renderOrder={2} material={mats.frame}>
          <boxGeometry args={[w + 0.05, 0.032, 0.05]} />
        </mesh>
        <mesh position={[0, -h / 2 - 0.018, -0.01]} renderOrder={2} material={mats.frame}>
          <boxGeometry args={[w + 0.05, 0.032, 0.05]} />
        </mesh>
        <mesh position={[-w / 2 - 0.018, 0, -0.01]} renderOrder={2} material={mats.frame}>
          <boxGeometry args={[0.032, h + 0.05, 0.05]} />
        </mesh>
        <mesh position={[w / 2 + 0.018, 0, -0.01]} renderOrder={2} material={mats.frame}>
          <boxGeometry args={[0.032, h + 0.05, 0.05]} />
        </mesh>

        {/* The logo itself — flat-lit so the brand colours stay true. */}
        <mesh renderOrder={3} material={mats.image}>
          <planeGeometry args={[w, h]} />
        </mesh>

        {wordmarkNode}
      </group>
    </group>
  );
}

export type { PrismMarkProps };
