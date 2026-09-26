import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { backOut, clamp01, mulberry32, seg, easeOutExpo } from './motionMath';
import { useMotionClock } from './kit';

export interface BarTransform {
  position: [number, number, number];
  rotation: number;
  length: number;
}

/**
 * Bar layout for an equilateral triangle outline: three extruded beams whose
 * midpoints/angles trace the edges of a triangle of radius `R`.
 */
function triangleBars(R: number, sides = 3, offset = 0): BarTransform[] {
  const verts: [number, number][] = [];
  for (let k = 0; k < sides; k++) {
    const a = Math.PI / 2 + offset + (k * Math.PI * 2) / sides;
    verts.push([Math.cos(a) * R, Math.sin(a) * R]);
  }
  return verts.map((v, k) => {
    const n = verts[(k + 1) % verts.length];
    const mid: [number, number] = [(v[0] + n[0]) / 2, (v[1] + n[1]) / 2];
    const angle = Math.atan2(n[1] - v[1], n[0] - v[0]);
    const length = Math.hypot(n[0] - v[0], n[1] - v[1]);
    return { position: [mid[0], mid[1], 0], rotation: angle, length };
  });
}

export interface PrismMarkProps {
  accent: string;
  position?: [number, number, number];
  scale?: number;
  /** [assembly start, assembly end] seconds on the timeline. */
  assemble?: [number, number];
  /** Rotation once locked (rad/s). */
  spin?: number;
  thickness?: number;
  depth?: number;
  /** Mark hidden until the timeline reaches the assembly window. */
  hideBefore?: boolean;
}

/**
 * The Regal Prism mark: six gold beams snap together into a double triangle —
 * an outer frame and an inverted inner prism — around a faceted core.
 * This is the piece the Sovereign Outro assembles.
 */
export function PrismMark({
  accent,
  position = [0, 0, 0],
  scale = 1,
  assemble = [0.6, 2.4],
  spin = 0.18,
  thickness = 0.2,
  depth = 0.26,
  hideBefore = true,
}: PrismMarkProps) {
  const clock = useMotionClock();
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const coreMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const barRefs = useRef<(THREE.Group | null)[]>([]);

  // Outer frame + inner inverted prism = six beams.
  const bars = useMemo(() => {
    const outer = triangleBars(1.5, 3, 0);
    const inner = triangleBars(0.74, 3, Math.PI);
    const all = [...outer.map((b) => ({ ...b, thickness })), ...inner.map((b) => ({ ...b, thickness: thickness * 0.72 }))];
    const rand = mulberry32(24601);
    return all.map((bar, i) => {
      const dirAngle = rand() * Math.PI * 2;
      const dist = 3.4 + rand() * 3.6;
      return {
        ...bar,
        index: i,
        start: {
          position: [
            bar.position[0] + Math.cos(dirAngle) * dist,
            bar.position[1] + Math.sin(dirAngle) * dist,
            (rand() - 0.5) * 5,
          ] as [number, number, number],
          rotation: bar.rotation + (rand() - 0.5) * 7,
          scale: 0.35 + rand() * 0.5,
        },
      };
    });
  }, [thickness]);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    const t = clock.t;
    const before = t < assemble[0];
    if (hideBefore && before) {
      group.visible = false;
      return;
    }
    group.visible = true;
    group.position.set(position[0], position[1], position[2]);
    group.scale.setScalar(scale);
    // gentle float + slow turn once the mark is locked
    const lock = seg(t, assemble[0], assemble[1], easeOutExpo);
    group.rotation.y = (t - assemble[0]) * spin * lock;
    group.rotation.x = Math.sin(t * 0.5) * 0.05 * lock;

    const stagger = 0.11;
    bars.forEach((bar, i) => {
      const node = barRefs.current[i];
      if (!node) return;
      const p = seg(
        t,
        assemble[0] + i * stagger,
        assemble[1] + i * stagger * 0.6,
        (x) => backOut(x, 1.9),
      );
      const inv = 1 - clamp01(p);
      node.position.set(
        bar.start.position[0] * inv + bar.position[0] * clamp01(p),
        bar.start.position[1] * inv + bar.position[1] * clamp01(p),
        bar.start.position[2] * inv + bar.position[2] * clamp01(p),
      );
      node.rotation.z = bar.start.rotation * inv + bar.rotation * clamp01(p);
      const s = bar.start.scale * inv + 1 * clamp01(p);
      node.scale.setScalar(s);
      node.visible = p > 0.0005;
    });

    const core = coreRef.current;
    if (core) {
      const p = seg(t, assemble[1] + 0.45, assemble[1] + 0.95, (x) => backOut(x, 2.4));
      core.scale.setScalar(clamp01(p) * 0.34);
      core.visible = p > 0.001;
      core.rotation.y = t * 0.9;
      core.rotation.x = t * 0.6;
      if (coreMatRef.current) coreMatRef.current.emissiveIntensity = 1.6 + Math.sin(t * 3.2) * 0.6;
    }
  });

  return (
    <group ref={groupRef} visible={!hideBefore} position={position} scale={scale}>
      {bars.map((bar, i) => (
        <group
          key={bar.index}
          ref={(node) => {
            barRefs.current[i] = node;
          }}
        >
          <RoundedBox args={[bar.length, bar.thickness, depth]} radius={Math.min(0.05, bar.thickness * 0.3)} smoothness={3}>
            <meshPhysicalMaterial
              color={accent}
              metalness={1}
              roughness={0.22}
              clearcoat={0.6}
              clearcoatRoughness={0.25}
              envMapIntensity={2.4}
              emissive={accent}
              emissiveIntensity={0.06}
            />
          </RoundedBox>
        </group>
      ))}
      <mesh ref={coreRef}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          ref={coreMatRef}
          color={accent}
          metalness={0.4}
          roughness={0.15}
          emissive={accent}
          emissiveIntensity={2.4}
        />
      </mesh>
    </group>
  );
}
