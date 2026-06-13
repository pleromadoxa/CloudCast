import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { CloudCastProductId } from '../../types/products';
import { productAccentTheme } from './productAccent';
import type { CloudCastProduct } from '../../types/products';

interface SceneProps {
  productId: CloudCastProductId;
  accentHex: string;
  emissiveHex: string;
  hovered: boolean;
}

function accentMaterialProps(accentHex: string, emissiveHex: string, metalness = 0.55, roughness = 0.35) {
  return {
    color: accentHex,
    emissive: emissiveHex,
    emissiveIntensity: 0.35,
    metalness,
    roughness,
  };
}

function VideoMixerModel({ accentHex, emissiveHex, hovered }: Omit<SceneProps, 'productId'>) {
  const group = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * (hovered ? 0.9 : 0.35);
  });

  return (
    <group ref={group}>
      <RoundedBox args={[2.4, 0.45, 1.4]} radius={0.06} position={[0, -0.35, 0]}>
        <meshStandardMaterial color="#1a1a1a" metalness={0.7} roughness={0.25} />
      </RoundedBox>
      {[-0.55, 0.55].map((x, i) => (
        <group key={x} position={[x, 0.35, -0.15]} rotation={[-0.25, 0, 0]}>
          <mesh>
            <boxGeometry args={[0.85, 0.55, 0.06]} />
            <meshStandardMaterial {...accentMaterialProps(accentHex, emissiveHex)} />
          </mesh>
          <mesh position={[0, 0, 0.04]}>
            <planeGeometry args={[0.72, 0.42]} />
            <meshBasicMaterial color={i === 0 ? '#111' : accentHex} />
          </mesh>
        </group>
      ))}
      {Array.from({ length: 12 }, (_, i) => (
        <mesh
          key={i}
          position={[-0.9 + (i % 6) * 0.32, -0.28, 0.72]}
        >
          <boxGeometry args={[0.18, 0.12, 0.08]} />
          <meshStandardMaterial
            color={i % 3 === 0 ? accentHex : '#2a2a2a'}
            emissive={i % 3 === 0 ? emissiveHex : '#000'}
            emissiveIntensity={i % 3 === 0 ? 0.6 : 0}
            metalness={0.5}
            roughness={0.4}
          />
        </mesh>
      ))}
    </group>
  );
}

function AudioMixerModel({ accentHex, emissiveHex, hovered }: Omit<SceneProps, 'productId'>) {
  const group = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * (hovered ? 0.85 : 0.3);
  });

  return (
    <group ref={group}>
      <RoundedBox args={[2.5, 0.2, 1.1]} radius={0.04} position={[0, -0.55, 0]}>
        <meshStandardMaterial color="#141414" metalness={0.65} roughness={0.3} />
      </RoundedBox>
      {Array.from({ length: 8 }, (_, i) => {
        const x = -1.05 + i * 0.3;
        const height = 0.35 + (i % 4) * 0.12;
        return (
          <group key={i} position={[x, -0.1, 0]}>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.12, 0.7, 0.5]} />
              <meshStandardMaterial color="#222" metalness={0.5} roughness={0.45} />
            </mesh>
            <mesh position={[0, height - 0.35, 0.02]}>
              <boxGeometry args={[0.14, 0.08, 0.52]} />
              <meshStandardMaterial
                color={accentHex}
                emissive={emissiveHex}
                emissiveIntensity={0.5}
                metalness={0.6}
                roughness={0.3}
              />
            </mesh>
            <mesh position={[0, 0.42, 0.28]}>
              <cylinderGeometry args={[0.06, 0.06, 0.04, 16]} />
              <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function SymphonyModel({ accentHex, emissiveHex, hovered }: Omit<SceneProps, 'productId'>) {
  const group = useRef<THREE.Group>(null);
  const bars = useRef<THREE.Mesh[]>([]);

  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * (hovered ? 0.75 : 0.28);
    bars.current.forEach((bar, i) => {
      if (!bar) return;
      bar.scale.y = 0.4 + Math.sin(state.clock.elapsedTime * 2.2 + i * 0.55) * 0.25 + 0.35;
    });
  });

  return (
    <group ref={group}>
      {Array.from({ length: 14 }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) bars.current[i] = el;
          }}
          position={[-1.3 + i * 0.2, 0, 0]}
        >
          <boxGeometry args={[0.1, 0.8, 0.1]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? accentHex : '#4c1d95'}
            emissive={emissiveHex}
            emissiveIntensity={0.4}
            metalness={0.45}
            roughness={0.35}
          />
        </mesh>
      ))}
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={`key-${i}`} position={[-0.9 + i * 0.28, -0.55, 0.35]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.22, 0.08, 0.35]} />
          <meshStandardMaterial color={i % 2 === 0 ? '#f8fafc' : '#0f172a'} roughness={0.5} metalness={0.1} />
        </mesh>
      ))}
    </group>
  );
}

function ReplayModel({ accentHex, emissiveHex, hovered }: Omit<SceneProps, 'productId'>) {
  const group = useRef<THREE.Group>(null);
  const reels = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * (hovered ? 0.7 : 0.25);
    if (reels.current) reels.current.rotation.z += delta * (hovered ? 1.4 : 0.6);
  });

  return (
    <group ref={group}>
      <group ref={reels}>
        {[-0.65, 0.65].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.55, 0.55, 0.18, 32]} />
              <meshStandardMaterial color="#1f2937" metalness={0.7} roughness={0.3} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.35, 0.06, 8, 24]} />
              <meshStandardMaterial color={accentHex} emissive={emissiveHex} emissiveIntensity={0.45} metalness={0.6} roughness={0.35} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.9, 0.22, 0.04]} />
          <meshStandardMaterial color="#374151" metalness={0.4} roughness={0.5} />
        </mesh>
      </group>
      <mesh position={[0, 0, 0.35]}>
        <circleGeometry args={[0.28, 32]} />
        <meshStandardMaterial color={accentHex} emissive={emissiveHex} emissiveIntensity={0.7} metalness={0.3} roughness={0.4} />
      </mesh>
      <mesh position={[0.1, 0.05, 0.36]} rotation={[0, 0, -Math.PI / 6]}>
        <coneGeometry args={[0.12, 0.2, 3]} />
        <meshBasicMaterial color="#0a0a0a" />
      </mesh>
    </group>
  );
}

function DisplayModel({ accentHex, emissiveHex, hovered }: Omit<SceneProps, 'productId'>) {
  const group = useRef<THREE.Group>(null);
  const slide = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * (hovered ? 0.65 : 0.22);
    if (slide.current) {
      slide.current.position.y = Math.sin(state.clock.elapsedTime * 1.2) * 0.04;
    }
  });

  return (
    <group ref={group}>
      <mesh position={[0, -0.15, 0]} rotation={[-0.08, 0, 0]}>
        <boxGeometry args={[1.8, 1.1, 0.08]} />
        <meshStandardMaterial color="#111" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh ref={slide} position={[0, 0.05, 0.06]} rotation={[-0.08, 0, 0]}>
        <planeGeometry args={[1.5, 0.85]} />
        <meshStandardMaterial
          color={accentHex}
          emissive={emissiveHex}
          emissiveIntensity={0.55}
          metalness={0.2}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[-0.55, 0.35, 0.5]} rotation={[0.4, 0.3, 0]}>
        <boxGeometry args={[0.35, 0.2, 0.45]} />
        <meshStandardMaterial color="#222" metalness={0.65} roughness={0.3} />
      </mesh>
      <mesh position={[-0.55, 0.55, 0.85]} rotation={[0.5, 0.3, 0]}>
        <coneGeometry args={[0.5, 0.9, 4, 1, true]} />
        <meshBasicMaterial color={accentHex} transparent opacity={0.12} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function PrismModel({ accentHex, emissiveHex, hovered }: Omit<SceneProps, 'productId'>) {
  const group = useRef<THREE.Group>(null);
  const gem = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (!group.current || !gem.current) return;
    group.current.rotation.y += delta * (hovered ? 1.1 : 0.45);
    gem.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.8) * 0.15;
    gem.current.rotation.z = Math.cos(state.clock.elapsedTime * 0.6) * 0.1;
  });

  return (
    <group ref={group}>
      <Float speed={1.5} rotationIntensity={0.15} floatIntensity={0.35}>
        <mesh ref={gem}>
          <octahedronGeometry args={[0.85, 0]} />
          <meshPhysicalMaterial
            color={accentHex}
            emissive={emissiveHex}
            emissiveIntensity={0.5}
            metalness={0.15}
            roughness={0.05}
            transmission={0.55}
            thickness={0.8}
            ior={1.6}
            clearcoat={1}
            clearcoatRoughness={0.1}
          />
        </mesh>
      </Float>
      {Array.from({ length: 6 }, (_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(angle) * 1.1, Math.sin(angle * 2) * 0.15, Math.sin(angle) * 1.1]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshBasicMaterial color={accentHex} />
          </mesh>
        );
      })}
    </group>
  );
}

function UniversalModel({ hovered }: { hovered: boolean }) {
  const group = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * (hovered ? 0.6 : 0.2);
  });

  const colors = ['#e11d48', '#0ea5e9', '#8b5cf6', '#10b981', '#a855f7', '#f59e0b'];

  return (
    <group ref={group}>
      {colors.map((color, i) => {
        const angle = (i / colors.length) * Math.PI * 2;
        const radius = 1.05;
        return (
          <mesh key={color} position={[Math.cos(angle) * radius, Math.sin(angle * 2) * 0.12, Math.sin(angle) * radius]}>
            <boxGeometry args={[0.42, 0.42, 0.42]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} metalness={0.5} roughness={0.35} />
          </mesh>
        );
      })}
      <mesh>
        <torusGeometry args={[0.55, 0.06, 12, 48]} />
        <meshStandardMaterial color="#f59e0b" emissive="#b45309" emissiveIntensity={0.4} metalness={0.7} roughness={0.25} />
      </mesh>
    </group>
  );
}

function ProductModel({ productId, accentHex, emissiveHex, hovered }: SceneProps) {
  if (productId === 'video_mixer') return <VideoMixerModel accentHex={accentHex} emissiveHex={emissiveHex} hovered={hovered} />;
  if (productId === 'audio_mixer') return <AudioMixerModel accentHex={accentHex} emissiveHex={emissiveHex} hovered={hovered} />;
  if (productId === 'symphony_studio') return <SymphonyModel accentHex={accentHex} emissiveHex={emissiveHex} hovered={hovered} />;
  if (productId === 'instant_replay') return <ReplayModel accentHex={accentHex} emissiveHex={emissiveHex} hovered={hovered} />;
  if (productId === 'regal_display') return <DisplayModel accentHex={accentHex} emissiveHex={emissiveHex} hovered={hovered} />;
  return <PrismModel accentHex={accentHex} emissiveHex={emissiveHex} hovered={hovered} />;
}

function Scene({ productId, accentHex, emissiveHex, hovered }: SceneProps) {
  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight position={[3, 4, 2]} intensity={1.1} color="#ffffff" />
      <directionalLight position={[-2, 1, -3]} intensity={0.35} color={accentHex} />
      <pointLight position={[0, 1.5, 2]} intensity={0.6} color={accentHex} />
      <ProductModel productId={productId} accentHex={accentHex} emissiveHex={emissiveHex} hovered={hovered} />
    </>
  );
}

interface ProductScene3DProps {
  productId: CloudCastProductId;
  accent: CloudCastProduct['accent'];
  className?: string;
}

export function ProductScene3D({ productId, accent, className }: ProductScene3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [inView, setInView] = useState(false);
  const theme = productAccentTheme(accent);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.15, rootMargin: '80px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-b ${theme.gradient}`} />
      <Canvas
        camera={{ position: [0, 0.1, 3.8], fov: 42 }}
        dpr={[1, 1.5]}
        frameloop={inView ? 'always' : 'never'}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={null}>
          <Scene productId={productId} accentHex={theme.hex} emissiveHex={theme.emissive} hovered={hovered} />
        </Suspense>
      </Canvas>
    </div>
  );
}

export function UniversalScene3D({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.15, rootMargin: '80px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-amber-500/15 via-amber-950/30 to-transparent" />
      <Canvas
        camera={{ position: [0, 0.2, 4.2], fov: 40 }}
        dpr={[1, 1.5]}
        frameloop={inView ? 'always' : 'never'}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[2, 3, 2]} intensity={1} />
          <pointLight position={[0, 2, 1]} intensity={0.5} color="#f59e0b" />
          <UniversalModel hovered={hovered} />
        </Suspense>
      </Canvas>
    </div>
  );
}
