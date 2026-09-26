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
  RuleLine,
  VoidBackdrop,
  useMotionClock,
  type MotionSceneProps,
} from '../kit';
import { clamp01, easeInOutCubic, backOut, easeOutExpo, getRadialGlowTexture, seg } from '../motionMath';

/**
 * AURORA OPENER — 8s show open.
 * Camera pushes through a corridor of orbiting metal rings while colour washes
 * bloom behind them; the title sails out of the depth and locks off centre.
 */

const RINGS: { z: number; radius: number; tilt: [number, number]; speed: [number, number] }[] = [
  { z: 6.4, radius: 3.3, tilt: [0.45, 0.2], speed: [0.35, 0.22] },
  { z: 3.2, radius: 2.5, tilt: [-0.5, 0.4], speed: [-0.28, 0.4] },
  { z: 0.3, radius: 1.95, tilt: [0.18, -0.55], speed: [0.22, -0.34] },
];

function OrbitRings({ accent }: { accent: string }) {
  const clock = useMotionClock();
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    const p = seg(clock.t, 0, 1.3, backOut);
    RINGS.forEach((ring, i) => {
      const mesh = refs.current[i];
      if (!mesh) return;
      mesh.rotation.x = ring.tilt[0] + clock.t * ring.speed[0];
      mesh.rotation.y = ring.tilt[1] + clock.t * ring.speed[1];
      mesh.scale.setScalar(0.55 + 0.45 * clamp01(p));
      mesh.visible = p > 0.01;
    });
  });
  return (
    <group>
      {RINGS.map((ring, i) => (
        <mesh
          key={ring.z}
          position={[0, 0, ring.z]}
          visible={false}
          ref={(node) => {
            refs.current[i] = node;
          }}
        >
          <torusGeometry args={[ring.radius, 0.075, 20, 140]} />
          <meshStandardMaterial
            color={accent}
            metalness={1}
            roughness={0.18}
            envMapIntensity={2.6}
            emissive={accent}
            emissiveIntensity={0.35}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Soft colour washes drifting behind the rings — the aurora. */
function AuroraWash({ accent }: { accent: string }) {
  const clock = useMotionClock();
  const group = useRef<THREE.Group>(null);
  const matRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const map = useMemo(() => getRadialGlowTexture(), []);
  const layers = useMemo(
    () => [
      { color: accent, scale: 26, speed: 0.05, offset: [-7, 2, -9] },
      { color: shiftAccent(accent, 0.45), scale: 22, speed: -0.04, offset: [6, -2, -8] },
      { color: shiftAccent(accent, -0.4), scale: 30, speed: 0.03, offset: [0, 4, -12] },
    ],
    [accent],
  );

  useFrame(() => {
    const reveal = seg(clock.t, 0.2, 2.2, easeOutExpo);
    layers.forEach((_, i) => {
      const mat = matRefs.current[i];
      if (mat) mat.opacity = 0.26 * reveal;
    });
    if (group.current) group.current.rotation.z = clock.t * 0.04;
  });

  return (
    <group ref={group}>
      {layers.map((layer, i) => (
        <mesh key={i} position={layer.offset as [number, number, number]} scale={layer.scale}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            ref={(node) => {
              matRefs.current[i] = node;
            }}
            map={map}
            color={layer.color}
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
            fog={false}
          />
        </mesh>
      ))}
    </group>
  );
}

export function AuroraOpener({ headline, subline, accent }: MotionSceneProps) {
  const clock = useMotionClock();
  const titleGroup = useRef<THREE.Group>(null);
  const lookAt = useMemo(() => new THREE.Vector3(0, -0.1, 0), []);
  const desired = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera }, dt) => {
    // push through the ring corridor, then settle on the lockup
    const through = seg(clock.t, 0, 4.4, easeInOutCubic);
    const settle = seg(clock.t, 4.4, 8, easeOutExpo);
    desired.set(
      Math.sin(clock.t * 0.3) * 0.16,
      0.1 + Math.sin(clock.t * 0.5) * 0.05,
      10 - through * 6.4 + settle * 1.3,
    );
    if (clock.t < 0.12 || dt <= 0) camera.position.copy(desired);
    else camera.position.lerp(desired, 1 - Math.exp(-5 * dt));
    camera.lookAt(lookAt);
    const perspective = camera as THREE.PerspectiveCamera;
    const fov = 54 - through * 8;
    if (Math.abs(perspective.fov - fov) > 0.01) {
      perspective.fov = fov;
      perspective.updateProjectionMatrix();
    }

    const group = titleGroup.current;
    if (group) {
      const p = seg(clock.t, 3.5, 5.3, easeOutExpo);
      group.position.z = -7 + p * 7;
      group.scale.setScalar(1.75 - 0.75 * p);
      group.visible = p > 0.001;
    }
  });

  return (
    <>
      <VoidBackdrop />
      <MotionEnvironment accent={accent} />
      <ambientLight intensity={0.28} />
      <directionalLight position={[3, 5, 6]} intensity={1.6} color="#ffffff" />
      <directionalLight position={[-5, -2, 3]} intensity={0.7} color={accent} />

      <AuroraWash accent={accent} />
      <GlowCore position={[0, 0, -6]} scale={18} color={accent} intensity={0.35} reveal={[0.3, 2.4]} />
      <AmbientDust count={520} radius={12} color={shiftAccent(accent, 0.5)} size={0.05} drift={0.06} opacity={0.7} reveal={[0.4, 2.4]} />
      <OrbitRings accent={accent} />

      <group ref={titleGroup} visible={false}>
        <MetalText text={headline} accent={accent} size={0.72} position={[0, 0.25, 0]} letterSpacing={0.06} reveal={[3.6, 5.1]} />
      </group>
      <MetalText
        text={subline}
        accent={shiftAccent(accent, 0.7)}
        size={0.21}
        position={[0, -0.55, 0]}
        letterSpacing={0.32}
        reveal={[5.2, 6.4]}
        metalness={0.25}
        roughness={0.5}
      />
      <RuleLine y={-0.92} color={accent} from={5.5} to={6.6} width={3.6} />

      <LoopFade from={7.2} to={7.95} />
      <MotionPostFx
        bloomIntensity={1.05}
        pulse={{ at: 5.1, width: 0.5, boost: 0.6 }}
        chroma={0.0011}
        grain={0.05}
        vignette={0.68}
      />
    </>
  );
}
