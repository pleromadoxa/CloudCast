import { useMemo } from 'react';
import { MeshReflectorMaterial } from '@react-three/drei';
import * as THREE from 'three';
import type { VirtualSetEnvironment } from '../../lib/prism/virtualSets';
import { pbrFromTexture, pbrSolid } from '../../lib/prism/pbrMaterials';

export interface RoomStyle {
  wallColor: string;
  wallTexture: 'wall_paint' | 'wall_brick' | 'concrete';
  floorTexture: 'wood_oak' | 'wood_walnut' | 'carpet' | 'tile' | 'marble' | 'concrete';
  floorReflective: boolean;
  floorColor: string;
  accent: string;
  width: number;
  depth: number;
  ceilingLights: number;
  envPreset: 'city' | 'apartment' | 'studio' | 'warehouse' | 'sunset' | 'dawn';
}

const ROOM_STYLES: Partial<Record<VirtualSetEnvironment, RoomStyle>> = {
  furnished_living: {
    wallColor: '#292524',
    wallTexture: 'wall_paint',
    floorTexture: 'wood_walnut',
    floorReflective: true,
    floorColor: '#1c1917',
    accent: '#a8a29e',
    width: 14,
    depth: 12,
    ceilingLights: 4,
    envPreset: 'apartment',
  },
  furnished_bedroom: {
    wallColor: '#1e1b4b',
    wallTexture: 'wall_paint',
    floorTexture: 'carpet',
    floorReflective: false,
    floorColor: '#0f0d24',
    accent: '#6366f1',
    width: 12,
    depth: 11,
    ceilingLights: 2,
    envPreset: 'apartment',
  },
  kitchen_set: {
    wallColor: '#f5f5f4',
    wallTexture: 'wall_paint',
    floorTexture: 'tile',
    floorReflective: false,
    floorColor: '#d6d3d1',
    accent: '#78716c',
    width: 12,
    depth: 10,
    ceilingLights: 3,
    envPreset: 'apartment',
  },
  conference_room: {
    wallColor: '#1e293b',
    wallTexture: 'wall_paint',
    floorTexture: 'carpet',
    floorReflective: false,
    floorColor: '#0f172a',
    accent: '#38bdf8',
    width: 14,
    depth: 12,
    ceilingLights: 6,
    envPreset: 'studio',
  },
  corporate: {
    wallColor: '#0f172a',
    wallTexture: 'concrete',
    floorTexture: 'marble',
    floorReflective: true,
    floorColor: '#111827',
    accent: '#38bdf8',
    width: 14,
    depth: 11,
    ceilingLights: 4,
    envPreset: 'city',
  },
  newsroom_full: {
    wallColor: '#0a0a14',
    wallTexture: 'concrete',
    floorTexture: 'concrete',
    floorReflective: true,
    floorColor: '#111118',
    accent: '#e11d48',
    width: 16,
    depth: 12,
    ceilingLights: 8,
    envPreset: 'studio',
  },
  church_stage: {
    wallColor: '#1c1410',
    wallTexture: 'wall_brick',
    floorTexture: 'wood_oak',
    floorReflective: true,
    floorColor: '#0f0a08',
    accent: '#f59e0b',
    width: 16,
    depth: 14,
    ceilingLights: 2,
    envPreset: 'warehouse',
  },
  talk_show: {
    wallColor: '#030308',
    wallTexture: 'concrete',
    floorTexture: 'wood_walnut',
    floorReflective: true,
    floorColor: '#0a0a12',
    accent: '#6366f1',
    width: 14,
    depth: 10,
    ceilingLights: 6,
    envPreset: 'studio',
  },
};

export function roomStyleFor(environment: VirtualSetEnvironment): RoomStyle {
  return ROOM_STYLES[environment] ?? {
    wallColor: '#0a0a12',
    wallTexture: 'concrete',
    floorTexture: 'concrete',
    floorReflective: true,
    floorColor: '#111',
    accent: '#6366f1',
    width: 14,
    depth: 10,
    ceilingLights: 4,
    envPreset: 'studio',
  };
}

function RecessedLights({ count, width, depth, accent }: { count: number; width: number; depth: number; accent: string }) {
  const positions = useMemo(() => {
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const list: [number, number, number][] = [];
    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = -width / 2 + (width / (cols + 1)) * (col + 1);
      const z = -depth / 2 + (depth / (rows + 1)) * (row + 1);
      list.push([x, 2.92, z]);
    }
    return list;
  }, [count, width, depth]);

  return (
    <>
      {positions.map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh>
            <cylinderGeometry args={[0.12, 0.12, 0.03, 16]} />
            <meshStandardMaterial color="#fafafa" roughness={0.35} />
          </mesh>
          <mesh position={[0, -0.02, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 0.01, 16]} />
            <meshStandardMaterial color="#fef9c3" emissive={accent} emissiveIntensity={0.35} />
          </mesh>
          <pointLight color="#fffbeb" intensity={0.18} distance={6} decay={2} />
        </group>
      ))}
    </>
  );
}

export function PhotorealisticRoomShell({ environment }: { environment: VirtualSetEnvironment }) {
  const style = roomStyleFor(environment);
  const { width, depth } = style;
  const trim = useMemo(() => pbrSolid('#44403c', { roughness: 0.45 }), []);
  const wallMat1 = useMemo(() => {
    const m = pbrFromTexture(style.wallTexture, 1, { roughness: 0.72, envMapIntensity: 0.5 });
    m.color = new THREE.Color(style.wallColor);
    return m;
  }, [style.wallColor, style.wallTexture]);
  const wallMat2 = useMemo(() => {
    const m = pbrFromTexture(style.wallTexture, 2, { roughness: 0.72, envMapIntensity: 0.5 });
    m.color = new THREE.Color(style.wallColor);
    return m;
  }, [style.wallColor, style.wallTexture]);
  const wallMat3 = useMemo(() => {
    const m = pbrFromTexture(style.wallTexture, 3, { roughness: 0.72, envMapIntensity: 0.5 });
    m.color = new THREE.Color(style.wallColor);
    return m;
  }, [style.wallColor, style.wallTexture]);
  const floorMat = useMemo(
    () => pbrFromTexture(style.floorTexture, 4, { roughness: style.floorTexture === 'carpet' ? 0.95 : 0.55 }),
    [style.floorTexture],
  );

  return (
    <>
      <color attach="background" args={[style.wallColor]} />
      <mesh position={[0, 2.5, -depth / 2]} receiveShadow material={wallMat1}>
        <planeGeometry args={[width, 5]} />
      </mesh>
      <mesh position={[-width / 2, 2.5, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow material={wallMat2}>
        <planeGeometry args={[depth, 5]} />
      </mesh>
      <mesh position={[width / 2, 2.5, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow material={wallMat3}>
        <planeGeometry args={[depth, 5]} />
      </mesh>
      <mesh position={[0, 2.95, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#fafafa" roughness={0.85} />
      </mesh>
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        {style.floorReflective ? (
          <MeshReflectorMaterial
            blur={[400, 120]}
            mixBlur={0.85}
            mixStrength={0.42}
            color={style.floorColor}
            metalness={0.15}
            roughness={0.35}
            mirror={0.35}
          />
        ) : (
          <primitive object={floorMat} attach="material" />
        )}
      </mesh>
      {[[-width / 2, depth / 2], [width / 2, depth / 2], [-width / 2, -depth / 2], [width / 2, -depth / 2]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.08, z]} material={trim}>
          <boxGeometry args={[0.08, 0.16, 0.08]} />
        </mesh>
      ))}
      <mesh position={[0, 0.06, -depth / 2 + 0.01]} material={trim}>
        <boxGeometry args={[width, 0.12, 0.06]} />
      </mesh>
      <RecessedLights count={style.ceilingLights} width={width} depth={depth} accent={style.accent} />
    </>
  );
}

export function environmentPresetFor(environment: VirtualSetEnvironment): RoomStyle['envPreset'] {
  return roomStyleFor(environment).envPreset;
}
