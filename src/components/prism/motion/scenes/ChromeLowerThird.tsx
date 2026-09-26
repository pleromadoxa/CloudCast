import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { shiftAccent } from '../../../../lib/prism/motionGraphics';
import {
  MetalText,
  MotionEnvironment,
  SpecSweep,
  useMotionClock,
  type MotionSceneProps,
} from '../kit';
import { clamp01, easeInCubic, easeOutExpo, getRadialGlowTexture, seg } from '../motionMath';

/**
 * CHROME LOWER THIRD — 6s.
 * An extruded bar with an accent spine flies in from the left, a specular
 * sweep rakes across it while the name and title reveal, then it exits frame.
 * Transparent canvas — composited straight over the live virtual set.
 */

const BAR_Y = -1.45;
const BAR_WIDTH = 6.2;
const BAR_X = -1.4;
const SLIDE_IN: [number, number] = [0.35, 1.3];
const SLIDE_OUT: [number, number] = [4.9, 5.8];

function StaticCamera() {
  useFrame(({ camera }) => {
    const cam = camera as THREE.PerspectiveCamera;
    if (Math.abs(cam.fov - 48) > 0.01) {
      cam.fov = 48;
      cam.updateProjectionMatrix();
    }
    if (cam.position.z !== 6) {
      cam.position.set(0, 0, 6);
      cam.lookAt(0, 0, 0);
    }
  });
  return null;
}

export function ChromeLowerThird({ headline, subline, accent }: MotionSceneProps) {
  const clock = useMotionClock();
  const groupRef = useRef<THREE.Group>(null);
  const spineGlowRef = useRef<THREE.MeshBasicMaterial>(null);
  const glowMap = useMemo(() => getRadialGlowTexture(), []);

  useFrame(() => {
    const t = clock.t;
    const group = groupRef.current;
    if (!group) return;
    const inP = seg(t, SLIDE_IN[0], SLIDE_IN[1], easeOutExpo);
    const outP = seg(t, SLIDE_OUT[0], SLIDE_OUT[1], easeInCubic);
    if (t < SLIDE_IN[0]) {
      group.visible = false;
      return;
    }
    group.visible = true;
    const restX = BAR_X - (1 - inP) * 8.6 - outP * 9;
    // gentle float once parked
    const float = Math.sin((t - SLIDE_IN[1]) * 1.5) * 0.018 * clamp01(inP - 0.6) * (1 - outP);
    group.position.set(restX, BAR_Y + float, 0);
    if (spineGlowRef.current) {
      spineGlowRef.current.opacity = 0.55 * seg(t, SLIDE_IN[1] - 0.15, SLIDE_IN[1] + 0.5, easeOutExpo);
    }
  });

  return (
    <>
      <StaticCamera />
      {/* reflections only — never paints a backdrop on the transparent canvas */}
      <MotionEnvironment accent={accent} intensity={1.3} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 4, 6]} intensity={1.8} color="#ffffff" />
      <directionalLight position={[-5, -1, 3]} intensity={0.9} color={accent} />

      <group ref={groupRef} visible={false}>
        {/* dark chrome slab */}
        <RoundedBox args={[BAR_WIDTH, 0.68, 0.16]} radius={0.05} smoothness={4} castShadow={false}>
          <meshPhysicalMaterial
            color="#0b0d13"
            metalness={0.85}
            roughness={0.28}
            clearcoat={1}
            clearcoatRoughness={0.16}
            envMapIntensity={1.8}
          />
        </RoundedBox>

        {/* accent spine on the leading edge */}
        <mesh position={[-BAR_WIDTH / 2 + 0.045, 0, 0.02]}>
          <boxGeometry args={[0.09, 0.68, 0.18]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={3.4} metalness={0.3} roughness={0.3} />
        </mesh>
        {/* soft halo around the spine so it reads as lit, not painted */}
        <mesh position={[-BAR_WIDTH / 2 + 0.045, 0, 0.06]} scale={[1.5, 1.9, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            ref={spineGlowRef}
            map={glowMap}
            color={accent}
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
            fog={false}
          />
        </mesh>

        {/* polished top highlight */}
        <mesh position={[0, 0.335, 0.02]}>
          <boxGeometry args={[BAR_WIDTH - 0.2, 0.012, 0.14]} />
          <meshStandardMaterial color="#e8eef7" emissive="#9fb4d1" emissiveIntensity={0.5} metalness={1} roughness={0.12} />
        </mesh>

        {/* name + title */}
        <MetalText
          text={headline}
          accent={shiftAccent(accent, 0.88)}
          size={0.3}
          position={[-BAR_WIDTH / 2 + 0.3, 0.07, 0.1]}
          letterSpacing={0.04}
          reveal={[SLIDE_IN[1] - 0.1, SLIDE_IN[1] + 0.5]}
          rise={0.07}
          align="left"
          metalness={0.35}
          roughness={0.42}
        />
        <MetalText
          text={subline}
          accent={shiftAccent(accent, 0.35)}
          size={0.16}
          position={[-BAR_WIDTH / 2 + 0.3, -1.98, 0]}
          letterSpacing={0.1}
          reveal={[SLIDE_IN[1] + 0.1, SLIDE_IN[1] + 0.7]}
          rise={0.06}
          align="left"
          metalness={0.15}
          roughness={0.55}
        />
      </group>

      {/* specular rake across the parked bar */}
      <SpecSweep
        window={[SLIDE_IN[1] + 0.2, SLIDE_IN[1] + 1.4]}
        width={6.4}
        height={1.1}
        position={[BAR_X, BAR_Y, 0.14]}
        intensity={0.85}
      />
    </>
  );
}
