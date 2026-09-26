import { useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { LowerThirdVisual } from '../../../../../lib/prism/motionTemplateBank';
import { shiftAccent } from '../../../../../lib/prism/motionGraphics';
import type { PrismBrandKit } from '../../../../../lib/prism/brandKit';
import { BrandMark } from '../../BrandMark';
import { getRadialGlowTexture } from '../../motionMath';

/**
 * Geometry families for the 3D lower-third engine — one renderer per plate
 * archetype (slab, glass, shard, capsule, crest…). Renderers are pure
 * presentational meshes; the engine drives all timeline motion around them.
 */

export interface LowerThirdShapeProps {
  visual: LowerThirdVisual;
  accent: string;
  /** Operator brand kit — medallion marks render the uploaded logo. */
  brand?: PrismBrandKit;
}

/** Soft additive halo — lights a plate edge so it reads lit, not painted. */
export function EdgeGlow({
  position,
  scale,
  color,
  opacity = 0.4,
}: {
  position: [number, number, number];
  scale: [number, number] | number;
  color: string;
  opacity?: number;
}) {
  const map = useMemo(() => getRadialGlowTexture(), []);
  const s: [number, number, number] = typeof scale === 'number' ? [scale, scale, 1] : [scale[0], scale[1], 1];
  return (
    <mesh position={position} scale={s} renderOrder={2}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={map}
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        fog={false}
      />
    </mesh>
  );
}

/** Emissive accent bar — spines, trims, brackets. */
function GlowBar({
  position,
  args,
  color,
  intensity = 2.6,
  rotation,
}: {
  position: [number, number, number];
  args: [number, number, number];
  color: string;
  intensity?: number;
  rotation?: [number, number, number];
}) {
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} metalness={0.35} roughness={0.32} />
    </mesh>
  );
}

/** Corner HUD bracket (two short bars forming an L). */
function Bracket({ position, flipX = false, flipY = false, color }: { position: [number, number, number]; flipX?: boolean; flipY?: boolean; color: string }) {
  const sx = flipX ? -1 : 1;
  const sy = flipY ? -1 : 1;
  return (
    <group position={position}>
      <GlowBar position={[sx * 0.11, 0, 0]} args={[0.22, 0.035, 0.05]} color={color} intensity={3.2} />
      <GlowBar position={[0, sy * 0.11, 0]} args={[0.035, 0.22, 0.05]} color={color} intensity={3.2} />
    </group>
  );
}

/** Polished dark-chrome plate stock shared by several families. */
function ChromePlate({ w, h, color, radius = 0.05, metalness = 0.85, roughness = 0.28 }: { w: number; h: number; color: string; radius?: number; metalness?: number; roughness?: number }) {
  return (
    <RoundedBox args={[w, h, 0.15]} radius={radius} smoothness={4}>
      <meshPhysicalMaterial color={color} metalness={metalness} roughness={roughness} clearcoat={1} clearcoatRoughness={0.16} envMapIntensity={1.8} />
    </RoundedBox>
  );
}

/* ------------------------------------------------------------ the families */

export function LowerThirdShape({ visual, brand }: LowerThirdShapeProps) {
  const { shape, width: w, height: h, plate, trim } = visual;
  const lightTrim = shiftAccent(trim, 0.55);

  switch (shape) {
    case 'slab':
      return (
        <group>
          <ChromePlate w={w} h={h} color={plate} />
          <GlowBar position={[-w / 2 + 0.05, 0, 0.02]} args={[0.1, h, 0.17]} color={trim} intensity={3.4} />
          <EdgeGlow position={[-w / 2 + 0.05, 0, 0.06]} scale={[1.4, h * 2.4]} color={trim} opacity={0.5} />
          <mesh position={[0, h / 2 + 0.008, 0.02]}>
            <boxGeometry args={[w - 0.24, 0.014, 0.13]} />
            <meshStandardMaterial color={lightTrim} emissive={lightTrim} emissiveIntensity={0.5} metalness={1} roughness={0.14} />
          </mesh>
          {visual.chip && <Chip position={[w / 2 - 0.62, 0, 0.09]} color={trim} />}
        </group>
      );

    case 'glass':
      return (
        <group>
          <RoundedBox args={[w, h, 0.14]} radius={0.06} smoothness={4}>
            <meshPhysicalMaterial
              color={plate}
              transparent
              opacity={0.32}
              metalness={0.1}
              roughness={0.08}
              clearcoat={1}
              clearcoatRoughness={0.04}
              envMapIntensity={2.2}
            />
          </RoundedBox>
          <GlowBar position={[0, h / 2 - 0.02, 0.02]} args={[w - 0.16, 0.03, 0.08]} color={trim} intensity={2.2} />
          <GlowBar position={[0, -h / 2 + 0.02, 0.02]} args={[w - 0.16, 0.03, 0.08]} color={trim} intensity={2.2} />
          <GlowBar position={[-w / 2 + 0.045, 0, 0.02]} args={[0.055, h, 0.09]} color={trim} intensity={3.6} />
          <EdgeGlow position={[-w / 2 + 0.045, 0, 0.07]} scale={[1.5, h * 2.6]} color={trim} opacity={0.55} />
        </group>
      );

    case 'outline':
      return (
        <group>
          <ChromePlate w={w} h={h} color={plate} metalness={0.6} roughness={0.42} />
          <GlowBar position={[0, h / 2, 0.03]} args={[w, 0.035, 0.08]} color={trim} intensity={3.6} />
          <GlowBar position={[0, -h / 2, 0.03]} args={[w, 0.035, 0.08]} color={trim} intensity={3.6} />
          <GlowBar position={[-w / 2, 0, 0.03]} args={[0.035, h, 0.08]} color={trim} intensity={3.6} />
          <GlowBar position={[w / 2, 0, 0.03]} args={[0.035, h, 0.08]} color={trim} intensity={3.6} />
          <Bracket position={[-w / 2 + 0.06, h / 2 - 0.06, 0.05]} color={lightTrim} />
          <Bracket position={[w / 2 - 0.06, h / 2 - 0.06, 0.05]} flipX color={lightTrim} />
          <Bracket position={[-w / 2 + 0.06, -h / 2 + 0.06, 0.05]} flipY color={lightTrim} />
          <Bracket position={[w / 2 - 0.06, -h / 2 + 0.06, 0.05]} flipX flipY color={lightTrim} />
        </group>
      );

    case 'split': {
      const halfW = w / 2 - 0.035;
      return (
        <group>
          {/* each half rides its own group so the engine can slide them apart */}
          <group name="lt-half-a">
            <RoundedBox position={[-w / 4 - 0.017, 0, 0]} args={[halfW, h, 0.15]} radius={0.05} smoothness={4}>
              <meshPhysicalMaterial color={plate} metalness={0.85} roughness={0.3} clearcoat={1} clearcoatRoughness={0.18} envMapIntensity={1.8} />
            </RoundedBox>
            <GlowBar position={[-w / 2 + 0.05, 0, 0.02]} args={[0.09, h, 0.17]} color={trim} intensity={3.2} />
          </group>
          <group name="lt-half-b">
            <RoundedBox position={[w / 4 + 0.017, 0, 0]} args={[halfW, h, 0.15]} radius={0.05} smoothness={4}>
              <meshPhysicalMaterial color={shiftAccent(plate, -0.25)} metalness={0.85} roughness={0.34} clearcoat={1} clearcoatRoughness={0.22} envMapIntensity={1.7} />
            </RoundedBox>
            <GlowBar position={[w / 2 - 0.05, 0, 0.02]} args={[0.09, h, 0.17]} color={trim} intensity={3.2} />
          </group>
          <GlowBar position={[0, 0, 0.05]} args={[0.05, h * 0.92, 0.1]} color={trim} intensity={3.8} />
          <EdgeGlow position={[0, 0, 0.1]} scale={[2.2, h * 2.4]} color={trim} opacity={0.5} />
        </group>
      );
    }

    case 'shard':
      return (
        <group>
          <group rotation={[0, 0, 0.045]}>
            <ChromePlate w={w * 0.96} h={h} color={plate} />
          </group>
          <group position={[w * 0.12, 0, 0.05]} rotation={[0, 0, -0.05]}>
            <RoundedBox args={[w * 0.62, h * 0.86, 0.1]} radius={0.04} smoothness={4}>
              <meshPhysicalMaterial color={shiftAccent(plate, -0.3)} metalness={0.8} roughness={0.36} clearcoat={0.7} envMapIntensity={1.5} />
            </RoundedBox>
          </group>
          <GlowBar position={[-w / 2 + 0.34, 0, 0.06]} args={[0.07, h * 1.28, 0.1]} color={trim} intensity={3.4} rotation={[0, 0, -0.38]} />
          <GlowBar position={[w / 2 - 0.12, 0, 0.06]} args={[0.07, h * 1.16, 0.1]} color={trim} intensity={2.6} rotation={[0, 0, -0.38]} />
        </group>
      );

    case 'line':
      return (
        <group>
          <mesh position={[0, -h / 2 + 0.02, 0]}>
            <boxGeometry args={[w, 0.016, 0.02]} />
            <meshStandardMaterial color={trim} metalness={0.9} roughness={0.22} envMapIntensity={1.6} />
          </mesh>
          <GlowBar position={[-w / 2 + 0.05, -h / 2 + 0.02, 0.02]} args={[0.1, 0.1, 0.06]} color={trim} intensity={3.2} />
          <EdgeGlow position={[-w / 2 + 0.05, -h / 2 + 0.02, 0.05]} scale={[1.1, 1.1]} color={trim} opacity={0.5} />
        </group>
      );

    case 'stripes':
      return (
        <group>
          <ChromePlate w={w} h={h} color={plate} metalness={0.7} roughness={0.38} />
          {[-0.34, -0.18, -0.02].map((dx, i) => (
            <GlowBar key={i} position={[-w / 2 + 0.42 + dx, 0, 0.04]} args={[0.09, h * 1.05, 0.08]} color={trim} intensity={2.8 - i * 0.5} rotation={[0, 0, 0.42]} />
          ))}
          <GlowBar position={[0, h / 2 + 0.008, 0.02]} args={[w - 0.3, 0.012, 0.12]} color={lightTrim} intensity={0.6} />
          {visual.chip && <Chip position={[w / 2 - 0.55, 0, 0.09]} color={trim} big />}
        </group>
      );

    case 'velvet':
      return (
        <group>
          <RoundedBox args={[w, h, 0.16]} radius={0.05} smoothness={4}>
            <meshPhysicalMaterial
              color={plate}
              metalness={0}
              roughness={0.86}
              sheen={1}
              sheenRoughness={0.42}
              sheenColor={new THREE.Color(trim)}
              envMapIntensity={0.9}
            />
          </RoundedBox>
          <mesh position={[0, h / 2 - 0.02, 0.03]}>
            <boxGeometry args={[w - 0.18, 0.02, 0.12]} />
            <meshStandardMaterial color={trim} metalness={1} roughness={0.24} envMapIntensity={1.7} />
          </mesh>
          <mesh position={[0, -h / 2 + 0.02, 0.03]}>
            <boxGeometry args={[w - 0.18, 0.02, 0.12]} />
            <meshStandardMaterial color={trim} metalness={1} roughness={0.24} envMapIntensity={1.7} />
          </mesh>
          <GlowBar position={[-w / 2 + 0.05, 0, 0.03]} args={[0.08, h * 0.9, 0.1]} color={trim} intensity={1.6} />
        </group>
      );

    case 'capsule':
      return (
        <group>
          <RoundedBox args={[w, h, 0.15]} radius={h / 2 - 0.02} smoothness={6}>
            <meshPhysicalMaterial color={plate} transparent opacity={0.6} metalness={0.35} roughness={0.14} clearcoat={1} clearcoatRoughness={0.06} envMapIntensity={2.1} />
          </RoundedBox>
          <mesh position={[-w / 2 + h / 2 + 0.02, 0, 0.03]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[h / 2 - 0.09, 0.022, 12, 40]} />
            <meshStandardMaterial color={trim} emissive={trim} emissiveIntensity={1.8} metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, -h / 2 + 0.035, 0.03]}>
            <boxGeometry args={[w - 0.7, 0.016, 0.08]} />
            <meshStandardMaterial color={trim} emissive={trim} emissiveIntensity={1.4} metalness={0.8} roughness={0.24} />
          </mesh>
          <EdgeGlow position={[-w / 2 + h / 2 + 0.02, 0, 0.08]} scale={[1.6, 1.6]} color={trim} opacity={0.5} />
        </group>
      );

    case 'holo':
      return (
        <group>
          <mesh>
            <planeGeometry args={[w, h]} />
            <meshBasicMaterial color={plate} transparent opacity={0.3} depthWrite={false} toneMapped={false} fog={false} />
          </mesh>
          <GlowBar position={[0, h / 2, 0.02]} args={[w, 0.03, 0.06]} color={trim} intensity={4} />
          <GlowBar position={[0, -h / 2, 0.02]} args={[w, 0.03, 0.06]} color={trim} intensity={4} />
          <GlowBar position={[-w / 2, 0, 0.02]} args={[0.03, h, 0.06]} color={trim} intensity={4} />
          <GlowBar position={[w / 2, 0, 0.02]} args={[0.03, h, 0.06]} color={trim} intensity={4} />
          {[-0.22, 0.02, 0.26].map((dy, i) => (
            <mesh key={i} position={[0, dy * h, 0.02]}>
              <planeGeometry args={[w - 0.3, 0.012]} />
              <meshBasicMaterial color={trim} transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} fog={false} />
            </mesh>
          ))}
          <EdgeGlow position={[0, 0, 0.06]} scale={[w * 1.15, h * 2.2]} color={trim} opacity={0.35} />
        </group>
      );

    case 'grid':
      return (
        <group>
          <ChromePlate w={w} h={h} color={plate} metalness={0.55} roughness={0.5} />
          {Array.from({ length: 7 }, (_, i) => (
            <GlowBar key={i} position={[-w / 2 + 0.28 + i * 0.17, h / 2 - 0.1 - (i % 3) * 0.03, 0.03]} args={[0.028, 0.1 + (i % 3) * 0.05, 0.05]} color={trim} intensity={2.6} />
          ))}
          <Bracket position={[-w / 2 + 0.07, h / 2 - 0.07, 0.05]} color={trim} />
          <Bracket position={[w / 2 - 0.07, -h / 2 + 0.07, 0.05]} flipX flipY color={trim} />
          {visual.chip && <Chip position={[w / 2 - 0.75, h / 2 - 0.16, 0.06]} color={trim} small />}
        </group>
      );

    case 'editorial':
      return (
        <group>
          <RoundedBox args={[w, h, 0.13]} radius={0.03} smoothness={3}>
            <meshStandardMaterial color={plate} metalness={0.02} roughness={0.88} envMapIntensity={0.85} />
          </RoundedBox>
          <mesh position={[0, h / 2 - 0.075, 0.025]}>
            <boxGeometry args={[w - 0.3, 0.022, 0.06]} />
            <meshStandardMaterial color={trim} metalness={0.2} roughness={0.5} />
          </mesh>
          <mesh position={[0, h / 2 - 0.115, 0.025]}>
            <boxGeometry args={[w - 0.3, 0.008, 0.05]} />
            <meshStandardMaterial color={trim} metalness={0.2} roughness={0.5} opacity={0.7} transparent />
          </mesh>
          <mesh position={[-w / 2 + 0.14, 0, 0.03]}>
            <boxGeometry args={[0.1, 0.1, 0.06]} />
            <meshStandardMaterial color={trim} metalness={0.3} roughness={0.45} />
          </mesh>
          {[-0.16, -0.02, 0.12].map((dy, i) => (
            <mesh key={i} position={[w / 2 - 0.16, dy, 0.03]}>
              <boxGeometry args={[0.02, 0.055 + i * 0.015, 0.05]} />
              <meshStandardMaterial color={trim} metalness={0.3} roughness={0.5} />
            </mesh>
          ))}
        </group>
      );

    case 'tag':
      return (
        <group>
          <ChromePlate w={w} h={h} color={plate} metalness={0.78} roughness={0.34} />
          <GlowBar position={[0, -h / 2 + 0.02, 0.03]} args={[w - 0.3, 0.03, 0.09]} color={trim} intensity={2.8} />
          <group position={[-w / 2 + 1.05, h / 2 + 0.16, 0.05]}>
            <RoundedBox args={[1.9, 0.3, 0.1]} radius={0.04} smoothness={4}>
              <meshStandardMaterial color={trim} emissive={trim} emissiveIntensity={1.1} metalness={0.3} roughness={0.36} />
            </RoundedBox>
            <EdgeGlow position={[0, 0, 0.06]} scale={[2.6, 1.1]} color={trim} opacity={0.55} />
          </group>
        </group>
      );

    case 'pillars':
      return (
        <group>
          <RoundedBox args={[w, h * 0.86, 0.13]} radius={0.045} smoothness={4}>
            <meshPhysicalMaterial color={plate} metalness={0.82} roughness={0.3} clearcoat={0.85} clearcoatRoughness={0.2} envMapIntensity={1.7} />
          </RoundedBox>
          <GlowBar position={[-w / 2 + 0.16, 0, 0.02]} args={[0.14, h * 1.42, 0.16]} color={trim} intensity={3} />
          <GlowBar position={[w / 2 - 0.16, 0, 0.02]} args={[0.14, h * 1.42, 0.16]} color={trim} intensity={3} />
          <mesh position={[0, h * 0.43 + 0.04, 0.02]}>
            <boxGeometry args={[w - 0.3, 0.016, 0.12]} />
            <meshStandardMaterial color={lightTrim} emissive={lightTrim} emissiveIntensity={0.6} metalness={1} roughness={0.12} />
          </mesh>
          <EdgeGlow position={[-w / 2 + 0.16, 0, 0.07]} scale={[1.6, h * 2.6]} color={trim} opacity={0.45} />
          <EdgeGlow position={[w / 2 - 0.16, 0, 0.07]} scale={[1.6, h * 2.6]} color={trim} opacity={0.45} />
        </group>
      );

    case 'card':
      return (
        <group>
          {/* soft drop shadow */}
          <mesh position={[0.1, -0.09, -0.02]}>
            <planeGeometry args={[w * 1.01, h * 1.02]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.28} depthWrite={false} toneMapped={false} fog={false} />
          </mesh>
          <RoundedBox args={[w, h, 0.12]} radius={0.055} smoothness={5}>
            <meshStandardMaterial color={plate} metalness={0.03} roughness={0.62} envMapIntensity={1.05} />
          </RoundedBox>
          <mesh position={[-w / 2 + 1.15, -h / 2 + 0.1, 0.03]}>
            <boxGeometry args={[1.9, 0.045, 0.06]} />
            <meshStandardMaterial color={trim} metalness={0.25} roughness={0.42} />
          </mesh>
          <mesh position={[-w / 2 + 0.14, h / 2 - 0.13, 0.03]}>
            <boxGeometry args={[0.09, 0.09, 0.05]} />
            <meshStandardMaterial color={trim} metalness={0.25} roughness={0.42} />
          </mesh>
        </group>
      );

    case 'ribbon':
      return (
        <group>
          <group position={[-w * 0.24, 0, 0]} rotation={[0, 0, 0.05]}>
            <RoundedBox args={[w * 0.58, h, 0.12]} radius={0.04} smoothness={4}>
              <meshPhysicalMaterial color={plate} metalness={0.86} roughness={0.26} clearcoat={1} clearcoatRoughness={0.14} envMapIntensity={1.9} />
            </RoundedBox>
          </group>
          <group position={[w * 0.26, 0, -0.02]} rotation={[0, 0, -0.05]}>
            <RoundedBox args={[w * 0.56, h * 0.92, 0.12]} radius={0.04} smoothness={4}>
              <meshPhysicalMaterial color={shiftAccent(plate, -0.22)} metalness={0.86} roughness={0.3} clearcoat={1} clearcoatRoughness={0.18} envMapIntensity={1.75} />
            </RoundedBox>
          </group>
          <GlowBar position={[-0.02, 0, 0.07]} args={[0.06, h * 1.06, 0.08]} color={trim} intensity={3.8} rotation={[0, 0, 0.05]} />
          <mesh position={[0, -h / 2 + 0.03, 0.05]}>
            <boxGeometry args={[w - 0.24, 0.018, 0.08]} />
            <meshStandardMaterial color={trim} metalness={1} roughness={0.2} envMapIntensity={1.8} />
          </mesh>
        </group>
      );

    case 'wave':
      return (
        <group>
          <ChromePlate w={w} h={h} color={plate} metalness={0.72} roughness={0.36} />
          {[
            { x: -w / 2 + 0.42, len: 0.62, y: 0.2 },
            { x: -w / 2 + 0.66, len: 0.9, y: 0 },
            { x: -w / 2 + 0.42, len: 0.5, y: -0.2 },
          ].map((bar, i) => (
            <GlowBar key={i} position={[bar.x + bar.len / 2, bar.y, 0.04]} args={[bar.len, 0.045, 0.07]} color={trim} intensity={2.6 - i * 0.4} />
          ))}
          <mesh position={[0, -h / 2 + 0.02, 0.03]}>
            <boxGeometry args={[w - 0.24, 0.014, 0.1]} />
            <meshStandardMaterial color={trim} emissive={trim} emissiveIntensity={1.2} metalness={0.9} roughness={0.2} />
          </mesh>
          <EdgeGlow position={[-w / 2 + 0.66, 0, 0.08]} scale={[2.4, h * 2]} color={trim} opacity={0.4} />
        </group>
      );

    case 'crest':
      return (
        <group>
          <ChromePlate w={w} h={h} color={plate} metalness={0.86} roughness={0.28} />
          <group position={[-w / 2 + 0.62, 0, 0.1]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.42, 0.035, 12, 48]} />
              <meshStandardMaterial color={trim} metalness={1} roughness={0.18} envMapIntensity={2} />
            </mesh>
            <BrandMark accent={trim} logo={brand} position={[0, 0, -0.02]} scale={0.26} spin={0.16} />
            <EdgeGlow position={[0, 0, 0.02]} scale={[1.6, 1.6]} color={trim} opacity={0.4} />
          </group>
          <mesh position={[0.35, h / 2 - 0.02, 0.03]}>
            <boxGeometry args={[w - 1.6, 0.014, 0.1]} />
            <meshStandardMaterial color={lightTrim} emissive={lightTrim} emissiveIntensity={0.5} metalness={1} roughness={0.13} />
          </mesh>
          {visual.chip && <Chip position={[w / 2 - 0.66, 0, 0.09]} color={trim} />}
        </group>
      );

    case 'data':
      return (
        <group>
          <ChromePlate w={w} h={h} color={plate} metalness={0.62} roughness={0.42} />
          <GlowBar position={[-w / 2 + 0.05, 0, 0.02]} args={[0.09, h, 0.16]} color={trim} intensity={3.2} />
          {[-1.85, -1.25, -0.65].map((dx, i) => (
            <group key={i} position={[dx, -h / 2 + 0.16, 0.05]}>
              <RoundedBox args={[0.48, 0.14, 0.05]} radius={0.03} smoothness={3}>
                <meshStandardMaterial color={shiftAccent(plate, 0.12)} metalness={0.5} roughness={0.5} />
              </RoundedBox>
              <mesh position={[0, 0, 0.03]}>
                <planeGeometry args={[0.3, 0.02]} />
                <meshBasicMaterial color={trim} transparent opacity={0.8} depthWrite={false} toneMapped={false} fog={false} />
              </mesh>
            </group>
          ))}
          <mesh position={[w / 2 - 1.15, -h / 2 + 0.16, 0.05]}>
            <planeGeometry args={[1.9, 0.022]} />
            <meshBasicMaterial color={trim} transparent opacity={0.85} depthWrite={false} toneMapped={false} fog={false} />
          </mesh>
          {visual.chip && <Chip position={[w / 2 - 0.6, 0.08, 0.09]} color={trim} small />}
        </group>
      );

    case 'prism':
    default:
      return (
        <group>
          <ChromePlate w={w * 0.94} h={h} color={plate} />
          <group position={[w * 0.42, 0, 0.02]} rotation={[0, 0, -0.12]}>
            <RoundedBox args={[w * 0.28, h * 1.12, 0.16]} radius={0.04} smoothness={4}>
              <meshPhysicalMaterial color={shiftAccent(plate, -0.2)} metalness={0.88} roughness={0.24} clearcoat={1} clearcoatRoughness={0.12} envMapIntensity={1.9} />
            </RoundedBox>
          </group>
          <GlowBar position={[-w / 2 + 0.05, 0, 0.02]} args={[0.1, h, 0.17]} color={trim} intensity={3.4} />
          <EdgeGlow position={[-w / 2 + 0.05, 0, 0.07]} scale={[1.5, h * 2.4]} color={trim} opacity={0.5} />
          <group position={[w / 2 - 0.55, 0, 0.12]}>
            <BrandMark accent={trim} logo={brand} scale={0.3} spin={0.22} />
          </group>
        </group>
      );
  }
}

/** Small accent chip label plate ("LIVE", "24", "REGAL"…). */
function Chip({ position, color, big = false, small = false }: { position: [number, number, number]; color: string; big?: boolean; small?: boolean }) {
  const h = big ? 0.34 : small ? 0.2 : 0.26;
  return (
    <group position={position}>
      <RoundedBox args={[big ? 0.72 : small ? 0.62 : 0.92, h, 0.07]} radius={0.03} smoothness={3}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} metalness={0.35} roughness={0.34} />
      </RoundedBox>
    </group>
  );
}

export { Chip };
