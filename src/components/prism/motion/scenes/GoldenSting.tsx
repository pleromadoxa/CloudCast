import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { shiftAccent } from '../../../../lib/prism/motionGraphics';
import {
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
  VoidBackdrop,
  useMotionClock,
  type MotionSceneProps,
} from '../kit';
import { BrandMark, hiddenBrandKit } from '../BrandMark';
import { clamp01, easeOutExpo, seg } from '../motionMath';

/**
 * GOLDEN STING — 3.5s impact sting.
 * The mark snaps together at triple speed, one hard flash, title punches on,
 * hold, then loop through black. Built for cuts and break bumps.
 */

export function GoldenSting({ headline, subline, accent, brand, overrides }: MotionSceneProps) {
  const clock = useMotionClock();
  const titleGroup = useRef<THREE.Group>(null);
  const lookAt = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const desired = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera }, dt) => {
    const settle = seg(clock.t, 0, 1.1, easeOutExpo);
    desired.set(
      Math.sin(clock.t * 0.5) * 0.08,
      0.12 - settle * 0.12,
      7.2 - settle * 2.6,
    );
    if (clock.t < 0.08 || dt <= 0) camera.position.copy(desired);
    else camera.position.lerp(desired, 1 - Math.exp(-9 * dt));
    camera.lookAt(lookAt);
    const cam = camera as THREE.PerspectiveCamera;
    const fov = 50 - settle * 4;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }

    const group = titleGroup.current;
    if (group) {
      const p = seg(clock.t, 1, 1.5, (x) => clamp01(1 - Math.pow(1 - x, 4)));
      group.visible = clock.t >= 1;
      group.scale.setScalar(0.7 + 0.3 * p);
    }
  });

  return (
    <>
      <VoidBackdrop />
      <MotionEnvironment accent={accent} intensity={1.2} />
      <ambientLight intensity={0.24} />
      <spotLight position={[0, 5.5, 4]} angle={0.7} penumbra={0.8} intensity={24} color="#ffffff" distance={26} decay={1.9} />
      <pointLight position={[-4, -1, 3]} intensity={12} color={accent} distance={22} decay={1.8} />

      <GlowCore position={[0, 0.3, -3.4]} scale={15} color={accent} intensity={0.32} reveal={[0, 0.7]} boostAt={0.92} boost={3} />
      <MotionShaft position={[-2.6, 4.2, -2]} rotation={[0.2, 0, 0.3]} height={8} radius={2} color="#fff7ed" opacity={0.14} ignite={[0, 0.5]} />
      <MotionShaft position={[2.6, 4.2, -2]} rotation={[0.2, 0, -0.3]} height={8} radius={2} color={accent} opacity={0.1} ignite={[0, 0.7]} />

      <BrandMark accent={accent} logo={overrides?.showLogo === false ? hiddenBrandKit(brand) : brand} assemble={[0.12, 0.85]} position={[0, 0.55, 0]} scale={0.72} spin={0.3} />

      <ImpactFlash at={0.92} width={0.22} strength={0.95} color="#fff7e8" position={[0, 0.55, 1.4]} scale={18} />
      <ShockRing at={0.92} duration={0.8} color={accent} maxRadius={6} position={[0, 0.55, 0.3]} />
      <ParticleBurst count={520} color={accent} size={0.09} seed={11} spread={7} origin={[0, 0.55, 0]} window={[0.92, 1.7]} fadeOut={1.1} />

      <group ref={titleGroup} visible={false}>
        <MetalText text={headline} accent={accent} size={0.52} position={[0, -1.35, 0]} letterSpacing={0.06} reveal={[1, 1.5]} rise={0.12} />
        <MetalText
          text={subline}
          accent={shiftAccent(accent, 0.7)}
          size={0.18}
          position={[0, -1.85, 0]}
          letterSpacing={0.3}
          reveal={[1.5, 2.1]}
          metalness={0.25}
          roughness={0.5}
        />
        <RuleLine y={-2.15} color={accent} from={1.6} to={2.2} width={3.4} />
      </group>

      <LoopFade from={3.1} to={3.45} />
      <MotionPostFx
        bloomIntensity={0.95}
        pulse={{ at: 0.92, width: 0.22, boost: 1.9 }}
        chroma={0.0016}
        grain={0.05}
        vignette={0.72}
      />
    </>
  );
}
