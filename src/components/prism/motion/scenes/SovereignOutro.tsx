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
  ShockRing,
  SpecSweep,
  VoidBackdrop,
  useMotionClock,
  type MotionSceneProps,
} from '../kit';
import { hiddenBrandKit } from '../../../../lib/prism/brandKit';
import { BrandMark } from '../BrandMark';
import { clamp01, easeInOutCubic, easeOutCubic, easeOutExpo, seg } from '../motionMath';

/**
 * SOVEREIGN OUTRO — the film-studio end card.
 *
 * Timeline (9s):
 *   0.0 – 1.4  void ignites: horizon glow, light shafts, gold dust
 *   0.7 – 3.1  six beams fly in and snap into the double-triangle prism mark
 *   2.95       impact: flash, shock ring, particle burst, bloom spike
 *   2.9 – 5.4  camera dollies out, wordmark rises, key light rakes the metal
 *   4.4 – 5.4  specular sweep crosses the wordmark
 *   5.3 – 6.5  tagline + rule line lock up under the mark
 *   6.5 – 9.0  hold the end card (loops through a fade when looping)
 */

function SovereignCamera() {  const clock = useMotionClock();
  const lookAt = useMemo(() => new THREE.Vector3(0, -0.15, 0), []);
  const desired = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera }, dt) => {
    const t = clock.t;
    const push = seg(t, 0, 2.85, easeInOutCubic);
    const pull = seg(t, 2.85, 5.4, easeOutExpo);
    const z = 3.4 + push * 0.85 + pull * 3.15;
    const y = 0.34 - push * 0.08 - pull * 0.42 + Math.sin(t * 0.45) * 0.035;
    const x = Math.sin(t * 0.24) * (0.1 + pull * 0.22);
    desired.set(x, y, z);
    const perspective = camera as THREE.PerspectiveCamera;
    if (t < 0.12 || dt <= 0) {
      camera.position.copy(desired);
    } else {
      camera.position.lerp(desired, 1 - Math.exp(-5.5 * dt));
    }
    camera.lookAt(lookAt);
    const fov = 47 - pull * 3.5;
    if (Math.abs(perspective.fov - fov) > 0.01) {
      perspective.fov = fov;
      perspective.updateProjectionMatrix();
    }
  });

  return null;
}

/** The Regal Prism end card — mark assembly, wordmark sweep, tagline lockup. */
export function SovereignOutro({ headline, subline, accent, brand, overrides }: MotionSceneProps) {
  const clock = useMotionClock();
  const sweepLight = useRef<THREE.PointLight>(null);
  const markPosition = useMemo<[number, number, number]>(() => [0, 0.9, 0], []);

  useFrame(() => {
    const light = sweepLight.current;
    if (!light) return;
    // Key light travels across the wordmark — the gleam on the metal.
    const p = clamp01((clock.t - 4.3) / 1.2);
    const active = p > 0 && p < 1;
    light.intensity = active ? Math.sin(Math.PI * p) * 34 : 0;
    light.visible = active;
    light.position.x = -5 + easeOutCubic(p) * 10;
  });

  return (
    <>
      <VoidBackdrop />
      <MotionEnvironment accent={accent} intensity={1.1} />
      <ambientLight intensity={0.2} />
      <pointLight
        ref={sweepLight}
        position={[-5, -1.1, 2.2]}
        color="#fffbe6"
        intensity={0}
        distance={26}
        decay={1.7}
        visible={false}
      />
      <spotLight position={[0, 6.5, 4]} angle={0.6} penumbra={0.85} intensity={26} color="#ffffff" distance={30} decay={1.9} />

      <GlowCore
        position={[0, 0.6, -3.2]}
        scale={16}
        color={accent}
        intensity={0.3}
        reveal={[0.3, 1.7]}
        boostAt={2.95}
        boost={2.4}
      />
      <MotionShaft position={[-3.1, 4.6, -2.2]} rotation={[0.22, 0, 0.34]} height={9} radius={2.2} color="#fff7ed" opacity={0.13} ignite={[0.25, 1.6]} />
      <MotionShaft position={[3.1, 4.6, -2.2]} rotation={[0.22, 0, -0.34]} height={9} radius={2.2} color="#fff7ed" opacity={0.13} ignite={[0.4, 1.8]} />
      <MotionShaft position={[0, 5.4, -3.4]} rotation={[0.1, 0, 0]} height={11} radius={2.6} color={accent} opacity={0.08} ignite={[0.6, 2.2]} />

      <AmbientDust count={620} radius={11} color={accent} size={0.055} drift={0.045} opacity={0.75} reveal={[0.5, 2.4]} />

      <BrandMark accent={accent} logo={overrides?.showLogo === false ? hiddenBrandKit(brand) : brand} assemble={[0.7, 2.7]} position={markPosition} scale={0.95} spin={0.16} />

      <ImpactFlash at={2.95} width={0.3} strength={0.85} color="#fff7e8" position={[0, 0.9, 1.6]} scale={20} />
      <ShockRing at={2.95} duration={1.2} color={accent} maxRadius={6.5} position={[0, 0.9, 0.4]} />
      <ParticleBurst count={850} color={accent} size={0.1} seed={42} spread={7.5} origin={[0, 0.9, 0]} window={[2.95, 4.7]} fadeOut={2.4} />

      <MetalText
        text={headline}
        accent={accent}
        size={0.68}
        position={[0, -1.2, 0]}
        letterSpacing={0.07}
        reveal={[3.3, 4.75]}
      />
      <SpecSweep window={[4.35, 5.5]} width={10} height={1.2} position={[0, -1.2, 0.4]} intensity={0.95} />

      <MetalText
        text={subline}
        accent={shiftAccent(accent, 0.72)}
        size={0.2}
        position={[0, -1.82, 0]}
        letterSpacing={0.3}
        reveal={[5.35, 6.6]}
        rise={0.1}
        metalness={0.2}
        roughness={0.5}
      />
      <RuleLine y={-2.14} color={accent} from={5.6} to={6.8} />

      <SovereignCamera />
      <LoopFade from={8.2} to={8.95} />
      <MotionPostFx
        bloomIntensity={0.9}
        pulse={{ at: 2.95, width: 0.34, boost: 1.5 }}
        chroma={0.0009}
        grain={0.055}
        vignette={0.75}
      />
    </>
  );
}
