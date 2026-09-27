import { memo, useEffect, useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { StudioScreenSource } from '../../../lib/virtualStudio/types';
import { pbrFromTexture } from '../../../lib/prism/pbrMaterials';
import { useLightSlot, usePracticalLightScale } from '../fixtures/fidelityLighting';
import { PbrSurface } from '../fixtures/PbrSurface';
import { BackdropPlane, RoomShell } from '../fixtures/architecture';
import {
  FramedMonitor,
  RibbonBanner,
  VideoWall,
} from '../fixtures/screens';
import {
  Lectern,
  OverheadTruss,
  PendantLight,
  PottedPlant,
  StageDeck,
  StudioChair,
} from '../fixtures/furniture';
import {
  CeilingCove,
  CeilingGrid,
  RingCeiling,
  SwirlLedDisc,
  TieredPlatform,
  WallRails,
} from '../fixtures/stagecraft';
import {
  BoomMicStand,
  DrumKit,
  HoloDesk,
  KeyboardStand,
  Pew,
  StainedGlassWindow,
} from '../fixtures/setPieces';
import type { StudioSceneProps } from './StudioScenes';

/**
 * The photorealistic set library — one finished environment per registry scene
 * in `sceneRegistry.ts` (`news_premium` … `library_study`).
 *
 * Every set follows the conventions of `StudioScenes.tsx`:
 *  - architecture at honest metre scale (12–24 m rooms, real ceiling heights),
 *  - PBR surfaces only (`useStudioMaterials` / `PbrSurface` / the procedural
 *    texture library) — flat unlit walls never appear,
 *  - emissive practicals (sconces, LED channels, stage washes) paired with the
 *    point/spot light that actually washes the set,
 *  - each registry screen slot bound to `props.sources[slot.id]`, ribbon slots
 *    scrolled by `props.tickerSpeed`, and the replaceable `props.backdrop`
 *    (or the slot standing in for it) rendered behind the set dressing.
 */

type Vec3 = [number, number, number];

/* ================================================================
   Shared set pieces
   ================================================================ */

/** Ribbon scroll speed in texture px/s — matches StudioScenes. */
function ribbonScroll(tickerSpeed?: number): number {
  return Math.max(0, tickerSpeed ?? 120) / 2048;
}

/**
 * The effective picture behind a window/backdrop: the operator's full-scene
 * backdrop wins, then the scene's own window slot, else "nothing here".
 */
function activeView(
  backdrop: StudioScreenSource | undefined,
  slot: StudioScreenSource | undefined,
): StudioScreenSource | undefined {
  if (backdrop && backdrop.kind !== 'off') return backdrop;
  if (slot && slot.kind !== 'off') return slot;
  return undefined;
}

/** Procedural sky/gradient plate — the default "view" behind windows. */
const SkyPanel = memo(function SkyPanel({
  position,
  rotation,
  width,
  height,
  top = '#6db6f5',
  bottom = '#e8f3ff',
}: {
  position: Vec3;
  rotation?: Vec3;
  width: number;
  height: number;
  top?: string;
  bottom?: string;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, top);
    gradient.addColorStop(0.62, bottom);
    gradient.addColorStop(1, '#9ec8a0');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 8, 256);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [top, bottom]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
});

/** Replaceable full-scene plate — renders nothing while the slot is off. */
function MaybeBackdrop({
  source,
  position,
  rotation,
  width,
  height,
  brightness = 0.92,
}: {
  source?: StudioScreenSource;
  position: Vec3;
  rotation?: Vec3;
  width: number;
  height: number;
  brightness?: number;
}) {
  if (!source || source.kind === 'off') return null;
  return (
    <BackdropPlane
      source={source}
      position={position}
      rotation={rotation}
      width={width}
      height={height}
      brightness={brightness}
    />
  );
}

/**
 * A window/backdrop opening: the resolved view when one is bound, otherwise a
 * procedural sky plate so the opening never reads as a black hole.
 */
function SetWindow({
  source,
  position,
  rotation,
  width,
  height,
  brightness = 0.92,
  sky,
}: {
  source?: StudioScreenSource;
  position: Vec3;
  rotation?: Vec3;
  width: number;
  height: number;
  brightness?: number;
  sky?: { top: string; bottom: string };
}) {
  return (
    <>
      {!source || source.kind === 'off' ? (
        <SkyPanel
          position={position}
          rotation={rotation}
          width={width}
          height={height}
          top={sky?.top}
          bottom={sky?.bottom}
        />
      ) : null}
      <MaybeBackdrop
        source={source}
        position={position}
        rotation={rotation}
        width={width}
        height={height}
        brightness={brightness}
      />
    </>
  );
}

/** Brass wall sconce with a glowing shade and its matching warm spill. */
const WallSconce = memo(function WallSconce({
  position,
  rotation = [0, 0, 0],
  glow = '#ffd9a0',
}: {
  position: Vec3;
  rotation?: Vec3;
  glow?: string;
}) {
  const lit = useLightSlot(70);
  const lightScale = usePracticalLightScale();
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, 0.03]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 0.04, 18]} />
        <PbrSurface color="#b08d4f" metalness={1} roughness={0.32} envMapIntensity={1.5} />
      </mesh>
      <mesh position={[0, 0.1, 0.1]} castShadow>
        <cylinderGeometry args={[0.12, 0.07, 0.17, 20, 1, true]} />
        <PbrSurface
          color="#f7efe0"
          emissive={glow}
          emissiveIntensity={1.5}
          side={THREE.DoubleSide}
          roughness={0.62}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0.19, 0.1]}>
        <sphereGeometry args={[0.05, 12, 10]} />
        <meshBasicMaterial color={glow} toneMapped={false} />
      </mesh>
      {lit && (
        <pointLight position={[0, 0.14, 0.22]} intensity={4.2 * lightScale} distance={7} decay={2} color={glow} />
      )}
    </group>
  );
});

/** Emissive LED channel — floor strips, wall rails and stage light lines. */
const GlowStrip = memo(function GlowStrip({
  position,
  rotation = [0, 0, 0],
  size,
  color,
  intensity = 2.4,
}: {
  position: Vec3;
  rotation?: Vec3;
  size: Vec3;
  color: string;
  intensity?: number;
}) {
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={size} />
      <PbrSurface color={color} emissive={color} emissiveIntensity={intensity} toneMapped={false} roughness={0.5} />
    </mesh>
  );
});

/** Angled stage wedge monitor for performance sets. */
const StageWedge = memo(function StageWedge({
  position,
  rotation = [0, 0, 0],
}: {
  position: Vec3;
  rotation?: Vec3;
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0.16, 0]} rotation={[-0.45, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.68, 0.46, 0.42]} />
        <PbrSurface color="#141418" roughness={0.72} metalness={0.24} />
      </mesh>
      <mesh position={[0, 0.24, 0.11]} rotation={[-0.45, 0, 0]}>
        <planeGeometry args={[0.5, 0.3]} />
        <PbrSurface color="#232329" roughness={0.9} metalness={0.1} normalScale={1.4} />
      </mesh>
      <mesh position={[0, 0.01, 0]}>
        <boxGeometry args={[0.6, 0.02, 0.36]} />
        <PbrSurface color="#0b0b0d" roughness={1} />
      </mesh>
    </group>
  );
});

/** Stacked PA speakers flanking a stage. */
const SpeakerStack = memo(function SpeakerStack({
  position,
  rotation = [0, 0, 0],
}: {
  position: Vec3;
  rotation?: Vec3;
}) {
  return (
    <group position={position} rotation={rotation}>
      {/* sub cabinet */}
      <RoundedBox args={[1.15, 0.95, 0.9]} radius={0.03} smoothness={3} position={[0, 0.475, 0]} castShadow receiveShadow>
        <PbrSurface color="#121216" roughness={0.78} metalness={0.2} />
      </RoundedBox>
      {/* top cabinet, slightly canted toward the room */}
      <RoundedBox args={[1.05, 1.2, 0.8]} radius={0.03} smoothness={3} position={[0, 1.55, -0.03]} rotation={[-0.1, 0, 0]} castShadow receiveShadow>
        <PbrSurface color="#121216" roughness={0.78} metalness={0.2} />
      </RoundedBox>
      {/* driver grilles */}
      <mesh position={[0, 1.5, 0.42]} rotation={[-0.1, 0, 0]}>
        <planeGeometry args={[0.86, 0.95]} />
        <PbrSurface color="#1c1c21" roughness={0.94} metalness={0.25} normalScale={1.6} />
      </mesh>
      <mesh position={[0, 0.5, 0.46]}>
        <planeGeometry args={[0.92, 0.7]} />
        <PbrSurface color="#1c1c21" roughness={0.94} metalness={0.25} normalScale={1.6} />
      </mesh>
      {/* feet */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.5, 0.04, s * 0.35]}>
          <boxGeometry args={[0.1, 0.08, 0.1]} />
          <PbrSurface color="#3f3f46" metalness={0.8} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
});

/* Staged set dressing — exported so the pieces stay reachable while the
   podcast / gym / gallery / rooftop scenes are ported into this library. */

/** Round podcast table — walnut slab top on a weighted pedestal. */
export const RoundTable = memo(function RoundTable({
  position,
  radius = 0.85,
  height = 0.74,
}: {
  position: Vec3;
  radius?: number;
  height?: number;
}) {
  const top = useMemo(() => pbrFromTexture('wood_walnut', 3, { roughness: 0.4, envMapIntensity: 1.15 }), []);
  return (
    <group position={position}>
      <mesh position={[0, height, 0]} castShadow receiveShadow material={top}>
        <cylinderGeometry args={[radius, radius * 0.99, 0.05, 48]} />
      </mesh>
      <mesh position={[0, height - 0.042, 0]}>
        <cylinderGeometry args={[radius * 0.94, radius * 0.94, 0.02, 48]} />
        <PbrSurface color="#1b1410" roughness={0.85} />
      </mesh>
      {/* brushed edge band */}
      <mesh position={[0, height - 0.01, 0]}>
        <cylinderGeometry args={[radius + 0.004, radius + 0.004, 0.03, 48, 1, true]} />
        <PbrSurface color="#b08d4f" metalness={1} roughness={0.34} envMapIntensity={1.5} />
      </mesh>
      <mesh position={[0, height * 0.46, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.11, height * 0.86, 24]} />
        <PbrSurface color="#17171b" metalness={0.55} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <cylinderGeometry args={[0.4, 0.45, 0.06, 32]} />
        <PbrSurface color="#101013" roughness={0.5} metalness={0.4} />
      </mesh>
    </group>
  );
});

/** Framed gym mirror with its own top wash light. */
export const MirrorPanel = memo(function MirrorPanel({
  position,
  rotation = [0, 0, 0],
  width = 3.4,
  height = 3.4,
}: {
  position: Vec3;
  rotation?: Vec3;
  width?: number;
  height?: number;
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, -0.03]} castShadow>
        <boxGeometry args={[width + 0.16, height + 0.16, 0.08]} />
        <PbrSurface color="#262a31" metalness={0.6} roughness={0.42} />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[width, height]} />
        <PbrSurface color="#ccd6e0" metalness={1} roughness={0.045} envMapIntensity={2.2} />
      </mesh>
      <mesh position={[0, height / 2 + 0.16, 0.1]}>
        <boxGeometry args={[width, 0.05, 0.06]} />
        <PbrSurface color="#fff7ed" emissive="#fff3e2" emissiveIntensity={2.2} toneMapped={false} />
      </mesh>
    </group>
  );
});

/** Ornate gilded moulding surrounding a wall display. */
export const GildedFrame = memo(function GildedFrame({
  position,
  rotation = [0, 0, 0],
  width,
  height,
}: {
  position: Vec3;
  rotation?: Vec3;
  width: number;
  height: number;
}) {
  const gold = <PbrSurface color="#c9a44a" metalness={1} roughness={0.3} envMapIntensity={1.6} />;
  return (
    <group position={position} rotation={rotation}>
      {[-1, 1].map((s) => (
        <mesh key={`h${s}`} position={[0, s * (height / 2 + 0.1), 0]} castShadow>
          <boxGeometry args={[width + 0.36, 0.16, 0.07]} />
          {gold}
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`v${s}`} position={[s * (width / 2 + 0.1), 0, 0]} castShadow>
          <boxGeometry args={[0.16, height + 0.36, 0.07]} />
          {gold}
        </mesh>
      ))}
    </group>
  );
});

/** Distant city block with lit windows — the rooftop horizon. */
export const SkylineBlock = memo(function SkylineBlock({
  position,
  size,
  seed,
}: {
  position: Vec3;
  size: Vec3;
  seed: number;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 96;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 64, 96);
    // Deterministic per-window hash — no PRNG state mutated from a closure.
    const rand = (a: number, b: number) => {
      const v = Math.sin(a * 127.1 + b * 311.7 + seed * 74.7) * 43758.5453;
      return v - Math.floor(v);
    };
    for (let y = 4; y < 92; y += 10) {
      for (let x = 4; x < 58; x += 9) {
        if (rand(x, y) < 0.55) {
          ctx.fillStyle = rand(x + 1, y) < 0.72 ? '#ffd9a0' : '#cfe0ff';
          ctx.globalAlpha = 0.3 + rand(x + 2, y) * 0.65;
          ctx.fillRect(x, y, 5, 6);
        }
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [seed]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <group position={position}>
      <mesh position={[0, size[1] / 2, 0]} castShadow>
        <boxGeometry args={size} />
        <PbrSurface color="#121826" roughness={0.85} metalness={0.16} />
      </mesh>
      <mesh position={[0, size[1] / 2, size[2] / 2 + 0.03]}>
        <planeGeometry args={[size[0] * 0.9, size[1] * 0.94]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
});

/* ================================================================
   Scenes
   ================================================================ */

/* ---------------------------------------------- news premium */

export const NewsPremiumScene = memo(function NewsPremiumScene({
  sources,
  backdrop,
  tickerSpeed,
}: StudioSceneProps) {
  const scroll = ribbonScroll(tickerSpeed);
  return (
    <>
      <RoomShell
        width={18}
        depth={14}
        height={5.4}
        wallTexture="concrete"
        wallColor="#0b1116"
        floorTexture="concrete"
        floorColor="#0a0f14"
        accent="#06b6d4"
        ceilingLights={2}
        openBack={false}
        position={[0, 0, -0.5]}
      />
      {/* broadcast ceiling grid with cool spot fixtures */}
      <CeilingGrid position={[0, 0, -0.5]} width={17} depth={12.6} height={4.95} slatsX={9} slatsZ={6} spotsX={5} spotsZ={3} color="#dffaff" />
      <CeilingCove position={[0, 0, -0.5]} width={17.6} depth={13.6} height={5.3} color="#06b6d4" intensity={1.1} />
      <RingCeiling position={[0, 0, 1.6]} radius={3.6} height={5.08} downlights={6} color="#e8fbff" />

      {/* replaceable skyline plate behind the LED stack */}
      <SetWindow source={activeView(backdrop, sources.backdrop)} position={[0, 2.5, -7.44]} width={16.6} height={5} brightness={0.7} />

      {/* triple LED wall — hero panel with angled holographic wings */}
      <VideoWall source={sources.triple_wall} position={[0, 2.35, -7.0]} width={5.6} height={3.2} cols={3} rows={2} />
      <VideoWall source={sources.triple_wall} position={[-5.0, 2.3, -6.72]} rotation={[0, 0.42, 0]} width={3.3} height={3} cols={2} rows={2} seams={false} />
      <VideoWall source={sources.triple_wall} position={[5.0, 2.3, -6.72]} rotation={[0, -0.42, 0]} width={3.3} height={3} cols={2} rows={2} seams={false} />

      {/* holographic data columns flanking the wall */}
      <FramedMonitor source={sources.holo_data} position={[-7.3, 2.3, -5.7]} rotation={[0, 0.8, 0]} width={1.5} />
      <FramedMonitor source={sources.holo_data} position={[7.3, 2.3, -5.7]} rotation={[0, -0.8, 0]} width={1.5} />

      {/* cyan LED rails across the concrete side walls */}
      <WallRails position={[-8.92, 2.4, -2]} rotation={[0, Math.PI / 2, 0]} width={10} count={3} spacing={0.5} color="#06b6d4" />
      <WallRails position={[8.92, 2.4, -2]} rotation={[0, -Math.PI / 2, 0]} width={10} count={3} spacing={0.5} color="#06b6d4" />

      {/* floating glass desk on a lit circular dais */}
      <TieredPlatform position={[0, 0, 1.9]} tiers={1} radius={3.2} arc={Math.PI * 2} color="#06b6d4" />
      <SwirlLedDisc position={[0, 0.02, 1.9]} radius={2.3} color="#22d3ee" spin={0.05} />
      <HoloDesk position={[0, 0, 1.9]} width={3.9} accent="#06b6d4" />
      <FramedMonitor source={sources.desk_screen} position={[1.4, 1.0, 1.5]} rotation={[0, -0.6, 0]} width={0.66} />
      <StudioChair position={[0, 0, 0.5]} />

      {/* floor LED strip — the scrolling ribbon laid into the studio floor */}
      <RibbonBanner source={sources.floor_led} position={[0, 0.05, 4.2]} rotation={[-Math.PI / 2, 0, 0]} width={13} height={0.7} scroll={scroll} />
      {/* floor channel strips + channel logo ring */}
      <GlowStrip position={[-6.6, 0.03, -1.2]} size={[0.09, 0.06, 11]} color="#06b6d4" />
      <GlowStrip position={[6.6, 0.03, -1.2]} size={[0.09, 0.06, 11]} color="#06b6d4" />
      <GlowStrip position={[0, 0.03, -6.9]} size={[15.6, 0.06, 0.09]} color="#22d3ee" />
      <mesh position={[0, 0.014, 5.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.95, 1.3, 64]} />
        <PbrSurface color="#06b6d4" emissive="#06b6d4" emissiveIntensity={2.6} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>

      <spotLight position={[-5, 7.5, 3]} angle={0.55} penumbra={0.7} intensity={42} distance={30} decay={2} color="#dff6ff" />
      <spotLight position={[5, 7.5, 3]} angle={0.55} penumbra={0.7} intensity={42} distance={30} decay={2} color="#eafffb" />

      <PottedPlant position={[-8.2, 0, 2.6]} height={1.8} />
      <PottedPlant position={[8.2, 0, 2.6]} height={1.8} />
    </>
  );
});

/* ------------------------------------------ church sanctuary */

export const ChurchSanctuaryScene = memo(function ChurchSanctuaryScene({
  sources,
  backdrop,
  tickerSpeed,
}: StudioSceneProps) {
  const scroll = ribbonScroll(tickerSpeed);
  const marble = <PbrSurface color="#ded8ca" roughness={0.24} metalness={0.05} envMapIntensity={1.4} />;
  return (
    <>
      <RoomShell
        width={22}
        depth={20}
        height={8.5}
        wallTexture="wall_paint"
        wallColor="#4a3a28"
        floorTexture="wood_oak"
        floorColor="#4a3521"
        accent="#f59e0b"
        ceilingLights={4}
        openBack={false}
      />

      {/* stained-glass window: the replaceable view glows through the panes */}
      <SetWindow source={activeView(backdrop, sources.stained_glass)} position={[0, 4.6, -9.96]} width={5.7} height={7.1} brightness={0.85} sky={{ top: '#8fc3f2', bottom: '#fdf3df' }} />
      <StainedGlassWindow position={[0, 4.6, -9.82]} width={5} height={6.4} glow="#ffe4b0" />

      {/* chancel platform with marble altar steps */}
      <StageDeck position={[0, 0, -2.6]} width={15} depth={5.6} height={0.3} accent="#f59e0b" />
      <mesh position={[0, 0.15, 0.5]} castShadow receiveShadow>
        <boxGeometry args={[8, 0.3, 0.6]} />
        {marble}
      </mesh>
      <mesh position={[0, 0.08, 1.15]} castShadow receiveShadow>
        <boxGeometry args={[8.6, 0.16, 1]} />
        {marble}
      </mesh>

      {/* projection wall, lyric crawl and side monitor */}
      <VideoWall source={sources.projection_wall} position={[-6.7, 3.7, -9.66]} width={4.6} height={2.6} />
      <RibbonBanner source={sources.lyric_banner} position={[0, 6.7, -9.72]} width={15} height={0.5} scroll={scroll} />
      <FramedMonitor source={sources.side_monitor} position={[6.7, 3.7, -9.7]} rotation={[0, -0.2, 0]} width={2.2} />

      {/* raised pulpit + sanctuary dressing */}
      <Lectern position={[-3.6, 0.3, -1.9]} rotation={[0, 0.35, 0]} />
      <PottedPlant position={[-6.4, 0.3, -4.4]} height={1.6} />
      <PottedPlant position={[6.4, 0.3, -4.4]} height={1.6} />
      <PottedPlant position={[-9.6, 0, -6.5]} height={1.9} />
      <PottedPlant position={[9.6, 0, -6.5]} height={1.9} />

      {/* seating: four double rows of timber pews either side of the aisle */}
      {[2.6, 4.3, 6.0, 7.7].map((z) => (
        <group key={z}>
          <Pew position={[-5.7, 0, z]} rotation={[0, 0.05, 0]} width={6.4} />
          <Pew position={[5.7, 0, z]} rotation={[0, -0.05, 0]} width={6.4} />
        </group>
      ))}

      {/* warm house lighting: sconce run, pendants and a stage wash */}
      {[-6.5, -2.5, 1.5, 5.5].map((z) => (
        <group key={z}>
          <WallSconce position={[-10.88, 3.6, z]} rotation={[0, Math.PI / 2, 0]} glow="#ffdfae" />
          <WallSconce position={[10.88, 3.6, z]} rotation={[0, -Math.PI / 2, 0]} glow="#ffdfae" />
        </group>
      ))}
      <PendantLight position={[-3, 8.4, 0.5]} drop={1.9} glow="#ffe6bd" />
      <PendantLight position={[3, 8.4, 0.5]} drop={1.9} glow="#ffe6bd" />
      <pointLight position={[-4, 5.5, -3.5]} intensity={16} distance={15} decay={2} color="#fbbf24" />
      <pointLight position={[4, 5.5, -3.5]} intensity={16} distance={15} decay={2} color="#fb923c" />
      <spotLight position={[0, 7.6, -6.5]} angle={0.55} penumbra={0.6} intensity={46} distance={20} decay={2} color="#fff0d6" />
    </>
  );
});

/* ----------------------------------------- music ministry */

export const MusicMinistryScene = memo(function MusicMinistryScene({
  sources,
  backdrop,
  tickerSpeed,
}: StudioSceneProps) {
  const scroll = ribbonScroll(tickerSpeed);
  return (
    <>
      <RoomShell
        width={20}
        depth={16}
        height={7}
        wallTexture="wall_brick"
        wallColor="#17131f"
        floorTexture="concrete"
        floorColor="#0d0b12"
        accent="#8b5cf6"
        ceilingLights={0}
        openBack={false}
      />

      {/* lyric projection wall over the stage */}
      <SetWindow source={activeView(backdrop, sources.backdrop)} position={[0, 3.1, -7.96]} width={16.6} height={6.4} brightness={0.7} sky={{ top: '#140f26', bottom: '#2a1f4a' }} />
      <VideoWall source={sources.main_wall} position={[0, 3.1, -7.56]} width={9} height={4.4} cols={4} rows={2} />
      <FramedMonitor source={sources.side_screen} position={[-9.6, 3.1, -5.4]} rotation={[0, Math.PI / 2 - 0.15, 0]} width={2.2} />
      <FramedMonitor source={sources.side_screen} position={[9.6, 3.1, -5.4]} rotation={[0, -Math.PI / 2 + 0.15, 0]} width={2.2} />

      {/* worship leader platform with LED floor panels */}
      <StageDeck position={[0, 0, -2.2]} width={15} depth={6.5} height={0.32} accent="#8b5cf6" />
      <RibbonBanner source={sources.led_floor} position={[0, 0.35, -4.4]} rotation={[-Math.PI / 2, 0, 0]} width={13} height={0.55} scroll={scroll * 0.6} />
      <RibbonBanner source={sources.led_floor} position={[0, 0.35, -1.0]} rotation={[-Math.PI / 2, 0, 0]} width={13} height={0.55} scroll={scroll * 0.6} />
      <GlowStrip position={[0, 0.36, 1.02]} size={[14.6, 0.05, 0.06]} color="#8b5cf6" />
      <GlowStrip position={[-7.4, 0.16, -2.2]} size={[0.06, 0.32, 6.4]} color="#a78bfa" />
      <GlowStrip position={[7.4, 0.16, -2.2]} size={[0.06, 0.32, 6.4]} color="#a78bfa" />

      {/* band backline */}
      <DrumKit position={[-5.2, 0.32, -4.2]} rotation={[0, 0.5, 0]} shell="#4c1d3a" />
      <KeyboardStand position={[5.2, 0.32, -4.0]} rotation={[0, -0.45, 0]} />
      <BoomMicStand position={[-2.4, 0.32, -0.9]} mount="tripod" rotation={[0, 0.4, 0]} />
      <BoomMicStand position={[2.6, 0.32, -1.1]} mount="tripod" rotation={[0, -0.4, 0]} />
      <StageWedge position={[-4.2, 0.32, 0.5]} />
      <StageWedge position={[0, 0.32, 0.5]} />
      <StageWedge position={[4.2, 0.32, 0.5]} />

      {/* PA stacks flanking the platform */}
      <SpeakerStack position={[-8.4, 0, -3.4]} rotation={[0, 0.5, 0]} />
      <SpeakerStack position={[8.4, 0, -3.4]} rotation={[0, -0.5, 0]} />

      {/* twin truss rigs with violet washes and haze beams */}
      <OverheadTruss position={[0, 6.3, -3.6]} length={14} spots={7} accent="#8b5cf6" />
      <OverheadTruss position={[0, 6.3, -0.6]} length={14} spots={7} accent="#a78bfa" />
      <spotLight position={[-4.5, 6.6, -3]} angle={0.34} penumbra={0.6} intensity={44} distance={22} decay={2} color="#8b5cf6" />
      <spotLight position={[4.5, 6.6, -3]} angle={0.34} penumbra={0.6} intensity={44} distance={22} decay={2} color="#a78bfa" />
      <spotLight position={[0, 6.8, 1.5]} angle={0.5} penumbra={0.7} intensity={38} distance={24} decay={2} color="#f3e8ff" />

      {/* violet rails along the side walls */}
      <WallRails position={[-9.9, 2.6, -3]} rotation={[0, Math.PI / 2, 0]} width={10} count={2} spacing={0.55} color="#8b5cf6" />
      <WallRails position={[9.9, 2.6, -3]} rotation={[0, -Math.PI / 2, 0]} width={10} count={2} spacing={0.55} color="#8b5cf6" />
      <CeilingCove position={[0, 0, -1]} width={19.6} depth={15.6} height={6.85} color="#7c3aed" intensity={1} />
    </>
  );
});

/* __PHOTOREAL_MORE__ */
