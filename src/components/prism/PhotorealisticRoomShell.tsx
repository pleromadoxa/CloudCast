/* eslint-disable react-refresh/only-export-components -- the room-style presets and their resolver share one preset-driven module (same pattern as MotionTemplateEngine) */
import { useMemo } from 'react';
import { MeshReflectorMaterial } from '@react-three/drei';
import * as THREE from 'three';
import type { VirtualSetEnvironment } from '../../lib/prism/virtualSets';
import { carpetMaterial, pbrFromTexture, pbrSolid } from '../../lib/prism/pbrMaterials';

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

const ROOM_STYLES: Record<VirtualSetEnvironment, RoomStyle> = {
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
  /* ---- broadcast / news families ---- */
  news_studio: {
    wallColor: '#0b0d16',
    wallTexture: 'concrete',
    floorTexture: 'concrete',
    floorReflective: true,
    floorColor: '#0e1018',
    accent: '#e11d48',
    width: 14,
    depth: 11,
    ceilingLights: 6,
    envPreset: 'studio',
  },
  news_premium: {
    wallColor: '#070b18',
    wallTexture: 'concrete',
    floorTexture: 'concrete',
    floorReflective: true,
    floorColor: '#0a0f1e',
    accent: '#06b6d4',
    width: 16,
    depth: 12,
    ceilingLights: 4,
    envPreset: 'studio',
  },
  broadcast_desk: {
    wallColor: '#08140e',
    wallTexture: 'concrete',
    floorTexture: 'concrete',
    floorReflective: true,
    floorColor: '#0c140f',
    accent: '#22c55e',
    width: 16,
    depth: 12,
    ceilingLights: 6,
    envPreset: 'studio',
  },
  xr_stage: {
    wallColor: '#04040a',
    wallTexture: 'concrete',
    floorTexture: 'concrete',
    floorReflective: true,
    floorColor: '#07070f',
    accent: '#6366f1',
    width: 16,
    depth: 12,
    ceilingLights: 2,
    envPreset: 'studio',
  },
  /* ---- corporate / meeting ---- */
  /* ---- worship / music ---- */
  church_sanctuary: {
    wallColor: '#2a1d15',
    wallTexture: 'wall_brick',
    floorTexture: 'wood_oak',
    floorReflective: true,
    floorColor: '#241a12',
    accent: '#f59e0b',
    width: 18,
    depth: 16,
    ceilingLights: 2,
    envPreset: 'warehouse',
  },
  music_ministry: {
    wallColor: '#140d1e',
    wallTexture: 'concrete',
    floorTexture: 'concrete',
    floorReflective: true,
    floorColor: '#0e0a16',
    accent: '#8b5cf6',
    width: 16,
    depth: 13,
    ceilingLights: 2,
    envPreset: 'warehouse',
  },
  /* ---- luxury / concert ---- */
  luxury_ballroom: {
    wallColor: '#2b2118',
    wallTexture: 'wall_paint',
    floorTexture: 'marble',
    floorReflective: true,
    floorColor: '#1f1812',
    accent: '#d4af37',
    width: 20,
    depth: 16,
    ceilingLights: 4,
    envPreset: 'city',
  },
  concert_hall: {
    wallColor: '#0a0a10',
    wallTexture: 'concrete',
    floorTexture: 'concrete',
    floorReflective: true,
    floorColor: '#0c0c12',
    accent: '#ef4444',
    width: 26,
    depth: 20,
    ceilingLights: 2,
    envPreset: 'warehouse',
  },
  /* ---- lifestyle / specialist ---- */
  podcast_studio: {
    wallColor: '#241a15',
    wallTexture: 'wall_paint',
    floorTexture: 'carpet',
    floorReflective: false,
    floorColor: '#1a120e',
    accent: '#10b981',
    width: 10,
    depth: 9,
    ceilingLights: 4,
    envPreset: 'apartment',
  },
  fitness_studio: {
    wallColor: '#e4e4e7',
    wallTexture: 'wall_paint',
    floorTexture: 'concrete',
    floorReflective: false,
    floorColor: '#d4d4d8',
    accent: '#f97316',
    width: 16,
    depth: 12,
    ceilingLights: 6,
    envPreset: 'studio',
  },
  real_estate: {
    wallColor: '#18181b',
    wallTexture: 'wall_paint',
    floorTexture: 'marble',
    floorReflective: true,
    floorColor: '#101014',
    accent: '#3b82f6',
    width: 14,
    depth: 11,
    ceilingLights: 4,
    envPreset: 'city',
  },
  auction_house: {
    wallColor: '#241812',
    wallTexture: 'wall_paint',
    floorTexture: 'wood_walnut',
    floorReflective: true,
    floorColor: '#1c130d',
    accent: '#92400e',
    width: 14,
    depth: 12,
    ceilingLights: 4,
    envPreset: 'city',
  },
  film_noir: {
    wallColor: '#0c0c0e',
    wallTexture: 'concrete',
    floorTexture: 'wood_walnut',
    floorReflective: true,
    floorColor: '#0a0a0c',
    accent: '#8ec5ff',
    width: 12,
    depth: 10,
    ceilingLights: 2,
    envPreset: 'dawn',
  },
  library_study: {
    wallColor: '#2a1c12',
    wallTexture: 'wall_paint',
    floorTexture: 'carpet',
    floorReflective: false,
    floorColor: '#241a12',
    accent: '#78350f',
    width: 13,
    depth: 11,
    ceilingLights: 4,
    envPreset: 'apartment',
  },
  /* ---- open-air / exterior ---- */
  outdoor_ar: {
    wallColor: '#cfd6dc',
    wallTexture: 'concrete',
    floorTexture: 'tile',
    floorReflective: false,
    floorColor: '#aeb6bd',
    accent: '#38bdf8',
    width: 18,
    depth: 14,
    ceilingLights: 0,
    envPreset: 'dawn',
  },
  residential_exterior: {
    wallColor: '#8dc2e8',
    wallTexture: 'wall_paint',
    floorTexture: 'tile',
    floorReflective: false,
    floorColor: '#3e7a3a',
    accent: '#f59e0b',
    width: 20,
    depth: 16,
    ceilingLights: 0,
    envPreset: 'dawn',
  },
  rooftop_terrace: {
    wallColor: '#243044',
    wallTexture: 'concrete',
    floorTexture: 'tile',
    floorReflective: false,
    floorColor: '#575046',
    accent: '#0ea5e9',
    width: 18,
    depth: 14,
    ceilingLights: 0,
    envPreset: 'sunset',
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

  // Fixture trim + lens — full map set so the housing catches the room's
  // bounce like a real painted can instead of reading as flat unlit white.
  const housingMat = useMemo(() => pbrSolid('#fafafa', { roughness: 0.35, metalness: 0.1 }), []);
  const lensMat = useMemo(
    () => pbrSolid('#fef9c3', { roughness: 0.6, metalness: 0, emissive: accent, emissiveIntensity: 0.35 }),
    [accent],
  );

  return (
    <>
      {positions.map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh material={housingMat}>
            <cylinderGeometry args={[0.12, 0.12, 0.03, 16]} />
          </mesh>
          <mesh position={[0, -0.02, 0]} material={lensMat}>
            <cylinderGeometry args={[0.09, 0.09, 0.01, 16]} />
          </mesh>
          <pointLight color="#fffbeb" intensity={0.18} distance={6} decay={2} />
        </group>
      ))}
    </>
  );
}

/** Builds a wall/floor material whose maps tile at a believable physical scale. */
function tiledPbrMaterial(
  kind: Parameters<typeof pbrFromTexture>[0],
  seed: number,
  color: string,
  size: [number, number],
  tileMeters = 2.2,
  opts: { roughness?: number; envMapIntensity?: number } = {},
) {
  const m = pbrFromTexture(kind, seed, {
    roughness: opts.roughness ?? 0.72,
    envMapIntensity: opts.envMapIntensity ?? 0.85,
  });
  m.color = new THREE.Color(color);
  // Clone the shared procedural maps so each surface tiles at physical scale
  // (~tileMeters per texture tile) instead of stretching one 256px canvas
  // across a whole wall — which is what made walls read as flat noise.
  for (const key of ['map', 'normalMap', 'roughnessMap'] as const) {
    const t = m[key];
    if (t) {
      const clone = t.clone();
      clone.wrapS = THREE.RepeatWrapping;
      clone.wrapT = THREE.RepeatWrapping;
      clone.repeat.set(Math.max(1, size[0] / tileMeters), Math.max(1, size[1] / tileMeters));
      clone.needsUpdate = true;
      m[key] = clone;
    }
  }
  return m;
}

export function PhotorealisticRoomShell({ environment }: { environment: VirtualSetEnvironment }) {
  const style = roomStyleFor(environment);
  const { width, depth } = style;
  const trim = useMemo(() => pbrSolid('#44403c', { roughness: 0.45 }), []);
  const wallMat1 = useMemo(
    () => tiledPbrMaterial(style.wallTexture, 1, style.wallColor, [width, 5]),
    [style.wallColor, style.wallTexture, width],
  );
  const wallMat2 = useMemo(
    () => tiledPbrMaterial(style.wallTexture, 2, style.wallColor, [depth, 5]),
    [style.wallColor, style.wallTexture, depth],
  );
  const wallMat3 = useMemo(
    () => tiledPbrMaterial(style.wallTexture, 3, style.wallColor, [depth, 5]),
    [style.wallColor, style.wallTexture, depth],
  );
  const ceilingMat = useMemo(() => pbrSolid('#fafafa', { roughness: 0.85, metalness: 0.02 }), []);
  const floorMat = useMemo(
    () =>
      tiledPbrMaterial(style.floorTexture, 4, style.floorColor, [width, depth], 1.6, {
        roughness: style.floorTexture === 'carpet' ? 0.95 : 0.55,
        envMapIntensity: 1,
      }),
    [style.floorTexture, style.floorColor, width, depth],
  );
  // Carpet floors swap the generic surface for the full wool pile BRDF —
  // heathered albedo, sheen, pile-lay anisotropy and tuft displacement.
  const carpetMat = useMemo(
    () =>
      style.floorTexture === 'carpet'
        ? carpetMaterial(style.floorColor, 4, {
            repeat: [Math.max(1, width / 1.6), Math.max(1, depth / 1.6)],
          })
        : null,
    [style.floorTexture, style.floorColor, width, depth],
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
      <mesh position={[0, 2.95, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow material={ceilingMat}>
        <planeGeometry args={[width, depth]} />
      </mesh>
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        {carpetMat ? (
          /* Real carpet: subdivided slab so the pile displacement lifts the
             tufts off the backing under grazing light. */
          <>
            <planeGeometry args={[width, depth, 72, 54]} />
            <primitive object={carpetMat} attach="material" />
          </>
        ) : (
          <>
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
          </>
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
