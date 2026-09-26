import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { shiftAccent } from '../../../../lib/prism/motionGraphics';
import {
  AmbientDust,
  GlowCore,
  ImpactFlash,
  LoopFade,
  MetalText,
  MotionEnvironment,
  MotionPostFx,
  MotionShaft,
  ParticleBurst,
  RuleLine,
  SpecSweep,
  VoidBackdrop,
  useMotionClock,
  type MotionSceneProps,
} from '../kit';
import { hiddenBrandKit } from '../../../../lib/prism/brandKit';
import { BrandMark } from '../BrandMark';
import { clamp01, easeInOutCubic, easeOutCubic, easeOutExpo, seg } from '../motionMath';

/**
 * GALAXY DRIFT — 8s end card over a real spiral galaxy plate.
 *
 * Unlike the Sovereign Outro's straight dolly, the camera here orbits slowly
 * around the mark while the galaxy rolls underneath, so the parallax between
 * the 3D chrome and the photographic plate does the heavy lifting.
 *
 * Timeline:
 *   0.0 – 1.0  plate settles, dust and shafts light up
 *   1.0 – 2.6  mark assembles, camera swings across
 *   2.6        impact: flash, particle burst, bloom spike
 *   2.8 – 4.4  wordmark rises out of the star field
 *   4.0 – 5.2  specular sweep across the metal
 *   5.2 – 6.4  tagline + rule line lock up
 *   6.4 – 8.0  hold (loops through a fade)
 */

export function GalaxyDrift({ headline, subline, accent, brand, overrides }: MotionSceneProps) {
  const clock = useMotionClock();
  const sweepLight = useRef<THREE.PointLight>(null);

  useFrame(() => {
    const light = sweepLight.current;
    if (!light) return;
    const p = clamp01((clock.t - 3.95) / 1.25);
    const active = p > 0 && p < 1;
    light.intensity = active ? Math.sin(Math.PI * p) * 32 : 0;
    light.visible = active;
    light.position.x = -5.5 + easeOutCubic(p) * 11;
  });

  return (
    <>
      <VoidBackdrop />
      <MotionEnvironment accent={accent} intensity={1.15} />
      <ambientLight intensity={0.3} />
      <spotLight position={[0, 6.5, 4]} angle={0.62} penumbra={0.85} intensity={24} color="#ffffff" distance={32} decay={1.9} />
      <pointLight
        ref={sweepLight}
        position={[-5.5, -1, 2.4]}
        color="#fffbe6"
        intensity={0}
        distance={26}
        decay={1.7}
        visible={false}
      />

      <GlowCore position={[0, 0.7, -3.6]} scale={17} color={accent} intensity={0.34} reveal={[0.2, 1.5]} boostAt={2.6} boost={2.6} />
      <MotionShaft position={[-3.6, 4.4, -2.6]} rotation={[0.24, 0, 0.4]} height={10} radius={2.3} color="#fff7ed" opacity={0.12} ignite={[0.3, 1.7]} />
      <MotionShaft position={[3.6, 4.4, -2.6]} rotation={[0.24, 0, -0.4]} height={10} radius={2.1} color={shiftAccent(accent, 0.35)} opacity={0.1} ignite={[0.5, 1.9]} />

      <AmbientDust count={700} radius={12} color={accent} size={0.052} drift={0.06} opacity={0.8} reveal={[0.3, 2]} />

      <BrandMark accent={accent} logo={overrides?.showLogo === false ? hiddenBrandKit(brand) : brand} assemble={[1, 2.6]} position={[0, 1.05, 0]} scale={0.62} spin={0.26} />

      <ImpactFlash at={2.6} width={0.3} strength={0.8} color="#fff7e8" position={[0, 1.05, 1.6]} scale={20} />
      <ParticleBurst count={820} color={accent} size={0.1} seed={58} spread={7.2} origin={[0, 1.05, 0]} window={[2.6, 4.2]} fadeOut={2.1} />

      <MetalText
        text={headline}
        accent={accent}
        size={0.72}
        position={[0, -1.05, 0]}
        letterSpacing={0.075}
        reveal={[2.8, 4.35]}
      />
      <SpecSweep window={[4, 5.2]} width={11} height={1.3} position={[0, -1.05, 0.42]} intensity={0.95} />
      <RuleLine y={-1.6} color={accent} from={4.6} to={5.6} width={5.8} />

      <MetalText
        text={subline}
        accent={shiftAccent(accent, 0.78)}
        size={0.18}
        position={[0, -1.92, 0]}
        letterSpacing={0.34}
        reveal={[5.2, 6.4]}
        rise={0.1}
        metalness={0.25}
        roughness={0.5}
      />

      <GalaxyCamera />
      <LoopFade from={7.2} to={7.95} />
      <MotionPostFx
        bloomIntensity={1}
        pulse={{ at: 2.6, width: 0.34, boost: 1.6 }}
        chroma={0.001}
        grain={0.055}
        vignette={0.75}
      />
    </>
  );
}

/** Slow orbit — the mark parallaxes against the photographic plate. */
function GalaxyCamera() {
  const clock = useMotionClock();
  const lookAt = useMemo(() => new THREE.Vector3(0, -0.05, 0), []);
  const desired = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera }, dt) => {
    const t = clock.t;
    const swing = seg(t, 0, 4.6, easeInOutCubic);
    const hold = seg(t, 4.6, 7.4, easeOutExpo);
    const ang = (0.42 - swing * 0.42) * (1 - hold);
    const radius = 6.4 + swing * 0.9 - hold * 0.5;
    desired.set(
      Math.sin(ang) * radius,
      0.45 - swing * 0.3 + Math.sin(t * 0.5) * 0.04,
      Math.cos(ang) * radius,
    );
    const perspective = camera as THREE.PerspectiveCamera;
    if (t < 0.12 || dt <= 0) {
      camera.position.copy(desired);
    } else {
      camera.position.lerp(desired, 1 - Math.exp(-4.5 * dt));
    }
    camera.lookAt(lookAt);
    const fov = 45 + swing * 2 - hold * 3;
    if (Math.abs(perspective.fov - fov) > 0.01) {
      perspective.fov = fov;
      perspective.updateProjectionMatrix();
    }
  });

  return null;
}
