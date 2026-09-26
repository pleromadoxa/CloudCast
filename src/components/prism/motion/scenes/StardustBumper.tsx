import { useEffect, useMemo, useRef } from 'react';
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
  RuleLine,
  ShockRing,
  VoidBackdrop,
  useMotionClock,
  type MotionSceneProps,
} from '../kit';
import {
  backOut,
  clamp01,
  easeInOutCubic,
  easeOutExpo,
  getParticleSprite,
  mulberry32,
  seg,
} from '../motionMath';

/**
 * STARDUST BUMPER — 7s.
 * A galaxy of dust sucks into a single point of light, detonates, and the
 * title materialises out of the blast.
 */

function CollapsingDust({ accent, collapseEnd }: { accent: string; collapseEnd: number }) {
  const clock = useMotionClock();
  const ref = useRef<THREE.Points>(null);
  const { geometry, material, base } = useMemo(() => {
    const rand = mulberry32(909);
    const count = 1400;
    const base = new Float32Array(count * 4); // xyz dir + radius
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      const r = 5 + rand() * 7;
      base[i * 4] = Math.sin(phi) * Math.cos(theta);
      base[i * 4 + 1] = Math.sin(phi) * Math.sin(theta) * 0.75;
      base[i * 4 + 2] = Math.cos(phi);
      base[i * 4 + 3] = r;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      map: getParticleSprite(),
      size: 0.085,
      color: accent,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      sizeAttenuation: true,
    });
    return { geometry, material, base };
  }, [accent]);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  /* eslint-disable react-hooks/immutability -- imperative Three.js scene updates in the render loop */
  useFrame(() => {
    const points = ref.current;
    if (!points) return;
    const t = clock.t;
    const attr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const count = base.length / 4;

    if (t < collapseEnd) {
      // converge: radius shrinks to nothing
      const p = easeInOutCubic(clamp01(t / collapseEnd));
      for (let i = 0; i < count; i++) {
        const r = base[i * 4 + 3] * (1 - p);
        arr[i * 3] = base[i * 4] * r;
        arr[i * 3 + 1] = base[i * 4 + 1] * r;
        arr[i * 3 + 2] = base[i * 4 + 2] * r;
      }
      material.opacity = 0.25 + 0.7 * clamp01(t / 1.2);
    } else {
      // detonate outward on easeOutExpo
      const p = easeOutExpo(clamp01((t - collapseEnd) / 1.9));
      const spread = 8.5 * p;
      for (let i = 0; i < count; i++) {
        arr[i * 3] = base[i * 4] * spread;
        arr[i * 3 + 1] = base[i * 4 + 1] * spread;
        arr[i * 3 + 2] = base[i * 4 + 2] * spread;
      }
      material.opacity = 0.95 * (1 - clamp01((t - collapseEnd - 0.8) / 2.4));
    }
    attr.needsUpdate = true;
    points.visible = material.opacity > 0.005;
  });
  /* eslint-enable react-hooks/immutability */

  return <points ref={ref} geometry={geometry} material={material} visible={false} />;
}

export function StardustBumper({ headline, subline, accent }: MotionSceneProps) {
  const clock = useMotionClock();
  const titleGroup = useRef<THREE.Group>(null);
  const lookAt = useMemo(() => new THREE.Vector3(0, -0.15, 0), []);
  const desired = useMemo(() => new THREE.Vector3(), []);
  const collapseEnd = 3;

  useFrame(({ camera }, dt) => {
    const push = seg(clock.t, 0, 3, easeInOutCubic);
    const rebound = seg(clock.t, 3, 4.6, easeOutExpo);
    desired.set(
      Math.sin(clock.t * 0.3) * 0.1,
      0.05,
      7.4 - push * 1.6 + rebound * 0.9,
    );
    if (clock.t < 0.12 || dt <= 0) camera.position.copy(desired);
    else camera.position.lerp(desired, 1 - Math.exp(-5 * dt));
    camera.lookAt(lookAt);
    const cam = camera as THREE.PerspectiveCamera;
    const fov = 50 - rebound * 3;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }

    const group = titleGroup.current;
    if (group) {
      const p = seg(clock.t, 3.2, 4.5, (x) => backOut(x, 1.5));
      group.scale.setScalar(0.72 + 0.28 * clamp01(p));
      group.visible = clock.t > 3.2;
    }
  });

  return (
    <>
      <VoidBackdrop />
      <MotionEnvironment accent={accent} />
      <ambientLight intensity={0.24} />
      <directionalLight position={[2, 4, 6]} intensity={1.5} color="#ffffff" />
      <directionalLight position={[-4, -3, 2]} intensity={0.6} color={accent} />

      <GlowCore
        position={[0, 0, -3]}
        scale={14}
        color={accent}
        intensity={0.12}
        reveal={[0.4, 2.6]}
        boostAt={collapseEnd}
        boost={7}
      />
      <AmbientDust count={380} radius={13} color={shiftAccent(accent, 0.55)} size={0.045} drift={0.05} opacity={0.45} reveal={[0.3, 2]} />
      <CollapsingDust accent={accent} collapseEnd={collapseEnd} />

      <ImpactFlash at={collapseEnd} width={0.28} strength={0.95} color="#ffffff" scale={22} />
      <ShockRing at={collapseEnd} duration={1.3} color={accent} maxRadius={7} />

      <group ref={titleGroup} visible={false}>
        <MetalText text={headline} accent={accent} size={0.66} position={[0, 0.15, 0]} letterSpacing={0.05} reveal={[3.2, 4.5]} />
        <MetalText
          text={subline}
          accent={shiftAccent(accent, 0.7)}
          size={0.2}
          position={[0, -0.55, 0]}
          letterSpacing={0.3}
          reveal={[4.7, 5.7]}
          metalness={0.25}
          roughness={0.5}
        />
        <RuleLine y={-0.9} color={accent} from={4.9} to={5.9} width={3.4} />
      </group>

      <LoopFade from={6.2} to={6.95} />
      <MotionPostFx
        bloomIntensity={1}
        pulse={{ at: collapseEnd, width: 0.3, boost: 1.8 }}
        chroma={0.0014}
        grain={0.06}
        vignette={0.7}
      />
    </>
  );
}
