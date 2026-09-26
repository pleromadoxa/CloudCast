import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { shiftAccent } from '../../../../lib/prism/motionGraphics';
import {
  AmbientDust,
  GlowCore,
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
 * ORBIT REVEAL — 10s show open over real Earth-from-orbit footage.
 *
 * Timeline:
 *   0.0 – 1.8  sunrise flare blooms on the planet rim, orbital ring draws in
 *   1.2 – 3.0  prism mark assembles, satellite rides the ring
 *   3.0        impact: flash, particle burst, bloom spike
 *   3.2 – 5.0  camera settles, headline rises out of the horizon glow
 *   4.6 – 5.8  specular sweep crosses the wordmark
 *   5.6 – 7.0  sub-line and rule line lock up
 *   7.0 – 10.0 hold (loops through a fade)
 */

/** Tilted orbital ring with a satellite riding along it. */
function OrbitRing({ color, ignite }: { color: string; ignite: [number, number] }) {
  const clock = useMotionClock();
  const ringRef = useRef<THREE.Mesh>(null);
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const satRef = useRef<THREE.Mesh>(null);
  const satMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const tilt = useMemo(() => -0.42, []);
  const radius = 3.6;

  useFrame(() => {
    const t = clock.t;
    const on = seg(t, ignite[0], ignite[1], easeOutCubic);
    const ring = ringRef.current;
    const ringMat = ringMatRef.current;
    if (ring && ringMat) {
      ring.visible = on > 0.004;
      ringMat.opacity = 0.55 * on * (0.75 + 0.25 * Math.sin(t * 1.4));
      ring.rotation.z = t * 0.04;
    }
    const sat = satRef.current;
    if (sat) {
      const a = (t - ignite[0]) * 0.55;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      sat.position.set(ca * radius, sa * radius * Math.cos(tilt), sa * radius * Math.sin(tilt));
      sat.visible = on > 0.01;
      sat.scale.setScalar(0.5 + 0.5 * clamp01(on));
    }
    const satMat = satMatRef.current;
    if (satMat) satMat.emissiveIntensity = 2.4 + Math.sin(t * 5) * 1.4;
  });

  return (
    <group rotation={[tilt, 0, 0.16]}>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]} visible={false}>
        <torusGeometry args={[radius, 0.008, 6, 220]} />
        <meshBasicMaterial
          ref={ringMatRef}
          color={color}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          fog={false}
        />
      </mesh>
      <mesh ref={satRef} visible={false}>
        <icosahedronGeometry args={[0.075, 1]} />
        <meshStandardMaterial
          ref={satMatRef}
          color="#f8fafc"
          metalness={0.9}
          roughness={0.25}
          emissive={color}
          emissiveIntensity={2.4}
        />
      </mesh>
    </group>
  );
}

/** Sun cresting the planet — the flare that opens the piece. */
function SunriseFlare({ color, reveal }: { color: string; reveal: [number, number] }) {
  const clock = useMotionClock();
  const ref = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ camera }) => {
    const mesh = ref.current;
    const mat = matRef.current;
    if (!mesh || !mat) return;
    const p = seg(clock.t, reveal[0], reveal[1], easeOutCubic);
    const pulse = 1 + 0.06 * Math.sin(clock.t * 2.2);
    mat.opacity = clamp01(p) * 0.85;
    mesh.visible = p > 0.004;
    mesh.scale.setScalar((6.5 + p * 2.5) * pulse);
    mesh.position.set(-2.4, -1.9, camera.position.z - 5.5);
    mesh.quaternion.copy(camera.quaternion);
  });

  return (
    <mesh ref={ref} visible={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        ref={matRef}
        color={color}
        transparent
        opacity={0}
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        fog={false}
      />
    </mesh>
  );
}

export function OrbitReveal({ headline, subline, accent, brand, overrides }: MotionSceneProps) {
  const clock = useMotionClock();
  const sweepLight = useRef<THREE.PointLight>(null);

  useFrame(() => {
    const light = sweepLight.current;
    if (!light) return;
    const p = clamp01((clock.t - 4.55) / 1.2);
    const active = p > 0 && p < 1;
    light.intensity = active ? Math.sin(Math.PI * p) * 30 : 0;
    light.visible = active;
    light.position.x = -5 + easeOutCubic(p) * 10;
  });

  return (
    <>
      <VoidBackdrop />
      <MotionEnvironment accent={accent} intensity={1.05} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[-6, -2, 4]} intensity={1.6} color="#fff4d6" />
      <pointLight
        ref={sweepLight}
        position={[-5, -0.4, 2.4]}
        color="#fffbe6"
        intensity={0}
        distance={26}
        decay={1.7}
        visible={false}
      />

      <GlowCore
        position={[-2.4, -1.9, -1]}
        scale={14}
        color="#ffe8b0"
        intensity={0.55}
        reveal={[0.2, 1.8]}
        boostAt={3}
        boost={1.7}
      />
      <MotionShaft position={[-4.2, 3.4, -3]} rotation={[0.3, 0, 0.5]} height={10} radius={2.4} color="#fff7ed" opacity={0.12} ignite={[0.4, 2]} />
      <MotionShaft position={[4.4, 3.2, -3]} rotation={[0.3, 0, -0.5]} height={10} radius={2.2} color={shiftAccent(accent, 0.4)} opacity={0.1} ignite={[0.7, 2.4]} />

      <OrbitRing color={accent} ignite={[0.9, 2.6]} />
      <SunriseFlare color="#ffe9b8" reveal={[0.1, 1.6]} />
      <AmbientDust count={640} radius={12} color={accent} size={0.05} drift={0.05} opacity={0.7} reveal={[0.4, 2.2]} />

      <BrandMark accent={accent} logo={overrides?.showLogo === false ? hiddenBrandKit(brand) : brand} assemble={[1.2, 3]} position={[0, 1.25, 0]} scale={0.66} spin={0.22} />

      <ParticleBurst count={760} color={accent} size={0.09} seed={91} spread={7} origin={[0, 1.2, 0]} window={[3, 4.6]} fadeOut={2} />
      <RuleLine y={-0.05} color={accent} from={3.4} to={4.4} width={5.4} />

      <MetalText
        text={headline}
        accent={accent}
        size={0.6}
        position={[0, -0.75, 0]}
        letterSpacing={0.07}
        reveal={[3.2, 4.7]}
      />
      <SpecSweep window={[4.55, 5.75]} width={10} height={1.1} position={[0, -0.75, 0.4]} intensity={0.9} />

      <MetalText
        text={subline}
        accent={shiftAccent(accent, 0.75)}
        size={0.17}
        position={[0, -1.4, 0]}
        letterSpacing={0.3}
        reveal={[5.6, 6.9]}
        rise={0.1}
        metalness={0.25}
        roughness={0.5}
      />
      <RuleLine y={-1.74} color={accent} from={6} to={7} width={4.4} />

      <OrbitCamera />
      <LoopFade from={9.1} to={9.95} />
      <MotionPostFx
        bloomIntensity={0.95}
        pulse={{ at: 3, width: 0.36, boost: 1.4 }}
        chroma={0.0008}
        grain={0.05}
        vignette={0.7}
      />
    </>
  );
}

/** Slow dolly-out with a hint of handheld drift — documentary, not mechanical. */
function OrbitCamera() {
  const clock = useMotionClock();
  const lookAt = useMemo(() => new THREE.Vector3(0, -0.1, 0), []);
  const desired = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera }, dt) => {
    const t = clock.t;
    const push = seg(t, 0, 3.0, easeInOutCubic);
    const settle = seg(t, 3.0, 6.4, easeOutExpo);
    const z = 4.1 + push * 0.7 + settle * 2.4;
    const y = 0.5 - push * 0.25 - settle * 0.5 + Math.sin(t * 0.5) * 0.045;
    const x = Math.sin(t * 0.22) * (0.14 + settle * 0.3);
    desired.set(x, y, z);
    const perspective = camera as THREE.PerspectiveCamera;
    if (t < 0.12 || dt <= 0) {
      camera.position.copy(desired);
    } else {
      camera.position.lerp(desired, 1 - Math.exp(-5 * dt));
    }
    camera.lookAt(lookAt);
    const fov = 46 - settle * 3;
    if (Math.abs(perspective.fov - fov) > 0.01) {
      perspective.fov = fov;
      perspective.updateProjectionMatrix();
    }
  });

  return null;
}
