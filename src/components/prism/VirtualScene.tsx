import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, ContactShadows, Text, MeshReflectorMaterial } from '@react-three/drei';
import {
  Bloom,
  DepthOfField,
  EffectComposer,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import type { VirtualSetDefinition } from '../../lib/prism/virtualSets';
import { ImportedModelGroup, type ImportedModelEntry } from './ImportedModelGroup';
import { ProceduralModelGroup } from './ProceduralModelGroup';
import { PhotorealisticRoomShell } from './PhotorealisticRoomShell';
import { SceneOrbitControls } from './SceneOrbitControls';
import { LightBeam } from '../virtualStudio/fixtures/LightBeam';
import { Bookshelf, OverheadTruss } from '../virtualStudio/fixtures/furniture';
import { Chandelier, DrumKit, StringLights } from '../virtualStudio/fixtures/setPieces';
import type { PrismSceneObject } from '../../types/prismFeed';

interface VirtualSceneProps {
  virtualSet: VirtualSetDefinition;
  keyedCanvas: HTMLCanvasElement | null;
  rawVideo?: HTMLVideoElement | null;
  mode: 'virtual_studio' | 'augmented_reality' | 'xr_extension';
  cameraYaw: number;
  cameraPitch: number;
  cameraZoom: number;
  /** Free-camera look-at point — panning flies the camera anywhere in the set. */
  cameraTarget?: [number, number, number];
  showShadows: boolean;
  showReflections: boolean;
  importedModels?: ImportedModelEntry[];
  sceneObjects?: PrismSceneObject[];
  onGlReady?: (canvas: HTMLCanvasElement) => void;
  keyerEnabled?: boolean;
  virtualSetEnabled?: boolean;
  orbitEnabled?: boolean;
  onCameraChange?: (patch: {
    yaw?: number;
    pitch?: number;
    zoom?: number;
    target?: [number, number, number];
  }) => void;
}

/** LTC lookup tables for area lights — must exist before the first frame. */
let areaLightTablesReady = false;
function ensureAreaLightTables() {
  if (areaLightTablesReady) return;
  RectAreaLightUniformsLib.init();
  areaLightTablesReady = true;
}

function RawTalent({ video }: { video: HTMLVideoElement | null }) {
  const texture = useMemo(() => {
    if (!video) return null;
    const tex = new THREE.VideoTexture(video);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    // Un-mirror the mirrored camera feed so the output reads the right way round.
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.x = -1;
    tex.offset.x = 1;
    return tex;
  }, [video]);

  useFrame(() => {
    // live video/canvas textures must be re-uploaded to the GPU every frame
    // eslint-disable-next-line react-hooks/immutability
    if (texture) texture.needsUpdate = true;
  });

  if (!texture) return null;

  return (
    <group position={[0, 0.95, 0.55]}>
      <mesh>
        <planeGeometry args={[2.4, 1.35]} />
        <meshBasicMaterial map={texture} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function KeyedTalent({
  canvas,
  showReflections,
}: {
  canvas: HTMLCanvasElement | null;
  showReflections: boolean;
}) {
  const texture = useMemo(() => {
    if (!canvas) return null;
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    // Un-mirror the mirrored camera feed so the output reads the right way round.
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.x = -1;
    tex.offset.x = 1;
    return tex;
  }, [canvas]);

  useFrame(() => {
    // live video/canvas textures must be re-uploaded to the GPU every frame
    // eslint-disable-next-line react-hooks/immutability
    if (texture) texture.needsUpdate = true;
  });

  if (!texture) return null;

  return (
    <group position={[0, 0.95, 0.55]}>
      <mesh>
        <planeGeometry args={[2.4, 1.35]} />
        <meshBasicMaterial map={texture} transparent alphaTest={0.02} side={THREE.DoubleSide} />
      </mesh>
      {showReflections && (
        <mesh position={[0, -0.936, 0.378]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.4, 0.6]} />
          <meshBasicMaterial map={texture} transparent opacity={0.18} alphaTest={0.02} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

function ArCameraBackground({ video }: { video: HTMLVideoElement | null }) {
  const texture = useMemo(() => {
    if (!video) return null;
    const tex = new THREE.VideoTexture(video);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    // Un-mirror the mirrored camera plate so the AR background reads correctly.
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.x = -1;
    tex.offset.x = 1;
    return tex;
  }, [video]);

  useFrame(() => {
    // live video/canvas textures must be re-uploaded to the GPU every frame
    // eslint-disable-next-line react-hooks/immutability
    if (texture) texture.needsUpdate = true;
  });

  if (!texture) return null;

  return (
    <mesh position={[0, 0, -4]}>
      <planeGeometry args={[16, 9]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

/**
 * Local CC0 HDRI per set family — real image-based lighting gives materials
 * believable ambient, colour bleed and reflections instead of flat studio fill.
 * Each entry carries the intensity the scan needs: daylight arenas read far
 * hotter than intimate wood interiors and have to be pulled back.
 */
const ENVIRONMENT_PROFILES: Record<
  VirtualSetDefinition['environment'],
  { file: string; intensity: number }
> = {
  // Broadcast studios — neutral photographic soft-box light, true white balance.
  news_studio: { file: '/hdri/photo_studio_01_1k.hdr', intensity: 1 },
  newsroom_full: { file: '/hdri/photo_studio_01_1k.hdr', intensity: 1 },
  news_premium: { file: '/hdri/photo_studio_01_1k.hdr', intensity: 0.95 },
  broadcast_desk: { file: '/hdri/photo_studio_01_1k.hdr', intensity: 1 },
  // Clean overhead studio — corporate, meeting and presentation spaces.
  corporate: { file: '/hdri/studio_small_08_1k.hdr', intensity: 1 },
  conference_room: { file: '/hdri/studio_small_08_1k.hdr', intensity: 1 },
  real_estate: { file: '/hdri/studio_small_08_1k.hdr', intensity: 1.1 },
  fitness_studio: { file: '/hdri/studio_small_08_1k.hdr', intensity: 1.15 },
  outdoor_ar: { file: '/hdri/stadium_01_1k.hdr', intensity: 1 },
  rooftop_terrace: { file: '/hdri/stadium_01_1k.hdr', intensity: 0.9 },
  residential_exterior: { file: '/hdri/stadium_01_1k.hdr', intensity: 1.05 },
  // Warm wood interiors — home sets, sanctuary, library.
  kitchen_set: { file: '/hdri/brown_photostudio_02_1k.hdr', intensity: 1 },
  furnished_living: { file: '/hdri/brown_photostudio_02_1k.hdr', intensity: 1 },
  furnished_bedroom: { file: '/hdri/brown_photostudio_02_1k.hdr', intensity: 1.05 },
  church_stage: { file: '/hdri/brown_photostudio_02_1k.hdr', intensity: 0.9 },
  church_sanctuary: { file: '/hdri/brown_photostudio_02_1k.hdr', intensity: 0.95 },
  library_study: { file: '/hdri/brown_photostudio_02_1k.hdr', intensity: 0.95 },
  luxury_ballroom: { file: '/hdri/brown_photostudio_02_1k.hdr', intensity: 1.05 },
  auction_house: { file: '/hdri/brown_photostudio_02_1k.hdr', intensity: 1 },
  // Theatrical stages — daylight scans pulled way down so dark sets stay dark.
  talk_show: { file: '/hdri/photo_studio_01_1k.hdr', intensity: 0.9 },
  podcast_studio: { file: '/hdri/brown_photostudio_02_1k.hdr', intensity: 0.72 },
  film_noir: { file: '/hdri/brown_photostudio_02_1k.hdr', intensity: 0.55 },
  music_ministry: { file: '/hdri/park_music_stage_1k.hdr', intensity: 0.16 },
  concert_hall: { file: '/hdri/park_music_stage_1k.hdr', intensity: 0.14 },
  xr_stage: { file: '/hdri/park_music_stage_1k.hdr', intensity: 0.2 },
};

function hdriFor(environment: VirtualSetDefinition['environment']) {
  return ENVIRONMENT_PROFILES[environment] ?? ENVIRONMENT_PROFILES.news_studio;
}

/**
 * Stage-light beam drawn between two explicit points so a fixture on the truss
 * can fan diagonally down to a mark on the deck — `LightBeam` only aims along
 * its own axis, so this turns the fixture → target vector into the rotation.
 */
function BeamCone({
  from,
  to,
  color,
  radius = 1,
}: {
  from: [number, number, number];
  to: [number, number, number];
  color: string;
  radius?: number;
}) {
  const { position, rotation, height } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = b.clone().sub(a);
    const length = Math.max(dir.length(), 0.001);
    dir.normalize();
    // LightBeam fires along local -Y; aim that axis at the landing point.
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    const euler = new THREE.Euler().setFromQuaternion(quat);
    return {
      position: from,
      height: length,
      rotation: [euler.x, euler.y, euler.z] as [number, number, number],
    };
  }, [from, to]);

  return (
    <LightBeam
      position={position}
      rotation={rotation}
      height={height}
      radius={radius}
      color={color}
      pool={false}
    />
  );
}

/**
 * Dusk city horizon for open-air sets — one canvas plate with the gradient sky
 * and lit windows baked in, pinned just in front of the room shell's back wall
 * so the parapet reads as standing against a real skyline.
 */
function Skyline() {
  const texture = useMemo(() => {
    const w = 1024;
    const h = 512;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0d1430');
    sky.addColorStop(0.4, '#2f4170');
    sky.addColorStop(0.74, '#b4614a');
    sky.addColorStop(1, '#f0a473');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Deterministic hash instead of a running PRNG — the same key always
    // yields the same skyline, and no state is mutated from inside a closure.
    const rand = (a: number, b: number) => {
      const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
      return v - Math.floor(v);
    };

    // Far ridge first, nearer blocks over it — parallax without layers.
    for (let layer = 0; layer < 2; layer += 1) {
      let x = layer === 0 ? -20 : -12;
      while (x < w) {
        const bw = 30 + Math.floor(rand(x, layer) * 58);
        const bh = (layer === 0 ? 70 : 110) + Math.floor(rand(x + 7, layer) * (layer === 0 ? 150 : 210));
        const base = layer === 0 ? 26 : 14;
        ctx.fillStyle = `rgb(${base}, ${base + 4}, ${base + 13})`;
        ctx.fillRect(x, h - bh, bw, bh);
        if (rand(x + bw, layer) < 0.3) {
          // rooftop mast with an aircraft-warning light
          ctx.fillStyle = `rgb(${base + 6}, ${base + 8}, ${base + 16})`;
          ctx.fillRect(x + bw / 2 - 1, h - bh - 26, 2, 26);
          ctx.fillStyle = '#ff6b6b';
          ctx.fillRect(x + bw / 2 - 2, h - bh - 30, 4, 4);
        }
        for (let wy = h - bh + 8; wy < h - 8; wy += 15) {
          for (let wx = x + 5; wx < x + bw - 6; wx += 12) {
            if (rand(wx, wy) < 0.45) {
              ctx.fillStyle = rand(wx + 3, wy + 1) < 0.7 ? '#ffd9a0' : '#cfe0ff';
              ctx.globalAlpha = 0.3 + rand(wx + 5, wy + 2) * 0.65;
              ctx.fillRect(wx, wy, 5, 7);
              ctx.globalAlpha = 1;
            }
          }
        }
        x += bw + 3 + Math.floor(rand(x + 13, layer) * 9);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh position={[0, 2.5, -6.97]}>
      <planeGeometry args={[17.6, 5]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

function StudioEnvironment({ environment }: { environment: VirtualSetDefinition['environment'] }) {
  if (environment === 'news_studio') {
    return (
      <>
        <color attach="background" args={['#0a0a12']} />
        <mesh position={[0, 2, -4]}>
          <planeGeometry args={[12, 6]} />
          <meshStandardMaterial color="#1a1a2e" emissive="#e11d48" emissiveIntensity={0.15} />
        </mesh>
        <mesh position={[0, 0, -3.9]}>
          <planeGeometry args={[10, 0.8]} />
          <meshStandardMaterial color="#e11d48" emissive="#e11d48" emissiveIntensity={0.8} />
        </mesh>
        <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[14, 10]} />
          <MeshReflectorMaterial blur={[300, 100]} mixBlur={0.8} mixStrength={0.4} color="#111" />
        </mesh>
        <Text position={[0, 3.2, -3.5]} fontSize={0.35} color="#ffffff" anchorX="center">
          LIVE
        </Text>
      </>
    );
  }

  if (environment === 'newsroom_full') {
    return (
      <>
        <PhotorealisticRoomShell environment="newsroom_full" />
        <mesh position={[0, 0.04, -5.5]}>
          <planeGeometry args={[12, 0.8]} />
          <meshStandardMaterial color="#e11d48" emissive="#e11d48" emissiveIntensity={0.6} />
        </mesh>
        <Text position={[0, 3.5, -5.8]} fontSize={0.4} color="#ffffff" anchorX="center">
          BREAKING NEWS
        </Text>
      </>
    );
  }

  if (environment === 'church_stage') {
    return (
      <>
        <PhotorealisticRoomShell environment="church_stage" />
        <mesh position={[0, 3.2, -6]}>
          <planeGeometry args={[8, 3]} />
          <meshStandardMaterial color="#422006" emissive="#f59e0b" emissiveIntensity={0.15} />
        </mesh>
        <pointLight position={[0, 4, -2]} intensity={0.8} color="#fbbf24" />
      </>
    );
  }

  if (environment === 'kitchen_set') {
    return <PhotorealisticRoomShell environment="kitchen_set" />;
  }

  if (environment === 'furnished_living') {
    return (
      <>
        <PhotorealisticRoomShell environment="furnished_living" />
        <pointLight position={[-3, 3, 1]} intensity={0.5} color="#fef3c7" />
        <pointLight position={[3, 3, 1]} intensity={0.4} color="#fde68a" />
      </>
    );
  }

  if (environment === 'furnished_bedroom') {
    return <PhotorealisticRoomShell environment="furnished_bedroom" />;
  }

  if (environment === 'talk_show') {
    return <PhotorealisticRoomShell environment="talk_show" />;
  }

  if (environment === 'conference_room') {
    return (
      <>
        <PhotorealisticRoomShell environment="conference_room" />
        <mesh position={[0, 1.8, -5.8]}>
          <planeGeometry args={[6, 2.5]} />
          <meshStandardMaterial color="#334155" emissive="#38bdf8" emissiveIntensity={0.12} />
        </mesh>
      </>
    );
  }

  if (environment === 'residential_exterior') {
    return (
      <>
        <color attach="background" args={['#87ceeb']} />
        <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[30, 30]} />
          <meshStandardMaterial color="#4ade80" />
        </mesh>
        <mesh position={[0, 8, -20]}>
          <planeGeometry args={[40, 16]} />
          <meshStandardMaterial color="#93c5fd" />
        </mesh>
      </>
    );
  }

  if (environment === 'corporate') {
    return (
      <>
        <PhotorealisticRoomShell environment="corporate" />
        <mesh position={[-3, 0, -2]} rotation={[0, 0.3, 0]}>
          <boxGeometry args={[0.05, 3, 2]} />
          <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.3} transparent opacity={0.6} metalness={0.4} roughness={0.2} />
        </mesh>
        <mesh position={[3, 0, -2]} rotation={[0, -0.3, 0]}>
          <boxGeometry args={[0.05, 3, 2]} />
          <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.3} transparent opacity={0.6} metalness={0.4} roughness={0.2} />
        </mesh>
      </>
    );
  }

  if (environment === 'outdoor_ar') {
    return null;
  }

  if (environment === 'broadcast_desk') {
    return (
      <>
        <color attach="background" args={['#0c0c0c']} />
        <mesh position={[0, -0.5, -1]}>
          <boxGeometry args={[4, 0.15, 1.2]} />
          <meshStandardMaterial color="#222" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, 2, -4]}>
          <planeGeometry args={[12, 5]} />
          <meshStandardMaterial color="#14532d" emissive="#22c55e" emissiveIntensity={0.2} />
        </mesh>
      </>
    );
  }

  if (environment === 'xr_stage') {
    return <XrLedStage accent="#6366f1" />;
  }

  if (environment === 'news_premium') {
    return (
      <>
        <PhotorealisticRoomShell environment="news_premium" />
        {/* Glossy video wall framed by red breaking-news strips. */}
        <mesh position={[0, 1.7, -5.94]}>
          <planeGeometry args={[12, 2.4]} />
          <meshStandardMaterial color="#080d1c" emissive="#1d4ed8" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0, 0.1, -5.88]}>
          <boxGeometry args={[13, 0.14, 0.06]} />
          <meshStandardMaterial color="#e11d48" emissive="#e11d48" emissiveIntensity={2.2} />
        </mesh>
        <mesh position={[0, 2.86, -5.88]}>
          <boxGeometry args={[13, 0.1, 0.06]} />
          <meshStandardMaterial color="#e11d48" emissive="#e11d48" emissiveIntensity={1.6} />
        </mesh>
        <Text position={[0, 2.0, -5.86]} fontSize={0.44} color="#ffffff" anchorX="center">
          BREAKING NEWS
        </Text>
        <mesh position={[0, 1.62, -5.86]}>
          <boxGeometry args={[3.6, 0.07, 0.04]} />
          <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={2.6} />
        </mesh>
        {/* Curved anchor desk — the talent reads waist-up behind its top. */}
        <group position={[0, 0, -0.35]}>
          <mesh position={[0, 0.45, 0]} castShadow>
            <cylinderGeometry args={[1.6, 1.6, 0.9, 64, 1, true, -0.95, 1.9]} />
            <meshStandardMaterial color="#101a30" metalness={0.45} roughness={0.32} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0.93, 0]} castShadow>
            <cylinderGeometry args={[1.74, 1.74, 0.07, 64, 1, false, -0.95, 1.9]} />
            <meshStandardMaterial color="#1f2937" metalness={0.7} roughness={0.16} />
          </mesh>
          <mesh position={[0, 0.46, 1.61]}>
            <boxGeometry args={[2, 0.09, 0.05]} />
            <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={2.6} />
          </mesh>
        </group>
        {/* Cyan set-side practicals washing the desk flanks. */}
        <pointLight position={[-3.8, 1.6, -1.6]} intensity={4} distance={7} decay={2} color="#22d3ee" />
        <pointLight position={[3.8, 1.6, -1.6]} intensity={4} distance={7} decay={2} color="#22d3ee" />
      </>
    );
  }

  if (environment === 'church_sanctuary') {
    return (
      <>
        <PhotorealisticRoomShell environment="church_sanctuary" />
        {/* Warm glow backdrop with a luminous cross — the set's focal point. */}
        <mesh position={[0, 1.6, -7.94]}>
          <planeGeometry args={[11, 2.7]} />
          <meshStandardMaterial color="#1a1008" emissive="#92400e" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0, 1.6, -7.88]}>
          <boxGeometry args={[0.3, 2.5, 0.12]} />
          <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={2.4} />
        </mesh>
        <mesh position={[0, 2.1, -7.88]}>
          <boxGeometry args={[1.7, 0.3, 0.12]} />
          <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={2.4} />
        </mesh>
        {/* Warm wall-sconce pillars flanking the chancel. */}
        {[-5.4, 5.4].map((x) => (
          <mesh key={x} position={[x, 1.3, -7.9]}>
            <boxGeometry args={[0.5, 2.5, 0.1]} />
            <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.7} />
          </mesh>
        ))}
        {/* Raised platform, amber fascia and a pair of steps. */}
        <mesh position={[0, 0.18, -4.3]} castShadow receiveShadow>
          <boxGeometry args={[11, 0.36, 4.4]} />
          <meshStandardMaterial color="#2b1c10" roughness={0.55} metalness={0.05} />
        </mesh>
        <mesh position={[0, 0.12, -2.08]}>
          <boxGeometry args={[11, 0.1, 0.05]} />
          <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={1.8} />
        </mesh>
        <mesh position={[0, 0.12, -1.75]} castShadow>
          <boxGeometry args={[2.4, 0.24, 0.5]} />
          <meshStandardMaterial color="#33241a" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.06, -1.3]} castShadow>
          <boxGeometry args={[2.4, 0.12, 0.45]} />
          <meshStandardMaterial color="#33241a" roughness={0.6} />
        </mesh>
        {/* Lectern on the platform. */}
        <group position={[-2.8, 0.36, -3.6]}>
          <mesh position={[0, 0.5, 0]} castShadow>
            <boxGeometry args={[0.7, 1, 0.5]} />
            <meshStandardMaterial color="#3b2415" roughness={0.5} />
          </mesh>
          <mesh position={[0, 1.03, 0.04]} rotation={[-0.32, 0, 0]}>
            <boxGeometry args={[0.86, 0.06, 0.56]} />
            <meshStandardMaterial color="#4a2e1a" roughness={0.4} metalness={0.1} />
          </mesh>
        </group>
        {/* House wash washing warm light over the platform. */}
        <spotLight position={[-4.6, 5.2, 1.2]} angle={0.65} penumbra={0.75} intensity={45} distance={16} decay={2} color="#fbbf24" />
        <spotLight position={[4.6, 5.2, 1.2]} angle={0.65} penumbra={0.75} intensity={45} distance={16} decay={2} color="#f59e0b" />
        <pointLight position={[0, 2.2, -6.6]} intensity={5} distance={9} decay={2} color="#fdba74" />
      </>
    );
  }

  if (environment === 'music_ministry') {
    return (
      <>
        <PhotorealisticRoomShell environment="music_ministry" />
        {/* Black stage riser with a violet LED fascia. */}
        <mesh position={[0, 0.2, -4.5]} castShadow receiveShadow>
          <boxGeometry args={[9.5, 0.4, 3.6]} />
          <meshStandardMaterial color="#16121f" roughness={0.6} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0.14, -2.68]}>
          <boxGeometry args={[9.5, 0.12, 0.05]} />
          <meshStandardMaterial color="#8b5cf6" emissive="#8b5cf6" emissiveIntensity={2} />
        </mesh>
        {/* Overhead truss with beam cones fanning down to the presenter. */}
        <OverheadTruss position={[0, 2.6, -2.6]} length={9} spots={5} accent="#8b5cf6" />
        <BeamCone from={[-3, 2.5, -2.6]} to={[-1.4, 0.2, 0]} color="#a78bfa" radius={1.1} />
        <BeamCone from={[0, 2.5, -2.6]} to={[0, 0.2, 0]} color="#ede9fe" radius={0.9} />
        <BeamCone from={[3, 2.5, -2.6]} to={[1.4, 0.2, 0]} color="#8b5cf6" radius={1.1} />
        <spotLight position={[-3, 2.6, -2.6]} angle={0.45} penumbra={0.6} intensity={30} distance={12} decay={2} color="#a78bfa" />
        <spotLight position={[0, 2.6, -2.6]} angle={0.4} penumbra={0.5} intensity={34} distance={12} decay={2} color="#f5f3ff" />
        <spotLight position={[3, 2.6, -2.6]} angle={0.45} penumbra={0.6} intensity={30} distance={12} decay={2} color="#8b5cf6" />
        {/* Backline: drum kit, amp heads and speaker stacks in silhouette. */}
        <DrumKit position={[0.3, 0.4, -5.4]} />
        {[-3.4, 3.4].map((x) => (
          <group key={x} position={[x, 0.4, -5.6]}>
            <mesh position={[0, 0.34, 0]} castShadow>
              <boxGeometry args={[1.3, 0.68, 0.5]} />
              <meshStandardMaterial color="#0e0b14" roughness={0.65} />
            </mesh>
            <mesh position={[0, 0.74, 0.26]}>
              <planeGeometry args={[1.1, 0.5]} />
              <meshStandardMaterial color="#17131f" emissive="#7c3aed" emissiveIntensity={0.18} roughness={0.9} />
            </mesh>
          </group>
        ))}
        {[-6, 6].map((x) => (
          <group key={x} position={[x, 0, -4.6]}>
            <mesh position={[0, 0.55, 0]} castShadow>
              <boxGeometry args={[1.7, 1.1, 1]} />
              <meshStandardMaterial color="#0d0b12" roughness={0.8} />
            </mesh>
            <mesh position={[0, 1.65, 0]} castShadow>
              <boxGeometry args={[1.7, 1.1, 1]} />
              <meshStandardMaterial color="#0d0b12" roughness={0.8} />
            </mesh>
          </group>
        ))}
      </>
    );
  }

  if (environment === 'luxury_ballroom') {
    return (
      <>
        <PhotorealisticRoomShell environment="luxury_ballroom" />
        {/* Tiered crystal chandelier hung just under the ceiling. */}
        <Chandelier position={[0, 2.88, -1.6]} />
        {/* Polished dance floor with inlaid gold grid lines. */}
        <mesh position={[0, 0.009, -2.4]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[9, 7]} />
          <meshStandardMaterial color="#1a150f" metalness={0.85} roughness={0.07} />
        </mesh>
        {[-4.55, 4.55].map((x) => (
          <mesh key={x} position={[x, 0.011, -2.4]}>
            <boxGeometry args={[0.08, 0.02, 7.1]} />
            <meshStandardMaterial color="#b8860b" emissive="#d4af37" emissiveIntensity={0.7} metalness={0.9} roughness={0.3} />
          </mesh>
        ))}
        {[-5.9, 1.1].map((z) => (
          <mesh key={z} position={[0, 0.011, z]}>
            <boxGeometry args={[9.1, 0.02, 0.08]} />
            <meshStandardMaterial color="#b8860b" emissive="#d4af37" emissiveIntensity={0.7} metalness={0.9} roughness={0.3} />
          </mesh>
        ))}
        {[-3, 0, 3].map((x) => (
          <mesh key={`gx${x}`} position={[x, 0.011, -2.4]}>
            <boxGeometry args={[0.03, 0.015, 7]} />
            <meshStandardMaterial color="#8a6a1e" emissive="#d4af37" emissiveIntensity={0.45} metalness={0.9} roughness={0.3} />
          </mesh>
        ))}
        {[-4.7, -2.4, -0.1].map((z) => (
          <mesh key={`gz${z}`} position={[0, 0.011, z]}>
            <boxGeometry args={[9, 0.015, 0.03]} />
            <meshStandardMaterial color="#8a6a1e" emissive="#d4af37" emissiveIntensity={0.45} metalness={0.9} roughness={0.3} />
          </mesh>
        ))}
        {/* Warm uplighters washing the back wall. */}
        {[-6.5, -2.2, 2.2, 6.5].map((x, i) => (
          <group key={x} position={[x, 0, -7.55]}>
            <mesh position={[0, 0.22, 0]}>
              <cylinderGeometry args={[0.14, 0.18, 0.44, 16]} />
              <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.32} />
            </mesh>
            <mesh position={[0, 1.5, 0.06]}>
              <planeGeometry args={[0.9, 1.8]} />
              <meshStandardMaterial color="#3a2c17" emissive="#f59e0b" emissiveIntensity={0.45} />
            </mesh>
            {i % 2 === 0 && <pointLight position={[0, 1.2, 0.6]} intensity={3.5} distance={6} decay={2} color="#fbbf24" />}
          </group>
        ))}
        {/* High-boy linen tables with candle practicals. */}
        {[[-5.9, -2.2], [5.9, -2.8]].map(([x, z], i) => (
          <group key={i} position={[x, 0, z]}>
            <mesh position={[0, 0.94, 0]} castShadow>
              <cylinderGeometry args={[0.4, 0.4, 0.05, 28]} />
              <meshStandardMaterial color="#f3ede2" roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.47, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.94, 12]} />
              <meshStandardMaterial color="#b8952f" metalness={0.9} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.03, 0]}>
              <cylinderGeometry args={[0.26, 0.3, 0.06, 20]} />
              <meshStandardMaterial color="#8f7420" metalness={0.85} roughness={0.35} />
            </mesh>
            <mesh position={[0, 1.0, 0]}>
              <sphereGeometry args={[0.05, 10, 10]} />
              <meshStandardMaterial color="#fff3cf" emissive="#ffd98a" emissiveIntensity={3} />
            </mesh>
          </group>
        ))}
      </>
    );
  }

  if (environment === 'podcast_studio') {
    return (
      <>
        <PhotorealisticRoomShell environment="podcast_studio" />
        {/* Felt acoustic panels with an emerald accent bay and neon line. */}
        {[-2.6, 0, 2.6].map((x, i) => (
          <mesh key={x} position={[x, 1.7, -4.42]}>
            <boxGeometry args={[1.6, 1.7, 0.09]} />
            <meshStandardMaterial color={i === 1 ? '#0f3d31' : '#2a3330'} roughness={0.95} />
          </mesh>
        ))}
        <mesh position={[0, 0.72, -4.36]}>
          <boxGeometry args={[8, 0.07, 0.05]} />
          <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={1.8} />
        </mesh>
        {/* Round table with two mic-boom silhouettes — talent sits behind it. */}
        <group position={[0, 0, 0.3]}>
          <mesh position={[0, 0.74, 0]} castShadow>
            <cylinderGeometry args={[0.95, 0.95, 0.06, 40]} />
            <meshStandardMaterial color="#2b211a" roughness={0.4} metalness={0.15} />
          </mesh>
          <mesh position={[0, 0.37, 0]}>
            <cylinderGeometry args={[0.12, 0.12, 0.72, 20]} />
            <meshStandardMaterial color="#1c1917" metalness={0.7} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.42, 0.46, 0.06, 24]} />
            <meshStandardMaterial color="#1c1917" metalness={0.7} roughness={0.4} />
          </mesh>
          {[-0.55, 0.55].map((x) => (
            <group key={x} position={[x, 0.77, -0.1]} rotation={[0, x < 0 ? 0.5 : -0.5, 0]}>
              <mesh position={[0, 0.02, 0]}>
                <cylinderGeometry args={[0.09, 0.11, 0.05, 16]} />
                <meshStandardMaterial color="#111114" metalness={0.6} roughness={0.4} />
              </mesh>
              <mesh position={[0, 0.26, 0.06]} rotation={[0.5, 0, 0]}>
                <cylinderGeometry args={[0.018, 0.018, 0.5, 8]} />
                <meshStandardMaterial color="#17171b" metalness={0.8} roughness={0.3} />
              </mesh>
              <mesh position={[0, 0.46, 0.17]} rotation={[0.9, 0, 0]}>
                <cylinderGeometry args={[0.035, 0.035, 0.16, 12]} />
                <meshStandardMaterial color="#26262b" metalness={0.7} roughness={0.35} />
              </mesh>
            </group>
          ))}
        </group>
        {/* Warm practical sconces. */}
        {[-3.6, 3.6].map((x) => (
          <group key={x} position={[x, 2.1, -4.3]}>
            <mesh>
              <sphereGeometry args={[0.09, 12, 12]} />
              <meshStandardMaterial color="#fff0d0" emissive="#ffd9a0" emissiveIntensity={2.6} />
            </mesh>
            <pointLight intensity={3.5} distance={6} decay={2} color="#ffd7a1" />
          </group>
        ))}
      </>
    );
  }

  if (environment === 'fitness_studio') {
    return (
      <>
        <PhotorealisticRoomShell environment="fitness_studio" />
        {/* Full-width mirror wall with an aluminium frame. */}
        <mesh position={[0, 1.4, -5.9]}>
          <planeGeometry args={[11, 2.3]} />
          <MeshReflectorMaterial
            resolution={512}
            blur={[40, 30]}
            mixBlur={1}
            mixStrength={1.6}
            mirror={0.7}
            color="#b9bfc8"
            metalness={0.4}
            roughness={0.12}
          />
        </mesh>
        <mesh position={[0, 2.6, -5.88]}>
          <boxGeometry args={[11.2, 0.1, 0.1]} />
          <meshStandardMaterial color="#3f3f46" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.2, -5.88]}>
          <boxGeometry args={[11.2, 0.1, 0.1]} />
          <meshStandardMaterial color="#3f3f46" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Matte rubber workout zone over the concrete slab. */}
        <mesh position={[0, 0.007, -1.4]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[13, 7]} />
          <meshStandardMaterial color="#15151a" roughness={0.96} metalness={0.02} />
        </mesh>
        {/* Orange accent stripes down both side walls. */}
        {[-7.96, 7.96].map((x) => (
          <mesh key={x} position={[x, 2.6, 0]}>
            <boxGeometry args={[0.06, 0.22, 11.9]} />
            <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={1.4} />
          </mesh>
        ))}
        {/* Dumbbell rack loaded with two rails of weights. */}
        <group position={[-6.3, 0, -3.2]}>
          {[-1.1, 1.1].map((x) => (
            <mesh key={x} position={[x, 0.38, 0]}>
              <boxGeometry args={[0.09, 0.76, 0.44]} />
              <meshStandardMaterial color="#27272a" metalness={0.6} roughness={0.4} />
            </mesh>
          ))}
          {[0.24, 0.7].map((y) => (
            <mesh key={y} position={[0, y, 0]}>
              <boxGeometry args={[2.3, 0.06, 0.4]} />
              <meshStandardMaterial color="#3f3f46" metalness={0.65} roughness={0.35} />
            </mesh>
          ))}
          {[-0.78, -0.26, 0.26, 0.78].map((x) => (
            <group key={x} position={[x, 0.76, 0]}>
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.04, 0.04, 0.34, 10]} />
                <meshStandardMaterial color="#52525b" metalness={0.7} roughness={0.35} />
              </mesh>
              {[-0.17, 0.17].map((dx) => (
                <mesh key={dx} position={[dx, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.1, 0.1, 0.07, 14]} />
                  <meshStandardMaterial color="#18181b" roughness={0.7} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
        {/* Incline bench. */}
        <group position={[-3.2, 0, -1.6]} rotation={[0, 0.45, 0]}>
          <mesh position={[0, 0.46, 0]} castShadow>
            <boxGeometry args={[1.5, 0.14, 0.55]} />
            <meshStandardMaterial color="#111114" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.72, -0.24]} rotation={[-0.35, 0, 0]}>
            <boxGeometry args={[1.5, 0.5, 0.12]} />
            <meshStandardMaterial color="#111114" roughness={0.8} />
          </mesh>
          {[-0.6, 0.6].map((x) => (
            <mesh key={x} position={[x, 0.21, 0]}>
              <boxGeometry args={[0.1, 0.42, 0.5]} />
              <meshStandardMaterial color="#3f3f46" metalness={0.6} roughness={0.4} />
            </mesh>
          ))}
        </group>
        <pointLight position={[0, 2.4, -2]} intensity={4} distance={9} decay={2} color="#ffedd5" />
      </>
    );
  }

  if (environment === 'real_estate') {
    return (
      <>
        <PhotorealisticRoomShell environment="real_estate" />
        {/* Daylight windows with angled volumetric shafts falling inside. */}
        {[-3.2, 3.2].map((x) => (
          <group key={x}>
            <mesh position={[x, 1.75, -5.42]}>
              <planeGeometry args={[2.3, 2.5]} />
              <meshStandardMaterial color="#eaf2ff" emissive="#dbeafe" emissiveIntensity={1.7} />
            </mesh>
            <mesh position={[x, 1.75, -5.4]}>
              <boxGeometry args={[0.07, 2.5, 0.06]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.5} />
            </mesh>
            <mesh position={[x, 1.75, -5.4]}>
              <boxGeometry args={[2.3, 0.07, 0.06]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.5} />
            </mesh>
            <mesh position={[x, 0.44, -5.38]}>
              <boxGeometry args={[2.5, 0.08, 0.18]} />
              <meshStandardMaterial color="#e2e8f0" roughness={0.45} />
            </mesh>
            <mesh position={[x, 0.86, -3.9]} rotation={[-Math.PI / 2 + 0.5, 0, 0]}>
              <planeGeometry args={[2.1, 3.2]} />
              <meshBasicMaterial
                color="#e8f1ff"
                transparent
                opacity={0.07}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
              />
            </mesh>
          </group>
        ))}
        {/* Framed art between the windows. */}
        <mesh position={[0, 1.75, -5.44]}>
          <boxGeometry args={[1.5, 1.1, 0.07]} />
          <meshStandardMaterial color="#1f2937" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0, 1.75, -5.39]}>
          <planeGeometry args={[1.25, 0.85]} />
          <meshStandardMaterial color="#3f5d7a" emissive="#3b82f6" emissiveIntensity={0.25} />
        </mesh>
        {/* Bright staged living space: rug, sofa, coffee table. */}
        <mesh position={[-1.2, 0.006, -2.2]} rotation={[-Math.PI / 2, 0, 0.12]}>
          <planeGeometry args={[5, 3.4]} />
          <meshStandardMaterial color="#d6cfc4" roughness={0.95} />
        </mesh>
        <group position={[-2.4, 0, -2.7]} rotation={[0, 0.35, 0]}>
          <mesh position={[0, 0.28, 0]} castShadow>
            <boxGeometry args={[3, 0.56, 1.1]} />
            <meshStandardMaterial color="#7c8ba0" roughness={0.75} />
          </mesh>
          <mesh position={[0, 0.68, -0.45]} castShadow>
            <boxGeometry args={[3, 0.7, 0.28]} />
            <meshStandardMaterial color="#8494aa" roughness={0.75} />
          </mesh>
          {[-1.38, 1.38].map((x) => (
            <mesh key={x} position={[x, 0.7, 0.05]}>
              <boxGeometry args={[0.26, 0.54, 1.1]} />
              <meshStandardMaterial color="#75839a" roughness={0.75} />
            </mesh>
          ))}
          {[-0.7, 0.7].map((x) => (
            <mesh key={`c${x}`} position={[x, 0.64, 0.12]} rotation={[-0.25, 0, 0]}>
              <boxGeometry args={[0.7, 0.16, 0.7]} />
              <meshStandardMaterial color="#94a3b8" roughness={0.85} />
            </mesh>
          ))}
        </group>
        <group position={[-0.4, 0, -1.3]} rotation={[0, 0.3, 0]}>
          <mesh position={[0, 0.42, 0]} castShadow>
            <boxGeometry args={[1.6, 0.08, 0.8]} />
            <meshStandardMaterial color="#4b3620" roughness={0.45} />
          </mesh>
          <mesh position={[0, 0.17, 0]}>
            <boxGeometry args={[1.4, 0.06, 0.65]} />
            <meshStandardMaterial color="#402e1c" roughness={0.5} />
          </mesh>
          {[[-0.7, -0.33], [0.7, -0.33], [-0.7, 0.33], [0.7, 0.33]].map(([x, z]) => (
            <mesh key={`${x}${z}`} position={[x, 0.17, z]}>
              <boxGeometry args={[0.07, 0.34, 0.07]} />
              <meshStandardMaterial color="#402e1c" roughness={0.5} />
            </mesh>
          ))}
        </group>
        {/* Warm floor-lamp practical plus a plant in the corner. */}
        <group position={[1.9, 0, -3.2]}>
          <mesh position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.24, 0.28, 0.06, 20]} />
            <meshStandardMaterial color="#3f3f46" metalness={0.7} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.78, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 1.5, 10]} />
            <meshStandardMaterial color="#8a8f98" metalness={0.85} roughness={0.3} />
          </mesh>
          <mesh position={[0, 1.6, 0]}>
            <cylinderGeometry args={[0.2, 0.28, 0.3, 24, 1, true]} />
            <meshStandardMaterial
              color="#f5e6cf"
              emissive="#ffedd5"
              emissiveIntensity={1.1}
              side={THREE.DoubleSide}
            />
          </mesh>
          <pointLight position={[0, 1.5, 0]} intensity={5} distance={7} decay={2} color="#ffe7c2" />
        </group>
        <group position={[5.4, 0, -3.8]}>
          <mesh position={[0, 0.28, 0]}>
            <cylinderGeometry args={[0.26, 0.2, 0.55, 20]} />
            <meshStandardMaterial color="#8a6a4f" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.9, 0]}>
            <sphereGeometry args={[0.45, 18, 14]} />
            <meshStandardMaterial color="#1f4d33" roughness={0.85} />
          </mesh>
          <mesh position={[0.3, 1.15, 0.1]}>
            <sphereGeometry args={[0.3, 16, 12]} />
            <meshStandardMaterial color="#25603d" roughness={0.85} />
          </mesh>
        </group>
      </>
    );
  }

  if (environment === 'auction_house') {
    return (
      <>
        <PhotorealisticRoomShell environment="auction_house" />
        {/* Lot display screen with live bidding slate. */}
        <mesh position={[2.6, 1.7, -5.96]}>
          <boxGeometry args={[5.9, 2.9, 0.08]} />
          <meshStandardMaterial color="#2b1c10" metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh position={[2.6, 1.7, -5.9]}>
          <planeGeometry args={[5.6, 2.6]} />
          <meshStandardMaterial color="#120b05" emissive="#b45309" emissiveIntensity={0.55} />
        </mesh>
        <Text position={[2.6, 2.15, -5.86]} fontSize={0.55} color="#fde68a" anchorX="center">
          LOT 12
        </Text>
        <Text position={[2.6, 1.5, -5.86]} fontSize={0.2} color="#fef3c7" anchorX="center">
          OPEN FOR BIDDING
        </Text>
        {/* Auctioneer's podium with a gavel and brass name strip. */}
        <group position={[-2.8, 0, -2.4]} rotation={[0, 0.3, 0]}>
          <mesh position={[0, 0.58, 0]} castShadow>
            <boxGeometry args={[0.95, 1.16, 0.62]} />
            <meshStandardMaterial color="#3a2617" roughness={0.45} metalness={0.1} />
          </mesh>
          <mesh position={[0, 1.19, 0]} rotation={[-0.22, 0, 0]}>
            <boxGeometry args={[1.02, 0.07, 0.7]} />
            <meshStandardMaterial color="#4a3120" roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.8, 0.33]}>
            <boxGeometry args={[0.7, 0.06, 0.04]} />
            <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={1.6} />
          </mesh>
          <group position={[0.16, 1.26, 0.08]} rotation={[0, 0, 0.5]}>
            <mesh>
              <cylinderGeometry args={[0.028, 0.028, 0.26, 10]} />
              <meshStandardMaterial color="#78350f" roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.16, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.05, 0.05, 0.1, 12]} />
              <meshStandardMaterial color="#5b2c0c" roughness={0.45} />
            </mesh>
          </group>
        </group>
        {/* Gallery frames with picture lights. */}
        {[-5.6, -3.9].map((x) => (
          <group key={x} position={[x, 1.7, -5.9]}>
            <mesh>
              <boxGeometry args={[1.3, 1.7, 0.07]} />
              <meshStandardMaterial color="#2b1c10" metalness={0.5} roughness={0.4} />
            </mesh>
            <mesh position={[0, 0, 0.05]}>
              <planeGeometry args={[1.05, 1.45]} />
              <meshStandardMaterial color="#4b3a26" emissive="#f59e0b" emissiveIntensity={0.22} />
            </mesh>
          </group>
        ))}
        {/* Velvet rope stanchions in front of the lot wall. */}
        {[0.6, 4.6].map((x) => (
          <group key={x} position={[x, 0, -4.3]}>
            <mesh position={[0, 0.5, 0]}>
              <cylinderGeometry args={[0.035, 0.035, 1, 12]} />
              <meshStandardMaterial color="#b8952f" metalness={0.9} roughness={0.3} />
            </mesh>
            <mesh position={[0, 1.04, 0]}>
              <sphereGeometry args={[0.06, 12, 12]} />
              <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.25} />
            </mesh>
            <mesh position={[0, 0.03, 0]}>
              <cylinderGeometry args={[0.16, 0.18, 0.06, 16]} />
              <meshStandardMaterial color="#8f7420" metalness={0.85} roughness={0.35} />
            </mesh>
          </group>
        ))}
        <mesh position={[2.6, 0.88, -4.3]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.035, 0.035, 4, 10]} />
          <meshStandardMaterial color="#7f1d1d" roughness={0.85} />
        </mesh>
        {/* Gallery spots pooling warm light across the sales floor. */}
        <spotLight position={[-3.6, 2.8, -3.4]} angle={0.55} penumbra={0.6} intensity={30} distance={12} decay={2} color="#ffe3b3" />
        <spotLight position={[2.4, 2.8, -4.2]} angle={0.5} penumbra={0.55} intensity={26} distance={12} decay={2} color="#ffd9a0" />
      </>
    );
  }

  if (environment === 'film_noir') {
    return (
      <>
        <PhotorealisticRoomShell environment="film_noir" />
        {/* Depth haze — the set falls off into black at the back wall. */}
        <fog attach="fog" args={['#07080c', 7, 24]} />
        {/* Barred window: the single cool source the whole set reads from. */}
        <group position={[-3.4, 1.7, -4.9]}>
          <mesh position={[0, 0, -0.04]}>
            <planeGeometry args={[2.5, 2.6]} />
            <meshStandardMaterial color="#cfe4ff" emissive="#bfdcff" emissiveIntensity={1.9} />
          </mesh>
          {Array.from({ length: 9 }).map((_, i) => (
            <mesh key={i} position={[0, -1.16 + i * 0.29, 0.02]}>
              <boxGeometry args={[2.5, 0.1, 0.07]} />
              <meshStandardMaterial color="#0a0a0c" roughness={0.8} />
            </mesh>
          ))}
          <mesh position={[0, 0, 0.02]}>
            <boxGeometry args={[0.1, 2.6, 0.07]} />
            <meshStandardMaterial color="#0a0a0c" roughness={0.8} />
          </mesh>
          {[-1.3, 1.3].map((x) => (
            <mesh key={x} position={[x, 0, 0.02]}>
              <boxGeometry args={[0.1, 2.7, 0.08]} />
              <meshStandardMaterial color="#16161a" roughness={0.7} />
            </mesh>
          ))}
        </group>
        {/* Venetian gobo bars striping the floor. */}
        {Array.from({ length: 7 }).map((_, i) => (
          <group key={i} position={[-1.9 + 0.5 * i, 0.004, -4 + 0.95 * i]} rotation={[0, 0.5, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[6.5, 0.34]} />
              <meshBasicMaterial
                color="#9fc8ff"
                transparent
                opacity={0.16}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
              />
            </mesh>
          </group>
        ))}
        {/* …and continuing up the opposite wall. */}
        {Array.from({ length: 6 }).map((_, i) => (
          <mesh key={i} position={[0.6 + i * 0.62, 1.5, -4.93]} rotation={[0, 0, 0.55]}>
            <planeGeometry args={[0.3, 3.4]} />
            <meshBasicMaterial
              color="#9fc8ff"
              transparent
              opacity={0.13}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        ))}
        {/* Single hard cool key + the window bounce. */}
        <spotLight position={[-4.8, 2.7, 1.8]} angle={0.6} penumbra={0.4} intensity={55} distance={16} decay={2} color="#cfe4ff" />
        <pointLight position={[-3.4, 1.7, -4.3]} intensity={6} distance={7} decay={2} color="#bcd7ff" />
        {/* Detective's desk with a fedora left on it, chair pushed back. */}
        <group position={[2.8, 0, -2.6]} rotation={[0, -0.4, 0]}>
          <mesh position={[0, 0.74, 0]} castShadow>
            <boxGeometry args={[1.9, 0.07, 1]} />
            <meshStandardMaterial color="#16130f" roughness={0.5} />
          </mesh>
          {[[-0.85, -0.42], [0.85, -0.42], [-0.85, 0.42], [0.85, 0.42]].map(([x, z]) => (
            <mesh key={`${x}${z}`} position={[x, 0.36, z]}>
              <boxGeometry args={[0.08, 0.72, 0.08]} />
              <meshStandardMaterial color="#100d0a" roughness={0.6} />
            </mesh>
          ))}
          <mesh position={[-0.3, 0.8, 0.05]}>
            <cylinderGeometry args={[0.3, 0.3, 0.03, 20]} />
            <meshStandardMaterial color="#0b0a09" roughness={0.85} />
          </mesh>
          <mesh position={[-0.3, 0.88, 0.05]}>
            <cylinderGeometry args={[0.17, 0.19, 0.14, 20]} />
            <meshStandardMaterial color="#0b0a09" roughness={0.85} />
          </mesh>
        </group>
        <group position={[2.2, 0, -1.3]} rotation={[0, 0.7, 0]}>
          <mesh position={[0, 0.46, 0]} castShadow>
            <boxGeometry args={[0.5, 0.07, 0.5]} />
            <meshStandardMaterial color="#131110" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.78, -0.22]} rotation={[-0.12, 0, 0]}>
            <boxGeometry args={[0.5, 0.6, 0.07]} />
            <meshStandardMaterial color="#131110" roughness={0.7} />
          </mesh>
          {[[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].map(([x, z]) => (
            <mesh key={`${x}${z}`} position={[x, 0.22, z]}>
              <boxGeometry args={[0.05, 0.44, 0.05]} />
              <meshStandardMaterial color="#0d0c0b" roughness={0.75} />
            </mesh>
          ))}
        </group>
      </>
    );
  }

  if (environment === 'rooftop_terrace') {
    return (
      <>
        <PhotorealisticRoomShell environment="rooftop_terrace" />
        {/* Dusk skyline backdrop with lit windows behind the parapet. */}
        <Skyline />
        {/* Parapet walls and a steel handrail around the deck edge. */}
        <mesh position={[0, 0.45, -6.6]} castShadow receiveShadow>
          <boxGeometry args={[18, 0.9, 0.32]} />
          <meshStandardMaterial color="#6b7280" roughness={0.85} />
        </mesh>
        {[-8.8, 8.8].map((x) => (
          <mesh key={x} position={[x, 0.45, -4]} castShadow>
            <boxGeometry args={[0.32, 0.9, 5.6]} />
            <meshStandardMaterial color="#6b7280" roughness={0.85} />
          </mesh>
        ))}
        <mesh position={[0, 1.06, -6.6]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.035, 0.035, 18, 10]} />
          <meshStandardMaterial color="#9ca3af" metalness={0.9} roughness={0.3} />
        </mesh>
        {[-7.5, -3.75, 0, 3.75, 7.5].map((x) => (
          <mesh key={`p${x}`} position={[x, 0.98, -6.6]}>
            <cylinderGeometry args={[0.03, 0.03, 0.2, 8]} />
            <meshStandardMaterial color="#9ca3af" metalness={0.9} roughness={0.3} />
          </mesh>
        ))}
        {/* Warm string lights strung across the deck. */}
        <StringLights position={[0, 2.7, -5.4]} span={17} sag={0.5} bulbs={17} />
        <StringLights position={[0, 2.72, -1.2]} span={17} sag={0.55} bulbs={17} />
        <pointLight position={[0, 2.3, -5.4]} intensity={5} distance={11} decay={2} color="#ffcf9a" />
        <pointLight position={[0, 2.3, -1.2]} intensity={4} distance={11} decay={2} color="#ffcf9a" />
        {/* Bistro tables with candle practicals and a stool each. */}
        {[[-3.9, -2.4, 0.4], [3.9, -3.2, -0.5]].map(([x, z, ry], i) => (
          <group key={i} position={[x, 0, z]} rotation={[0, ry, 0]}>
            <mesh position={[0, 0.73, 0]} castShadow>
              <cylinderGeometry args={[0.4, 0.4, 0.05, 24]} />
              <meshStandardMaterial color="#2a2a2e" metalness={0.7} roughness={0.35} />
            </mesh>
            <mesh position={[0, 0.37, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.72, 12]} />
              <meshStandardMaterial color="#1f1f23" metalness={0.8} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.03, 0]}>
              <cylinderGeometry args={[0.26, 0.3, 0.06, 18]} />
              <meshStandardMaterial color="#1f1f23" metalness={0.8} roughness={0.4} />
            </mesh>
            <mesh position={[0, 0.79, 0]}>
              <sphereGeometry args={[0.05, 10, 10]} />
              <meshStandardMaterial color="#fff3cf" emissive="#ffd98a" emissiveIntensity={3} />
            </mesh>
            <pointLight position={[0, 0.9, 0]} intensity={2} distance={4} decay={2} color="#ffd9a0" />
            <mesh position={[0.7, 0.5, 0.3]} castShadow>
              <cylinderGeometry args={[0.18, 0.18, 0.06, 16]} />
              <meshStandardMaterial color="#3a3a40" metalness={0.6} roughness={0.4} />
            </mesh>
            <mesh position={[0.7, 0.25, 0.3]}>
              <cylinderGeometry args={[0.04, 0.04, 0.5, 10]} />
              <meshStandardMaterial color="#26262b" metalness={0.8} roughness={0.3} />
            </mesh>
          </group>
        ))}
      </>
    );
  }

  if (environment === 'library_study') {
    return (
      <>
        <PhotorealisticRoomShell environment="library_study" />
        {/* Floor-to-ceiling shelving stacked with books. */}
        <Bookshelf position={[-4.4, 0, -5.2]} width={3.2} height={2.55} />
        <Bookshelf position={[-0.9, 0, -5.2]} width={3.2} height={2.55} />
        <Bookshelf position={[2.6, 0, -5.2]} width={3.2} height={2.55} />
        {/* Reading desk with a brass banker's lamp pooling warm light. */}
        <group position={[3.1, 0, -2.5]} rotation={[0, -0.35, 0]}>
          <mesh position={[0, 0.74, 0]} castShadow>
            <boxGeometry args={[2.2, 0.07, 1.05]} />
            <meshStandardMaterial color="#4a2f1a" roughness={0.4} metalness={0.1} />
          </mesh>
          <mesh position={[0, 0.775, 0]}>
            <planeGeometry args={[1.6, 0.7]} />
            <meshStandardMaterial color="#2b1a10" roughness={0.75} />
          </mesh>
          <mesh position={[0, 0.36, 0]} castShadow>
            <boxGeometry args={[2.05, 0.7, 0.95]} />
            <meshStandardMaterial color="#3a2413" roughness={0.55} />
          </mesh>
          <group position={[-0.6, 0.78, -0.1]}>
            <mesh position={[0, 0.02, 0]}>
              <cylinderGeometry args={[0.13, 0.15, 0.04, 20]} />
              <meshStandardMaterial color="#b08d57" metalness={0.9} roughness={0.3} />
            </mesh>
            <mesh position={[0.06, 0.24, 0]} rotation={[0, 0, -0.4]}>
              <cylinderGeometry args={[0.018, 0.018, 0.46, 10]} />
              <meshStandardMaterial color="#b08d57" metalness={0.9} roughness={0.28} />
            </mesh>
            <mesh position={[0.2, 0.44, 0]}>
              <cylinderGeometry args={[0.1, 0.2, 0.18, 24, 1, true]} />
              <meshStandardMaterial
                color="#8a6a3c"
                metalness={0.85}
                roughness={0.32}
                side={THREE.DoubleSide}
                emissive="#f5c98a"
                emissiveIntensity={0.5}
              />
            </mesh>
            <mesh position={[0.2, 0.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.18, 20]} />
              <meshStandardMaterial color="#ffe9c4" emissive="#ffd9a0" emissiveIntensity={3} />
            </mesh>
            <pointLight position={[0.2, 0.3, 0]} intensity={4.5} distance={5.5} decay={2} color="#ffcf9a" />
          </group>
        </group>
        {/* Brass wall sconces on the side walls. */}
        {[-6.35, 6.35].map((x) => (
          <group key={x} position={[x, 1.9, x < 0 ? -1.5 : -1.2]}>
            <mesh rotation={[0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
              <boxGeometry args={[0.3, 0.4, 0.06]} />
              <meshStandardMaterial color="#b08d57" metalness={0.85} roughness={0.35} />
            </mesh>
            <mesh position={[x < 0 ? 0.14 : -0.14, 0.06, 0]}>
              <sphereGeometry args={[0.08, 12, 12]} />
              <meshStandardMaterial color="#fff0d0" emissive="#ffd9a0" emissiveIntensity={2.6} />
            </mesh>
            <pointLight position={[x < 0 ? 0.3 : -0.3, 0.05, 0]} intensity={3} distance={5} decay={2} color="#ffd9a0" />
          </group>
        ))}
        {/* Leather reading chair in the corner. */}
        <group position={[5.1, 0, -4.3]} rotation={[0, -0.7, 0]}>
          <mesh position={[0, 0.42, 0]} castShadow>
            <boxGeometry args={[0.85, 0.16, 0.8]} />
            <meshStandardMaterial color="#4b2f1c" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.75, -0.34]} rotation={[-0.15, 0, 0]}>
            <boxGeometry args={[0.85, 0.62, 0.16]} />
            <meshStandardMaterial color="#54351f" roughness={0.7} />
          </mesh>
          {[-0.42, 0.42].map((x) => (
            <mesh key={x} position={[x, 0.58, 0]}>
              <boxGeometry args={[0.12, 0.34, 0.8]} />
              <meshStandardMaterial color="#4b2f1c" roughness={0.7} />
            </mesh>
          ))}
          {[[-0.35, -0.32], [0.35, -0.32], [-0.35, 0.32], [0.35, 0.32]].map(([x, z]) => (
            <mesh key={`${x}${z}`} position={[x, 0.15, z]}>
              <cylinderGeometry args={[0.04, 0.035, 0.3, 8]} />
              <meshStandardMaterial color="#2e1c10" roughness={0.6} />
            </mesh>
          ))}
        </group>
      </>
    );
  }

  return (
    <>
      <color attach="background" args={['#000']} />
      <mesh position={[0, 2, -6]}>
        <planeGeometry args={[16, 9]} />
        <meshStandardMaterial color="#312e81" emissive="#6366f1" emissiveIntensity={0.4} />
      </mesh>
    </>
  );
}

function XrLedStage({ accent = '#6366f1' }: { accent?: string }) {
  const wallMat = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: accent,
      emissive: accent,
      emissiveIntensity: 0.55,
      metalness: 0.2,
      roughness: 0.4,
    }),
    [accent],
  );

  return (
    <>
      <color attach="background" args={['#030308']} />
      <mesh position={[0, 2.2, -5.5]}>
        <cylinderGeometry args={[7, 7, 4.5, 32, 1, true, Math.PI * 0.65, Math.PI * 0.7]} />
        <primitive object={wallMat} attach="material" />
      </mesh>
      <mesh position={[-5.5, 1.8, -2]} rotation={[0, 0.55, 0]}>
        <planeGeometry args={[3.5, 4]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[5.5, 1.8, -2]} rotation={[0, -0.55, 0]}>
        <planeGeometry args={[3.5, 4]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, -0.86, -1.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 6]} />
        <MeshReflectorMaterial blur={[400, 120]} mixBlur={0.9} mixStrength={0.35} color="#0a0a12" />
      </mesh>
      <mesh position={[0, 4.2, -3]}>
        <boxGeometry args={[8, 0.08, 0.08]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.8} />
      </mesh>
    </>
  );
}

function XrExtensionOverlay() {
  return (
    <>
      <mesh position={[-6, 2, -3]} rotation={[0, 0.65, 0]}>
        <planeGeometry args={[2.5, 4.5]} />
        <meshStandardMaterial color="#4338ca" emissive="#6366f1" emissiveIntensity={0.45} transparent opacity={0.85} />
      </mesh>
      <mesh position={[6, 2, -3]} rotation={[0, -0.65, 0]}>
        <planeGeometry args={[2.5, 4.5]} />
        <meshStandardMaterial color="#4338ca" emissive="#6366f1" emissiveIntensity={0.45} transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, 3.5, -5]}>
        <planeGeometry args={[14, 2]} />
        <meshStandardMaterial color="#312e81" emissive="#818cf8" emissiveIntensity={0.5} />
      </mesh>
    </>
  );
}

function CameraRig({
  yaw,
  pitch,
  zoom,
  wide,
  target,
}: {
  yaw: number;
  pitch: number;
  zoom: number;
  wide?: boolean;
  target?: [number, number, number];
}) {
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3(0, 0.5, 0));
  // Eased pose — shot recalls glide like a jib in the classic sets too,
  // matching the photoreal rig's feel.
  const pose = useRef({ yaw, pitch, zoom });
  // The R3F frame loop intentionally drives the camera + eased look-at ref.
  // eslint-disable-next-line react-hooks/immutability
  useFrame((_, rawDt) => {
    const dt = Math.max(0.001, Math.min(0.1, rawDt || 0.016));
    const lambda = 8;
    pose.current.yaw = THREE.MathUtils.damp(pose.current.yaw, yaw, lambda, dt);
    pose.current.pitch = THREE.MathUtils.damp(pose.current.pitch, pitch, lambda, dt);
    pose.current.zoom = THREE.MathUtils.damp(pose.current.zoom, zoom, lambda, dt);
    const [gx, gy, gz] = target ?? [0, 0.5, 0];
    look.current.x = THREE.MathUtils.damp(look.current.x, gx, lambda, dt);
    look.current.y = THREE.MathUtils.damp(look.current.y, gy, lambda, dt);
    look.current.z = THREE.MathUtils.damp(look.current.z, gz, lambda, dt);
    const effectiveZoom = wide ? pose.current.zoom * 0.82 : pose.current.zoom;
    const radius = 5 / effectiveZoom;
    const y = Math.sin(pose.current.pitch) * radius + look.current.y + 0.7;
    const xz = Math.cos(pose.current.pitch) * radius;
    camera.position.set(
      look.current.x + Math.sin(pose.current.yaw) * xz,
      y,
      look.current.z + Math.cos(pose.current.yaw) * xz,
    );
    camera.lookAt(look.current);
    if (wide && 'fov' in camera) {
      // imperative lens simulation on the live three.js camera instance
      // eslint-disable-next-line react-hooks/immutability
      (camera as THREE.PerspectiveCamera).fov = 58;
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }
  });
  return null;
}

/**
 * Cinematic post chain for the classic stage — the same photographic language
 * the photoreal stage runs: HDR bloom on emissive LEDs/practicals, AgX display
 * transform so blown highlights roll off like film, a vignette for lens
 * falloff, and shot-driven depth of field.
 *
 * Focus behaves like a real lens: the focal plane auto-focuses on the camera's
 * look-at point, the sharp slice is deep on wide framings (the whole dressed
 * set reads) and narrows as the operator pushes in, at which point the bokeh
 * strengthens and the set melts behind the subject.
 */
function ScenePostProcessing({
  zoom,
  focusTarget,
  wide,
}: {
  zoom: number;
  focusTarget: THREE.Vector3;
  /** XR establishing lenses keep the full set extension in focus. */
  wide: boolean;
}) {
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const tight = wide ? 0 : clamp01((zoom - 0.9) / 1.5);
  const focusRange = THREE.MathUtils.lerp(8.5, 1.6, tight);
  const bokehScale = THREE.MathUtils.lerp(1.1, 2.3, tight);
  return (
    <EffectComposer multisampling={4}>
      {/* Threshold sits just under clip: LED walls and lamps glow without a
          broad veil lifting the blacks of the set. */}
      <Bloom mipmapBlur luminanceThreshold={0.85} luminanceSmoothing={0.25} intensity={0.5} radius={0.65} />
      <DepthOfField target={focusTarget} focusRange={focusRange} bokehScale={bokehScale} />
      {/* AgX rolls highlights off like real camera media — essential so
          emissive set pieces bloom naturally instead of clipping. */}
      <ToneMapping mode={ToneMappingMode.AGX} />
      <Vignette offset={0.26} darkness={0.72} />
    </EffectComposer>
  );
}

function GlCanvasReporter({ onGlReady }: { onGlReady?: (canvas: HTMLCanvasElement) => void }) {
  const { gl } = useThree();
  useEffect(() => {
    onGlReady?.(gl.domElement);
  }, [gl, onGlReady]);
  return null;
}

export function VirtualScene({
  virtualSet,
  keyedCanvas,
  rawVideo,
  mode,
  cameraYaw,
  cameraPitch,
  cameraZoom,
  cameraTarget,
  showShadows,
  showReflections,
  importedModels = [],
  sceneObjects = [],
  onGlReady,
  keyerEnabled = true,
  virtualSetEnabled = true,
  orbitEnabled = true,
  onCameraChange,
}: VirtualSceneProps) {
  const isAr = mode === 'augmented_reality';
  const isXr = mode === 'xr_extension';
  const showSet = virtualSetEnabled && !isAr;
  // Floor height per set family — talent and contact shadows must sit on it.
  const floorY =
    virtualSet.environment === 'xr_stage' ? -0.85
      : virtualSet.environment === 'broadcast_desk' ? -0.55
        : 0;
  const xrAccent = virtualSet.environment === 'broadcast_desk' ? '#22c55e'
    : virtualSet.environment === 'news_studio' || virtualSet.environment === 'newsroom_full' ? '#e11d48'
    : virtualSet.environment === 'church_stage' ? '#f59e0b'
    : virtualSet.environment === 'kitchen_set' ? '#78716c'
    : virtualSet.environment === 'corporate' || virtualSet.environment === 'conference_room' ? '#38bdf8'
    : '#6366f1';

  // Image-based lighting profile for this set family (file + intensity).
  const hdri = hdriFor(virtualSet.environment);
  // Look-at point the lens auto-focuses on — recomputed only when the operator
  // actually pans the free camera.
  const focusX = cameraTarget?.[0];
  const focusY = cameraTarget?.[1];
  const focusZ = cameraTarget?.[2];
  const focusPoint = useMemo(
    () => new THREE.Vector3(focusX ?? 0, focusY ?? 0.5, focusZ ?? 0),
    [focusX, focusY, focusZ],
  );
  // Area-light LTC tables must exist before the first frame renders.
  ensureAreaLightTables();

  return (
    <Canvas
      camera={{ fov: isXr ? 58 : 50, near: 0.1, far: 100, position: [0, 1.2, 5] }}
      dpr={[1, 2]}
      shadows={showShadows ? 'soft' : false}
      gl={{
        alpha: isAr,
        antialias: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
        // Outside AR the EffectComposer owns the display transform: the beauty
        // pass renders in linear HDR (renderer tone mapping pinned off) and the
        // ToneMapping effect applies AgX after bloom/DOF — the same chain the
        // photoreal stage runs. AR keeps renderer-side AgX because it renders
        // straight to the canvas over the live plate with no composer.
        toneMapping: isAr ? THREE.AgXToneMapping : THREE.NoToneMapping,
        toneMappingExposure: 1,
      }}
      style={{ background: isAr ? 'transparent' : undefined }}
    >
      <Suspense fallback={null}>
        <GlCanvasReporter onGlReady={onGlReady} />
        <CameraRig yaw={cameraYaw} pitch={cameraPitch} zoom={cameraZoom} wide={isXr} target={cameraTarget} />
        {onCameraChange && (
          <SceneOrbitControls
            yaw={cameraYaw}
            pitch={cameraPitch}
            zoom={cameraZoom}
            target={cameraTarget}
            enabled={orbitEnabled}
            onChange={onCameraChange}
          />
        )}
        {/* Physical light rig — a broadcast three-point setup layered over the
            HDRI: a shadow-casting key for shape, two softbox area lights (the
            specular response metal/glass need), a warm kicker and a rim spot
            that separates the subject from the set. */}
        <ambientLight intensity={isXr ? 0.16 : 0.05} />
        <hemisphereLight args={['#fff7ed', '#292524', 0.2]} />
        <directionalLight
          position={[5, 8, 5]}
          intensity={1.8}
          castShadow={showShadows}
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.00015}
          shadow-normalBias={0.02}
          shadow-camera-left={-9}
          shadow-camera-right={9}
          shadow-camera-top={9}
          shadow-camera-bottom={-9}
        />
        {/* camera-left softbox fill */}
        <rectAreaLight
          position={[-4.6, 3, 2.6]}
          width={4.2}
          height={2.8}
          intensity={2}
          color="#fff1e0"
          onUpdate={(light) => light.lookAt(0, 1, 0)}
        />
        {/* camera-right kicker — warm edge */}
        <rectAreaLight
          position={[4.4, 3, 1.4]}
          width={3.4}
          height={2.6}
          intensity={1.35}
          color="#ffe9c7"
          onUpdate={(light) => light.lookAt(0, 1.1, 0)}
        />
        {/* rim/overhead spot — inverse-square falloff, windowed by distance */}
        <spotLight
          position={[0, 5.5, -3.5]}
          angle={0.8}
          penumbra={0.85}
          intensity={12}
          distance={16}
          decay={2}
          color="#eef4ff"
        />
        {isAr && <ArCameraBackground video={rawVideo ?? null} />}
        {showSet && !isXr && <StudioEnvironment environment={virtualSet.environment} />}
        {showSet && isXr && <XrLedStage accent={xrAccent} />}
        {isXr && <XrExtensionOverlay />}
        {!isAr && (
          <group position={[0, floorY, 0]}>
            {keyerEnabled ? (
              <KeyedTalent canvas={keyedCanvas} showReflections={showReflections && showSet} />
            ) : (
              <RawTalent video={rawVideo ?? null} />
            )}
          </group>
        )}
        {importedModels.length > 0 && <ImportedModelGroup models={importedModels} />}
        {sceneObjects.length > 0 && <ProceduralModelGroup objects={sceneObjects} />}
        {showShadows && !isAr && (
          <ContactShadows position={[0, floorY + 0.012, 0.5]} opacity={0.5} scale={14} blur={2.2} far={2.5} resolution={512} />
        )}
        {/* Image-based lighting from local CC0 HDRIs — real ambient, colour
            bleed and reflections; no CDN dependency. The profile carries the
            intensity the scan needs (dark stage scans stay dark). */}
        <Environment files={hdri.file} environmentIntensity={hdri.intensity} />
        {/* Cinematic post chain — bloom, shot-driven DOF, AgX and vignette.
            AR renders straight over the live plate and stays crisp. */}
        {!isAr && <ScenePostProcessing zoom={cameraZoom} focusTarget={focusPoint} wide={isXr} />}
      </Suspense>
    </Canvas>
  );
}
