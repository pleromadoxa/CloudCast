import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { shiftAccent } from '../../../../lib/prism/motionGraphics';
import {
  AmbientDust,
  LoopFade,
  MetalText,
  MotionPostFx,
  RuleLine,
  VoidBackdrop,
  useMotionClock,
  type MotionSceneProps,
} from '../kit';
import { clamp01, easeOutExpo, getRadialGlowTexture, seg } from '../motionMath';

/**
 * NEON TUNNEL — 8s bumper.
 * A flythrough of a neon grid corridor: floor and ceiling grids streak past,
 * light rings barrel towards lens, and the title comes out of the depth.
 */

const RING_COUNT = 15;
const RING_SPAN = 6;
const RING_TRAVEL = RING_COUNT * RING_SPAN;
const FLY_SPEED = 17;

function FlyGrid({ accent }: { accent: string }) {
  const clock = useMotionClock();

  const { floor, ceiling } = useMemo(() => {
    const center = shiftAccent(accent, 0.55);
    const grid = new THREE.GridHelper(140, 70, center, accent);
    const mat = grid.material as THREE.Material;
    mat.transparent = true;
    mat.opacity = 0;
    const ceil = grid.clone() as THREE.GridHelper;
    ceil.rotation.z = Math.PI;
    const ceilMat = ceil.material as THREE.Material;
    ceilMat.transparent = true;
    ceilMat.opacity = 0;
    return { floor: grid, ceiling: ceil };
  }, [accent]);

  useEffect(
    () => () => {
      floor.dispose();
      (floor.material as THREE.Material).dispose();
      ceiling.dispose();
      (ceiling.material as THREE.Material).dispose();
    },
    [floor, ceiling],
  );

  useFrame(() => {
    /* eslint-disable react-hooks/immutability -- imperative Three.js scene updates in the render loop */
    const t = clock.t;
    // 140/70 = 2 units per cell — wrap by cell size for an infinite corridor
    const travel = (t * FLY_SPEED) % 2;
    const reveal = clamp01(seg(t, 0.1, 1.6, easeOutExpo));
    floor.position.z = travel;
    const fm = floor.material as THREE.Material;
    fm.opacity = 0.55 * reveal;
    floor.visible = fm.opacity > 0.01;
    ceiling.position.z = -travel;
    const cm = ceiling.material as THREE.Material;
    cm.opacity = 0.3 * reveal;
    ceiling.visible = cm.opacity > 0.01;
    /* eslint-enable react-hooks/immutability */
  });

  return (
    <>
      <primitive object={floor} position={[0, -3.2, 0]} />
      <primitive object={ceiling} position={[0, 3.2, 0]} />
    </>
  );
}

function NeonRings({ accent }: { accent: string }) {
  const clock = useMotionClock();
  const refs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(() => {
    const t = clock.t;
    const intro = clamp01(seg(t, 0, 1.4, easeOutExpo));
    for (let i = 0; i < RING_COUNT; i++) {
      const mesh = refs.current[i];
      if (!mesh) continue;
      const z = ((i * RING_SPAN + t * FLY_SPEED) % RING_TRAVEL) - (RING_TRAVEL - 8);
      mesh.position.z = z;
      // far rings fade in, near rings blast past the lens
      const depth = clamp01((z + RING_TRAVEL - 10) / (RING_TRAVEL - 10));
      const nearFade = clamp01((6.5 - z) / 3.2);
      const s = (0.9 + depth * 0.35) * (0.6 + 0.4 * intro);
      mesh.scale.setScalar(s);
      mesh.visible = intro > 0.01 && z < 6.4;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = nearFade;
      mat.transparent = true;
    }
  });

  return (
    <group>
      {Array.from({ length: RING_COUNT }, (_, i) => (
        <mesh
          key={i}
          visible={false}
          ref={(node) => {
            refs.current[i] = node;
          }}
        >
          <torusGeometry args={[3.1, 0.06, 12, 90]} />
          <meshStandardMaterial
            color={i % 3 === 0 ? shiftAccent(accent, 0.75) : accent}
            emissive={i % 3 === 0 ? '#ffffff' : accent}
            emissiveIntensity={i % 3 === 0 ? 1.4 : 2.6}
            metalness={0.6}
            roughness={0.3}
          />
        </mesh>
      ))}
    </group>
  );
}

export function NeonTunnel({ headline, subline, accent }: MotionSceneProps) {
  const clock = useMotionClock();
  const titleGroup = useRef<THREE.Group>(null);
  const lookAt = useMemo(() => new THREE.Vector3(0, -0.1, 0), []);
  const desired = useMemo(() => new THREE.Vector3(), []);
  const washMap = useMemo(() => getRadialGlowTexture(), []);

  useFrame(({ camera }, dt) => {
    const push = seg(clock.t, 0, 8, easeOutExpo);
    desired.set(
      Math.sin(clock.t * 0.6) * 0.35,
      Math.sin(clock.t * 0.42) * 0.22,
      8.2 - push * 2.4,
    );
    if (clock.t < 0.12 || dt <= 0) camera.position.copy(desired);
    else camera.position.lerp(desired, 1 - Math.exp(-4.5 * dt));
    camera.lookAt(lookAt);
    camera.rotation.z = Math.sin(clock.t * 0.5) * 0.05;
    const cam = camera as THREE.PerspectiveCamera;
    if (Math.abs(cam.fov - 62) > 0.01) {
      cam.fov = 62;
      cam.updateProjectionMatrix();
    }

    const group = titleGroup.current;
    if (group) {
      const p = seg(clock.t, 2.4, 5, easeOutExpo);
      group.position.z = -34 + p * 34;
      group.scale.setScalar(1.5 - 0.5 * p);
      group.visible = p > 0.001;
    }
  });

  return (
    <>
      <fog attach="fog" args={['#000000', 16, 86]} />
      <VoidBackdrop />
      <ambientLight intensity={0.3} />
      <directionalLight position={[0, 6, 8]} intensity={1.2} color="#ffffff" />
      <directionalLight position={[-6, -2, 4]} intensity={0.7} color={accent} />

      <mesh position={[0, 0, -46]} scale={44}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={washMap} color={accent} transparent opacity={0.6} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} fog={false} />
      </mesh>

      <FlyGrid accent={accent} />
      <NeonRings accent={accent} />
      <AmbientDust count={300} radius={14} color={shiftAccent(accent, 0.6)} size={0.05} drift={0.08} opacity={0.5} reveal={[0.4, 2]} />

      <group ref={titleGroup} visible={false}>
        <MetalText text={headline} accent={accent} size={0.7} position={[0, 0.2, 0]} letterSpacing={0.07} reveal={[3, 4.7]} />
      </group>
      <MetalText
        text={subline}
        accent={shiftAccent(accent, 0.7)}
        size={0.2}
        position={[0, -0.62, 0]}
        letterSpacing={0.3}
        reveal={[5, 6.1]}
        metalness={0.25}
        roughness={0.5}
      />
      <RuleLine y={-0.98} color={accent} from={5.2} to={6.3} width={3.6} />

      <LoopFade from={7.2} to={7.95} />
      <MotionPostFx
        bloomIntensity={1.25}
        pulse={{ at: 4.7, width: 0.5, boost: 0.7 }}
        chroma={0.002}
        grain={0.06}
        vignette={0.62}
      />
    </>
  );
}
