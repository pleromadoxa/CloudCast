import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { MotionOrnament } from '../../../../../lib/prism/motionTemplateBank';
import { shiftAccent } from '../../../../../lib/prism/motionGraphics';
import {
  GlowCore,
  MetalText,
  MotionShaft,
  useMotionClock,
} from '../../kit';
import { useMotionLook } from '../../motionLook';
import { BrandMark } from '../../BrandMark';
import type { PrismBrandKit } from '../../../../../lib/prism/brandKit';
import { bell, clamp01, easeOutExpo, getRadialGlowTexture, mulberry32, seg } from '../../motionMath';

/**
 * Full-frame ornament families — the set dressing each motion template builds
 * its composition around (rings, streaks, shards, globes, horizons…).
 * Timeline-driven through the shared motion clock.
 */

export interface OrnamentProps {
  accent: string;
  /** Title-punch time in seconds — ornaments ignite around it. */
  punchT: number;
  /** Total template length. */
  duration: number;
  chip?: string;
  /** Operator brand kit — the mark ornament renders the uploaded logo. */
  brand?: PrismBrandKit;
}

/** Shared floor/horizon glow so compositions feel grounded. */
function BackGlow({ accent, punchT, y = -0.4 }: { accent: string; punchT: number; y?: number }) {
  return <GlowCore position={[0, y, -6]} scale={17} color={accent} intensity={0.34} reveal={[0, punchT * 1.4]} boostAt={punchT} boost={2.4} />;
}

/* ------------------------------------------------------------- ornaments */

function MarkOrnament({ accent, punchT, brand }: OrnamentProps) {
  return (
    <group>
      <BackGlow accent={accent} punchT={punchT} y={0.2} />
      <BrandMark accent={accent} logo={brand} assemble={[0.15, punchT]} position={[0, 0.75, 0]} scale={1.15} spin={0.22} hideBefore />
    </group>
  );
}

function RingsOrnament({ accent, punchT }: OrnamentProps) {
  const clock = useMotionClock();
  const g1 = useRef<THREE.Mesh>(null);
  const g2 = useRef<THREE.Mesh>(null);
  const g3 = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const t = clock.t;
    const build = seg(t, 0, punchT, easeOutExpo);
    if (g1.current) {
      g1.current.rotation.x = t * 0.22;
      g1.current.rotation.y = t * 0.34;
      g1.current.scale.setScalar(0.4 + build * 0.6);
    }
    if (g2.current) {
      g2.current.rotation.x = Math.PI / 2 + t * 0.18;
      g2.current.rotation.z = -t * 0.26;
      g2.current.scale.setScalar(0.4 + build * 0.85);
    }
    if (g3.current) {
      g3.current.rotation.y = -t * 0.3;
      g3.current.rotation.z = 0.6 + t * 0.12;
      g3.current.scale.setScalar(0.4 + build * 1.15);
    }
  });
  return (
    <group position={[0, 0.35, -1]}>
      <BackGlow accent={accent} punchT={punchT} />
      <mesh ref={g1}>
        <torusGeometry args={[2.1, 0.05, 12, 90]} />
        <meshStandardMaterial color="#d7dee8" metalness={1} roughness={0.22} envMapIntensity={2} />
      </mesh>
      <mesh ref={g2}>
        <torusGeometry args={[2.75, 0.038, 12, 90]} />
        <meshStandardMaterial color={accent} metalness={0.9} roughness={0.28} emissive={accent} emissiveIntensity={0.5} />
      </mesh>
      <mesh ref={g3}>
        <torusGeometry args={[3.45, 0.028, 10, 90]} />
        <meshStandardMaterial color={shiftAccent(accent, 0.5)} metalness={0.9} roughness={0.32} />
      </mesh>
    </group>
  );
}

function StreaksOrnament({ accent, punchT }: OrnamentProps) {
  const clock = useMotionClock();
  const look = useMotionLook();
  const group = useRef<THREE.Group>(null);
  const count = Math.max(6, Math.round(16 * Math.max(0.2, look.particleScale)));
  const streaks = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: Math.sin(i * 2.4) * 7,
        y: Math.cos(i * 1.7) * 3.6,
        speed: 14 + (i % 5) * 4,
        len: 2.2 + (i % 4) * 1.1,
        offset: i * 3.7,
        color: i % 3 === 0 ? accent : '#e8eef8',
      })),
    [count, accent],
  );
  useFrame(() => {
    const t = clock.t;
    const g = group.current;
    if (!g) return;
    const ignite = seg(t, 0, punchT * 0.9, easeOutExpo);
    g.visible = ignite > 0.01;
    const children = g.children;
    for (let i = 0; i < streaks.length; i++) {
      const s = streaks[i];
      const child = children[i];
      if (!child) continue;
      const z = (((t * s.speed + s.offset) % 26) - 13) * (1 + (1 - ignite) * 2);
      child.position.set(s.x, s.y, z);
    }
  });
  return (
    <group ref={group} visible={false}>
      {streaks.map((s, i) => (
        <mesh key={i} rotation={[0, 0, 0.12]}>
          <boxGeometry args={[0.05, 0.05, s.len]} />
          <meshBasicMaterial color={s.color} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} fog={false} />
        </mesh>
      ))}
    </group>
  );
}

function ShardsOrnament({ accent, punchT }: OrnamentProps) {
  const clock = useMotionClock();
  const group = useRef<THREE.Group>(null);
  const shards = useMemo(
    () =>
      Array.from({ length: 11 }, (_, i) => ({
        position: [Math.sin(i * 2.1) * 3.6, Math.cos(i * 1.3) * 1.9 - 0.2, Math.cos(i * 2.7) * 2.2 - 1.2] as [number, number, number],
        rot: [i * 0.7, i * 1.1, i * 0.4] as [number, number, number],
        scale: 0.3 + (i % 4) * 0.22,
        spin: 0.12 + (i % 3) * 0.08,
      })),
    [],
  );
  useFrame(() => {
    const t = clock.t;
    const g = group.current;
    if (!g) return;
    const build = seg(t, 0, punchT * 1.3, easeOutExpo);
    g.visible = build > 0.01;
    for (let i = 0; i < g.children.length; i++) {
      const child = g.children[i];
      const s = shards[i];
      if (!s) continue;
      child.rotation.x = s.rot[0] + t * s.spin;
      child.rotation.y = s.rot[1] + t * s.spin * 1.3;
      child.position.set(s.position[0] * (0.6 + 0.4 * build), s.position[1] + Math.sin(t * 0.6 + i) * 0.12, s.position[2]);
    }
  });
  return (
    <group ref={group} visible={false}>
      <BackGlow accent={accent} punchT={punchT} />
      {shards.map((s, i) => (
        <mesh key={i} scale={s.scale} position={s.position}>
          <icosahedronGeometry args={[1, 0]} />
          <meshPhysicalMaterial
            color={i % 4 === 0 ? accent : '#20262f'}
            metalness={0.85}
            roughness={0.22}
            clearcoat={1}
            clearcoatRoughness={0.12}
            flatShading
            envMapIntensity={1.9}
          />
        </mesh>
      ))}
    </group>
  );
}

function CardsOrnament({ accent, punchT }: OrnamentProps) {
  const clock = useMotionClock();
  const group = useRef<THREE.Group>(null);
  const cards = useMemo(
    () => [
      { position: [-2.9, 0.35, -1.6] as [number, number, number], rot: 0.16, scale: 1 },
      { position: [0, -0.15, -0.6] as [number, number, number], rot: -0.08, scale: 1.18 },
      { position: [2.9, 0.5, -1.9] as [number, number, number], rot: 0.1, scale: 0.92 },
    ],
    [],
  );
  useFrame(() => {
    const t = clock.t;
    const g = group.current;
    if (!g) return;
    const build = seg(t, 0, punchT * 1.35, easeOutExpo);
    g.visible = build > 0.01;
    for (let i = 0; i < g.children.length; i++) {
      const child = g.children[i];
      const c = cards[i];
      if (!c) continue;
      child.position.set(c.position[0], c.position[1] + Math.sin(t * 0.7 + i * 1.3) * 0.14 + (1 - build) * -1.2, c.position[2]);
      child.rotation.y = c.rot + Math.sin(t * 0.3 + i) * 0.08;
    }
  });
  return (
    <group ref={group} visible={false}>
      <BackGlow accent={accent} punchT={punchT} />
      {cards.map((c, i) => (
        <group key={i} position={c.position} rotation={[0, c.rot, 0]} scale={c.scale}>
          <RoundedBox args={[2.6, 1.65, 0.12]} radius={0.07} smoothness={4}>
            <meshPhysicalMaterial
              color={i === 1 ? shiftAccent(accent, 0.15) : '#161b22'}
              metalness={0.55}
              roughness={0.3}
              clearcoat={1}
              clearcoatRoughness={0.16}
              envMapIntensity={1.8}
            />
          </RoundedBox>
          <mesh position={[0, 0.42, 0.08]}>
            <boxGeometry args={[1.7, 0.05, 0.04]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.4} metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position={[-0.45, 0.02, 0.08]}>
            <boxGeometry args={[0.8, 0.035, 0.03]} />
            <meshStandardMaterial color="#9fb0c4" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[-0.62, -0.22, 0.08]}>
            <boxGeometry args={[1.14, 0.035, 0.03]} />
            <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function GridFloorOrnament({ accent, punchT }: OrnamentProps) {
  const clock = useMotionClock();
  const dots = useRef<THREE.Group>(null);
  const map = useMemo(() => getRadialGlowTexture(), []);
  useFrame(() => {
    const t = clock.t;
    const g = dots.current;
    if (!g) return;
    for (let i = 0; i < g.children.length; i++) {
      const child = g.children[i];
      child.position.x = ((t * (1.2 + i * 0.4) + i * 4) % 16) - 8;
    }
  });
  return (
    <group>
      <BackGlow accent={accent} punchT={punchT} y={-1.2} />
      <group position={[0, -2.4, -3]}>
        <gridHelper args={[28, 28, accent, '#243040']} />
      </group>
      <group ref={dots}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[0, -2.32, -2 - i * 1.6]}>
            <planeGeometry args={[0.5, 0.5]} />
            <meshBasicMaterial map={map} color={accent} transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} fog={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function HorizonOrnament({ accent, punchT }: OrnamentProps) {
  const clock = useMotionClock();
  const bar = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const t = clock.t;
    if (bar.current) bar.current.position.y = -1.15 + Math.sin(t * 0.3) * 0.08;
  });
  return (
    <group>
      <GlowCore position={[0, -1.2, -7]} scale={22} color={accent} intensity={0.5} reveal={[0, punchT * 1.3]} boostAt={punchT} boost={1.8} />
      <mesh ref={bar} position={[0, -1.15, -6.8]}>
        <planeGeometry args={[26, 0.13]} />
        <meshBasicMaterial color={shiftAccent(accent, 0.72)} transparent opacity={0.85} depthWrite={false} toneMapped={false} fog={false} />
      </mesh>
      <GlowCore position={[0, -1.1, -6.6]} scale={9} color={shiftAccent(accent, 0.4)} intensity={0.35} reveal={[0, punchT * 1.3]} />
    </group>
  );
}

function StarField() {
  const look = useMotionLook();
  const ref = useRef<THREE.Points>(null);
  const count = Math.max(120, Math.round(520 * Math.max(0.2, look.particleScale)));
  const { geometry, material } = useMemo(() => {
    const rand = mulberry32(9042);
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (rand() - 0.5) * 24;
      positions[i * 3 + 1] = (rand() - 0.5) * 13;
      positions[i * 3 + 2] = -2 - rand() * 14;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      map: getRadialGlowTexture(),
      size: 0.09,
      color: '#ffffff',
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    return { geometry, material };
  }, [count]);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += dt * 0.012;
  });
  return <points ref={ref} geometry={geometry} material={material} />;
}

function StarsOrnament({ accent, punchT }: OrnamentProps) {
  return (
    <group>
      <BackGlow accent={accent} punchT={punchT} />
      <StarField />
    </group>
  );
}

function GlobeOrnament({ accent, punchT }: OrnamentProps) {
  const clock = useMotionClock();
  const globe = useRef<THREE.Group>(null);
  const satellite = useRef<THREE.Group>(null);
  useFrame(() => {
    const t = clock.t;
    const build = seg(t, 0, punchT * 1.2, easeOutExpo);
    if (globe.current) {
      globe.current.rotation.y = t * 0.16;
      globe.current.scale.setScalar(0.55 + build * 0.45);
      globe.current.visible = build > 0.01;
    }
    if (satellite.current) {
      satellite.current.position.set(Math.cos(t * 0.55) * 3.2, 0.8 + Math.sin(t * 0.9) * 0.5, Math.sin(t * 0.55) * 3.2);
    }
  });
  return (
    <group position={[0, 0.35, -1.6]}>
      <BackGlow accent={accent} punchT={punchT} />
      <group ref={globe} visible={false}>
        <mesh>
          <sphereGeometry args={[1.9, 42, 28]} />
          <meshPhysicalMaterial color="#0d1622" metalness={0.7} roughness={0.38} clearcoat={0.7} envMapIntensity={1.6} />
        </mesh>
        <mesh scale={1.012}>
          <sphereGeometry args={[1.9, 22, 14]} />
          <meshBasicMaterial color={accent} wireframe transparent opacity={0.16} toneMapped={false} fog={false} />
        </mesh>
        <mesh rotation={[Math.PI / 2.3, 0, 0.3]}>
          <torusGeometry args={[2.65, 0.022, 8, 110]} />
          <meshStandardMaterial color={shiftAccent(accent, 0.5)} metalness={0.9} roughness={0.26} emissive={accent} emissiveIntensity={0.35} />
        </mesh>
        <mesh rotation={[Math.PI / 1.8, 0.5, -0.2]}>
          <torusGeometry args={[3.1, 0.016, 8, 110]} />
          <meshStandardMaterial color="#b9c6d6" metalness={1} roughness={0.24} />
        </mesh>
      </group>
      <group ref={satellite}>
        <mesh>
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshBasicMaterial color={shiftAccent(accent, 0.8)} toneMapped={false} fog={false} />
        </mesh>
      </group>
    </group>
  );
}

function SpotlightOrnament({ accent, punchT }: OrnamentProps) {
  const clock = useMotionClock();
  const sweepA = useRef<THREE.Group>(null);
  const sweepB = useRef<THREE.Group>(null);
  const map = useMemo(() => getRadialGlowTexture(), []);
  useFrame(() => {
    const t = clock.t;
    const ignite = seg(t, 0, punchT, easeOutExpo);
    if (sweepA.current) sweepA.current.rotation.z = 0.5 + Math.sin(t * 0.5) * 0.3 - (1 - ignite) * 0.8;
    if (sweepB.current) sweepB.current.rotation.z = -0.5 + Math.sin(t * 0.42 + 1.6) * 0.28 + (1 - ignite) * 0.8;
  });
  return (
    <group>
      {/* stage floor */}
      <mesh position={[0, -2.3, -2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[26, 18]} />
        <meshStandardMaterial color="#0c0e13" metalness={0.55} roughness={0.42} envMapIntensity={1.1} />
      </mesh>
      <mesh position={[0, -2.28, -1.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[9, 7]} />
        <meshBasicMaterial map={map} color={accent} transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} fog={false} />
      </mesh>
      <group ref={sweepA} position={[0, 3.4, -1.6]}>
        <MotionShaft position={[0, -1.2, 0]} height={9} radius={1.5} color="#fff7ea" opacity={0.16} ignite={[0, punchT]} />
      </group>
      <group ref={sweepB} position={[0, 3.4, -1.6]}>
        <MotionShaft position={[0, -1.2, 0]} height={9} radius={1.2} color={accent} opacity={0.13} ignite={[0, punchT * 1.2]} />
      </group>
    </group>
  );
}

function CountdownOrnament({ accent, punchT, chip }: OrnamentProps) {
  const clock = useMotionClock();
  const ring = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const t = clock.t;
    if (ring.current) ring.current.rotation.z = -t * 0.24;
  });
  return (
    <group position={[0, 0.35, -0.6]}>
      <BackGlow accent={accent} punchT={punchT} />
      <mesh ref={ring}>
        <torusGeometry args={[2.5, 0.05, 12, 110]} />
        <meshStandardMaterial color={accent} metalness={0.9} roughness={0.24} emissive={accent} emissiveIntensity={0.8} />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 2.5, Math.sin(a) * 2.5, 0]} rotation={[0, 0, a]}>
            <boxGeometry args={[i % 3 === 0 ? 0.3 : 0.16, 0.035, 0.035]} />
            <meshStandardMaterial color={shiftAccent(accent, 0.55)} metalness={0.9} roughness={0.3} />
          </mesh>
        );
      })}
      <MetalText
        text={chip ?? '5'}
        accent={shiftAccent(accent, 0.8)}
        size={1.5}
        position={[0, -0.05, 0.2]}
        letterSpacing={0.02}
        reveal={[0.1, Math.max(0.5, punchT * 0.8)]}
        rise={0.3}
        metalness={0.5}
        roughness={0.3}
      />
    </group>
  );
}

function ShutterOrnament({ accent, punchT }: OrnamentProps) {
  const clock = useMotionClock();
  const left = useRef<THREE.Mesh>(null);
  const right = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const t = clock.t;
    const close = seg(t, Math.max(0, punchT - 0.5), Math.max(0.1, punchT - 0.04), easeOutExpo);
    const open = seg(t, punchT + 0.04, punchT + 0.55, easeOutExpo);
    // Plates ride from fully open (±11) to touching the centre line (±5.05).
    const travel = clamp01(1 - close + open) * 5.95;
    if (left.current) left.current.position.x = -5.05 - travel;
    if (right.current) right.current.position.x = 5.05 + travel;
  });
  return (
    <group position={[0, 0, -1.2]}>
      <mesh ref={left} position={[-11, 0, 0]}>
        <boxGeometry args={[10, 13, 0.18]} />
        <meshPhysicalMaterial color="#12161d" metalness={0.9} roughness={0.22} clearcoat={1} clearcoatRoughness={0.1} envMapIntensity={1.8} />
      </mesh>
      <mesh ref={right} position={[11, 0, 0]}>
        <boxGeometry args={[10, 13, 0.18]} />
        <meshPhysicalMaterial color="#0c1016" metalness={0.9} roughness={0.26} clearcoat={1} clearcoatRoughness={0.12} envMapIntensity={1.7} />
      </mesh>
      <mesh position={[0, 0, 0.14]}>
        <boxGeometry args={[0.09, 13, 0.06]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={3} />
      </mesh>
    </group>
  );
}

function SweepOrnament({ accent, punchT }: OrnamentProps) {
  return (
    <group position={[0, 0, -1.4]}>
      <BackGlow accent={accent} punchT={punchT} />
      <RoundedBox args={[13, 4.6, 0.16]} radius={0.08} smoothness={4}>
        <meshPhysicalMaterial color="#10141b" metalness={0.92} roughness={0.2} clearcoat={1} clearcoatRoughness={0.08} envMapIntensity={2} />
      </RoundedBox>
      <mesh position={[0, 2.32, 0.1]}>
        <boxGeometry args={[12.6, 0.03, 0.06]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.6} metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
}

function ConvergeOrnament({ accent, punchT }: OrnamentProps) {
  const clock = useMotionClock();
  const ring = useRef<THREE.Mesh>(null);
  const core = useRef<THREE.Mesh>(null);
  const map = useMemo(() => getRadialGlowTexture(), []);
  useFrame(() => {
    const t = clock.t;
    const collapse = seg(t, 0, punchT, easeOutExpo);
    const after = seg(t, punchT, punchT + 1.1, easeOutExpo);
    if (ring.current) {
      ring.current.scale.setScalar(6.5 * (1 - collapse) + 0.4 + after * 7);
      const mat = ring.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.7 * (1 - after) * (collapse > 0.02 ? 1 : 0);
    }
    if (core.current) {
      const mat = core.current.material as THREE.MeshBasicMaterial;
      const flare = bell(t, punchT, 0.3);
      mat.opacity = clamp01(0.2 + flare * 0.8);
      core.current.scale.setScalar(2 + flare * 2.4);
    }
  });
  return (
    <group position={[0, 0.45, -1.2]}>
      <mesh ref={core}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={map} color={accent} transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} fog={false} />
      </mesh>
      <mesh ref={ring} visible={false}>
        <ringGeometry args={[0.94, 1, 96]} />
        <meshBasicMaterial color={shiftAccent(accent, 0.7)} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} fog={false} />
      </mesh>
    </group>
  );
}

function RisesOrnament({ accent, punchT }: OrnamentProps) {
  const clock = useMotionClock();
  const platform = useRef<THREE.Group>(null);
  useFrame(() => {
    const t = clock.t;
    const rise = seg(t, 0, punchT * 1.15, easeOutExpo);
    if (platform.current) {
      platform.current.position.y = -3.6 + rise * 2.1 + Math.sin(t * 0.6) * 0.05;
      platform.current.visible = rise > 0.01;
    }
  });
  return (
    <group>
      <BackGlow accent={accent} punchT={punchT} y={-1} />
      <group ref={platform} visible={false} position={[0, -3.6, -0.8]}>
        <RoundedBox args={[7.6, 0.34, 2.4]} radius={0.08} smoothness={4}>
          <meshPhysicalMaterial color="#131820" metalness={0.88} roughness={0.24} clearcoat={1} clearcoatRoughness={0.12} envMapIntensity={1.9} />
        </RoundedBox>
        <mesh position={[0, 0.2, 1.16]}>
          <boxGeometry args={[7.2, 0.05, 0.06]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={2.6} metalness={0.7} roughness={0.24} />
        </mesh>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------- dispatcher */

export function Ornament({ ornament, accent, punchT, duration, chip, brand }: OrnamentProps & { ornament: MotionOrnament }) {
  switch (ornament) {
    case 'mark':
      return <MarkOrnament accent={accent} punchT={punchT} duration={duration} brand={brand} />;
    case 'rings':
      return <RingsOrnament accent={accent} punchT={punchT} duration={duration} />;
    case 'streaks':
      return <StreaksOrnament accent={accent} punchT={punchT} duration={duration} />;
    case 'shards':
      return <ShardsOrnament accent={accent} punchT={punchT} duration={duration} />;
    case 'cards':
      return <CardsOrnament accent={accent} punchT={punchT} duration={duration} />;
    case 'gridfloor':
      return <GridFloorOrnament accent={accent} punchT={punchT} duration={duration} />;
    case 'horizon':
      return <HorizonOrnament accent={accent} punchT={punchT} duration={duration} />;
    case 'stars':
      return <StarsOrnament accent={accent} punchT={punchT} duration={duration} />;
    case 'globe':
      return <GlobeOrnament accent={accent} punchT={punchT} duration={duration} />;
    case 'spotlight':
      return <SpotlightOrnament accent={accent} punchT={punchT} duration={duration} />;
    case 'countdown':
      return <CountdownOrnament accent={accent} punchT={punchT} duration={duration} chip={chip} />;
    case 'shutter':
      return <ShutterOrnament accent={accent} punchT={punchT} duration={duration} />;
    case 'sweep':
      return <SweepOrnament accent={accent} punchT={punchT} duration={duration} />;
    case 'converge':
      return <ConvergeOrnament accent={accent} punchT={punchT} duration={duration} />;
    case 'rises':
    default:
      return <RisesOrnament accent={accent} punchT={punchT} duration={duration} />;
  }
}
