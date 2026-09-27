import { memo, useEffect, useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { StudioScreenSource } from '../../../lib/virtualStudio/types';
import { pbrFromTexture } from '../../../lib/prism/pbrMaterials';
import { useLightSlot, usePracticalLightScale } from '../fixtures/fidelityLighting';
import { PbrSurface } from '../fixtures/PbrSurface';
import { BackdropPlane, RoomShell, WindowFrame, AccentWall } from '../fixtures/architecture';
import {
  FramedMonitor,
  RibbonBanner,
  Television,
  VideoWall,
  StandingBanner,
} from '../fixtures/screens';
import {
  AnchorDesk,
  AreaRug,
  Bookshelf,
  CoffeeTable,
  ConsoleTable,
  CurtainPanel,
  DiningTable,
  FloorLamp,
  LeatherDiningChair,
  Lectern,
  MediaConsole,
  OverheadTruss,
  PendantLight,
  PottedPlant,
  SideTable,
  StageDeck,
  StudioArmchair,
  StudioChair,
  StudioSofa,
  TubChair,
} from '../fixtures/furniture';
import {
  CeilingCove,
  CeilingGrid,
  GlassPendantCluster,
  GlowLineWall,
  RingCeiling,
  SwirlLedDisc,
  TieredPlatform,
  WallRails,
} from '../fixtures/stagecraft';
import {
  AcousticPanelWall,
  BookcaseWall,
  BoomMicStand,
  Chandelier,
  DeskLamp,
  DisplayCase,
  DumbbellRack,
  DrumKit,
  HoloDesk,
  KeyboardStand,
  Pew,
  Podium,
  SeatRow,
  StainedGlassWindow,
  StringLights,
  VenetianWindow,
} from '../fixtures/setPieces';
import { LightBeam } from '../fixtures/LightBeam';
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

/* ------------------------------------------ luxury ballroom */

export const LuxuryBallroomScene = memo(function LuxuryBallroomScene({
  sources,
  backdrop,
  tickerSpeed,
}: StudioSceneProps) {
  const scroll = ribbonScroll(tickerSpeed);
  return (
    <>
      <RoomShell
        width={24}
        depth={20}
        height={7.5}
        wallTexture="wall_paint"
        wallColor="#3a2f22"
        floorTexture="marble"
        floorColor="#cfc4ad"
        accent="#d4af37"
        ceilingLights={0}
        openBack={false}
      />
      <CeilingCove position={[0, 0, -1]} width={23.6} depth={19.6} height={7.42} color="#d4af37" intensity={0.9} />

      {/* gilded feature wall: hero panel under the scrolling gold ticker */}
      <VideoWall source={sources.hero_wall} position={[0, 3.5, -9.92]} width={7.6} height={4} cols={3} rows={2} />
      <RibbonBanner source={sources.ticker} position={[0, 6.4, -9.94]} width={17} height={0.5} scroll={scroll} />

      {/* framed mirror display on the left wall */}
      <FramedMonitor source={sources.mirror_screen} position={[-11.9, 3.1, -2]} rotation={[0, Math.PI / 2, 0]} width={2.6} />
      <GildedFrame position={[-11.94, 3.1, -2]} rotation={[0, Math.PI / 2, 0]} width={3.1} height={2.1} />

      {/* dressed window wall — the operator's replaceable ballroom view */}
      <SetWindow
        source={activeView(backdrop, sources.backdrop)}
        position={[11.94, 3.1, -3]}
        rotation={[0, -Math.PI / 2, 0]}
        width={7}
        height={4.2}
        brightness={0.85}
        sky={{ top: '#f6d9a8', bottom: '#fdf1dd' }}
      />
      <CurtainPanel position={[11.86, 3.1, -6.7]} rotation={[0, -Math.PI / 2, 0]} width={1.7} height={4.6} color="#6b2020" />
      <CurtainPanel position={[11.86, 3.1, 0.7]} rotation={[0, -Math.PI / 2, 0]} width={1.7} height={4.6} color="#6b2020" />

      {/* crystal chandeliers on staggered drops */}
      <Chandelier position={[0, 7.4, -5.4]} radius={1.15} tiers={3} drop={1.5} />
      <Chandelier position={[0, 7.4, 0.2]} radius={1.4} tiers={3} drop={1.7} />
      <Chandelier position={[0, 7.4, 5.6]} radius={1.15} tiers={3} drop={1.5} />
      <GlassPendantCluster position={[8.6, 7.4, 7]} count={3} spacing={1.2} drop={1.6} glow="#ffe6b8" />

      {/* parquet dance ring behind the talent mark */}
      <TieredPlatform position={[0, 0, -5.8]} tiers={1} radius={4.4} arc={Math.PI * 2} color="#d4af37" />

      {/* lounge group */}
      <AreaRug position={[0, 0.02, 4]} width={7.6} depth={4.8} color="#5f1d1d" />
      <StudioSofa position={[0, 0, 0.7]} color="#4a2126" width={2.8} />
      <StudioArmchair position={[-3.4, 0, 4.4]} rotation={[0, 1.0, 0]} color="#4a2126" />
      <StudioArmchair position={[3.4, 0, 4.4]} rotation={[0, -1.0, 0]} color="#4a2126" />
      <CoffeeTable position={[0, 0, 4.4]} width={1.6} depth={0.85} />

      {/* entrance screen on its console, near the camera-side doors */}
      <ConsoleTable position={[8.8, 0, 7.6]} rotation={[0, -0.7, 0]} width={1.8} />
      <Television source={sources.entrance_screen} position={[8.8, 1.48, 7.6]} rotation={[0, -0.7, 0]} width={1.9} />

      {/* warm sconce run + a soft key over the talent mark */}
      {[-7, -2, 3].map((z) => (
        <group key={z}>
          <WallSconce position={[-11.9, 4.6, z]} rotation={[0, Math.PI / 2, 0]} glow="#ffe0ae" />
          <WallSconce position={[11.9, 4.6, z]} rotation={[0, -Math.PI / 2, 0]} glow="#ffe0ae" />
        </group>
      ))}
      <PottedPlant position={[-10.6, 0, 8.4]} height={1.8} />
      <PottedPlant position={[10.6, 0, 8.4]} height={1.8} />
      <spotLight position={[-3.5, 6.8, 5]} angle={0.5} penumbra={0.7} intensity={40} distance={24} decay={2} color="#fff0cf" />
      <spotLight position={[3.5, 6.8, 5]} angle={0.5} penumbra={0.7} intensity={40} distance={24} decay={2} color="#ffe9c0" />
    </>
  );
});

/* --------------------------------------------- concert hall */

export const ConcertHallScene = memo(function ConcertHallScene({
  sources,
  backdrop,
  tickerSpeed,
}: StudioSceneProps) {
  const scroll = ribbonScroll(tickerSpeed);
  return (
    <>
      <RoomShell
        width={28}
        depth={24}
        height={10}
        wallTexture="concrete"
        wallColor="#0c0d12"
        floorTexture="concrete"
        floorColor="#0b0b0f"
        accent="#ef4444"
        ceilingLights={0}
        openBack={false}
      />

      {/* arena backdrop plate behind the main LED wall */}
      <SetWindow
        source={activeView(backdrop, sources.backdrop)}
        position={[0, 6.6, -11.94]}
        width={20}
        height={6.6}
        brightness={0.75}
        sky={{ top: '#17090c', bottom: '#43161b' }}
      />
      <VideoWall source={sources.main_wall} position={[0, 4.6, -11.4]} width={11} height={5.4} cols={4} rows={2} />
      <VideoWall source={sources.left_wing} position={[-8.8, 4.4, -10.5]} rotation={[0, 0.5, 0]} width={4.6} height={3} cols={2} rows={2} seams={false} />
      <VideoWall source={sources.right_wing} position={[8.8, 4.4, -10.5]} rotation={[0, -0.5, 0]} width={4.6} height={3} cols={2} rows={2} seams={false} />
      <RibbonBanner source={sources.ribbon} position={[0, 8.3, -11.6]} width={22} height={0.55} scroll={scroll} />

      {/* stage with tiered band risers and floor monitors */}
      <StageDeck position={[0, 0, -7.6]} width={20} depth={8} height={0.65} accent="#ef4444" />
      <TieredPlatform position={[0, 0.65, -9.8]} tiers={2} radius={7} arc={Math.PI} color="#ef4444" />
      <StageWedge position={[-5, 0.65, -5]} />
      <StageWedge position={[0, 0.65, -5]} />
      <StageWedge position={[5, 0.65, -5]} />

      {/* twin lighting rigs over the stage */}
      <OverheadTruss position={[0, 8.6, -7.8]} length={22} spots={9} accent="#ef4444" />
      <OverheadTruss position={[0, 8.6, -4.4]} length={22} spots={9} accent="#f97316" />

      {/* PA stacks + audience seating flanking the centre camera lane */}
      <SpeakerStack position={[-12.4, 0, -7.4]} rotation={[0, 0.55, 0]} />
      <SpeakerStack position={[12.4, 0, -7.4]} rotation={[0, -0.55, 0]} />
      {[
        [-7.6, 4.2, 0.24],
        [7.6, 4.2, 0.24],
        [-7.6, 7.4, 0.52],
        [7.6, 7.4, 0.52],
      ].map(([x, z, riser]) => (
        <SeatRow
          key={`${x}-${z}`}
          position={[x, 0, z]}
          rotation={[0, Math.PI, 0]}
          width={9.5}
          seats={8}
          riser={riser}
        />
      ))}

      <spotLight position={[-6, 9.6, -7.2]} angle={0.32} penumbra={0.55} intensity={54} distance={28} decay={2} color="#ff5a5a" />
      <spotLight position={[6, 9.6, -7.2]} angle={0.32} penumbra={0.55} intensity={54} distance={28} decay={2} color="#ff8a5a" />
      <spotLight position={[0, 9.8, -2.4]} angle={0.5} penumbra={0.7} intensity={46} distance={28} decay={2} color="#fff2e8" />
    </>
  );
});

/* ------------------------------------------- podcast studio */

export const PodcastStudioScene = memo(function PodcastStudioScene({
  sources,
  backdrop,
}: StudioSceneProps) {
  return (
    <>
      <RoomShell
        width={12}
        depth={10}
        height={3.4}
        wallTexture="wall_paint"
        wallColor="#141a17"
        floorTexture="carpet"
        floorColor="#1d2320"
        accent="#10b981"
        ceilingLights={2}
        openBack={false}
      />

      {/* glass partition to the control room — the replaceable view sits behind it */}
      <SetWindow
        source={activeView(backdrop, sources.backdrop)}
        position={[0, 2, -4.94]}
        width={7.6}
        height={2.6}
        brightness={0.8}
        sky={{ top: '#24352f', bottom: '#d8efe5' }}
      />
      <WindowFrame position={[0, 2, -4.86]} width={7.6} height={2.6} cols={4} rows={2} />
      <MediaConsole position={[0, 0, -4.1]} width={2.4} />

      {/* acoustic treatment: panels either side of the glass and along the right wall */}
      <AcousticPanelWall position={[-4.6, 1.7, -4.86]} width={3} height={2.4} color="#26302b" accent="#10b981" />
      <AcousticPanelWall position={[4.6, 1.7, -4.86]} width={3} height={2.4} color="#26302b" accent="#10b981" />
      <AcousticPanelWall position={[5.9, 1.7, -0.6]} rotation={[0, -Math.PI / 2, 0]} width={6} height={2.4} color="#26302b" accent="#10b981" />

      {/* show display on the left wall */}
      <VideoWall source={sources.main_screen} position={[-5.94, 1.8, -1]} rotation={[0, Math.PI / 2, 0]} width={4.2} height={2.4} cols={2} rows={2} />

      {/* host + guest chairs around the round table */}
      <RoundTable position={[0, 0, 2.4]} radius={1.05} height={0.74} />
      <StudioChair position={[0, 0, 1.1]} />
      <TubChair position={[-1.8, 0, 2.4]} rotation={[0, Math.PI / 2, 0]} color="#2f4f45" />
      <TubChair position={[1.8, 0, 2.4]} rotation={[0, -Math.PI / 2, 0]} color="#2f4f45" />
      <BoomMicStand position={[-1.1, 0, 1.8]} mount="tripod" rotation={[0, 0.55, 0]} />
      <BoomMicStand position={[1.1, 0, 1.8]} mount="tripod" rotation={[0, -0.55, 0]} />
      <FramedMonitor source={sources.desk_tablet} position={[0.5, 1.0, 2.35]} rotation={[0, -0.4, 0]} width={0.7} />

      {/* emerald channel lighting + a pendant cluster over the table */}
      <GlowStrip position={[-5.5, 0.04, -0.4]} size={[0.08, 0.06, 8]} color="#10b981" />
      <GlowStrip position={[5.5, 0.04, -0.4]} size={[0.08, 0.06, 8]} color="#10b981" />
      <GlowStrip position={[0, 0.04, -4.5]} size={[10, 0.06, 0.08]} color="#34d399" />
      <GlassPendantCluster position={[0, 3.35, 2.4]} count={3} spacing={1.05} drop={1.15} glow="#d6fff1" />
      <PottedPlant position={[-5, 0, 3.6]} height={1.4} />
      <spotLight position={[-2.6, 3.3, 3.4]} angle={0.55} penumbra={0.75} intensity={26} distance={12} decay={2} color="#eafff7" />
    </>
  );
});

/* ------------------------------------------- fitness studio */

export const FitnessStudioScene = memo(function FitnessStudioScene({
  sources,
  backdrop,
}: StudioSceneProps) {
  const mats: [number, number, string][] = [
    [-2.4, 2.6, '#1f2937'],
    [0, 2.6, '#f97316'],
    [2.4, 2.6, '#1f2937'],
    [-2.4, 4.8, '#f97316'],
    [0, 4.8, '#1f2937'],
    [2.4, 4.8, '#f97316'],
  ];
  return (
    <>
      <RoomShell
        width={18}
        depth={14}
        height={4.4}
        wallTexture="wall_paint"
        wallColor="#e9edf1"
        floorTexture="concrete"
        floorColor="#c9ced4"
        accent="#f97316"
        ceilingLights={0}
        openBack={false}
      />
      {/* high-key studio grid instead of domestic downlights */}
      <CeilingGrid position={[0, 0, 0]} width={17} depth={13} height={4.35} slatsX={7} slatsZ={5} spotsX={4} spotsZ={3} color="#fff7ed" />

      {/* mirrored back wall with the session display at its centre */}
      <MirrorPanel position={[-5.7, 2, -6.9]} width={5.4} height={3.6} />
      <MirrorPanel position={[5.7, 2, -6.9]} width={5.4} height={3.6} />
      <VideoWall source={sources.mirror_wall} position={[0, 2.3, -6.94]} width={4.6} height={2.6} />

      {/* daylight window + wall timer */}
      <SetWindow
        source={activeView(backdrop, sources.backdrop)}
        position={[8.94, 2.2, -1]}
        rotation={[0, -Math.PI / 2, 0]}
        width={6}
        height={3.2}
        sky={{ top: '#8fc3f2', bottom: '#f2f8ff' }}
      />
      <FramedMonitor source={sources.timer_screen} position={[-8.94, 2.9, -1]} rotation={[0, Math.PI / 2, 0]} width={2.4} />
      <GlowLineWall position={[-8.9, 1.6, 3.8]} rotation={[0, Math.PI / 2, 0]} width={5.6} height={3} color="#f97316" pattern={3} wood={false} />

      {/* free-weight zone + training mats */}
      <DumbbellRack position={[-8.3, 0, 1.4]} rotation={[0, Math.PI / 2, 0]} width={1.8} tiers={3} />
      <DumbbellRack position={[8.3, 0, -4.4]} rotation={[0, -Math.PI / 2, 0]} width={1.8} tiers={3} />
      {mats.map(([x, z, color]) => (
        <RoundedBox key={`${x}-${z}`} args={[0.78, 0.035, 1.9]} radius={0.012} smoothness={2} position={[x, 0.02, z]} castShadow receiveShadow>
          <PbrSurface color={color} roughness={0.92} />
        </RoundedBox>
      ))}
      <PottedPlant position={[-8.2, 0, 6.2]} height={1.6} />
      <PottedPlant position={[8.2, 0, 6.2]} height={1.6} />

      <spotLight position={[-4, 4.4, 5]} angle={0.6} penumbra={0.7} intensity={34} distance={18} decay={2} color="#fffdf8" />
      <spotLight position={[4, 4.4, 5]} angle={0.6} penumbra={0.7} intensity={34} distance={18} decay={2} color="#fff4e8" />
    </>
  );
});

/* ------------------------------------------ real estate */

export const RealEstateScene = memo(function RealEstateScene({
  sources,
  backdrop,
}: StudioSceneProps) {
  return (
    <>
      <RoomShell
        width={16}
        depth={14}
        height={4.6}
        wallTexture="wall_paint"
        wallColor="#f1f3f6"
        floorTexture="wood_oak"
        floorColor="#b98d5f"
        accent="#3b82f6"
        ceilingLights={3}
        openBack={false}
      />

      {/* listing wall + dressed skyline window */}
      <VideoWall source={sources.property_wall} position={[-3.6, 2.7, -6.94]} width={6.6} height={3.6} cols={3} rows={2} />
      <SetWindow
        source={activeView(backdrop, sources.backdrop)}
        position={[4.4, 2.5, -6.94]}
        width={5.4}
        height={3.8}
        sky={{ top: '#9ec8f5', bottom: '#eaf4ff' }}
      />
      <WindowFrame position={[4.4, 2.5, -6.86]} width={5.4} height={3.8} cols={3} rows={2} />
      <AccentWall position={[-7.9, 2.2, -1.4]} rotation={[0, Math.PI / 2, 0]} width={10} height={4} accent="#3b82f6" slats={16} />

      {/* agent desk with its two monitors */}
      <AnchorDesk position={[0, 0, 2]} accent="#3b82f6" body="#e8edf5" width={3.6} />
      <FramedMonitor source={sources.agent_monitor} position={[-1.1, 1.06, 1.72]} rotation={[0, 0.35, 0]} width={0.66} />
      <StudioChair position={[0, 0, 0.9]} />
      <FramedMonitor source={sources.detail_screen} position={[7.94, 2.4, 1.6]} rotation={[0, -Math.PI / 2, 0]} width={2.4} />

      {/* lifestyle vignette in the foreground */}
      <AreaRug position={[-4.6, 0.02, 3.8]} width={5} depth={3.6} color="#dfe4ea" />
      <StudioSofa position={[-4.6, 0, 4.6]} color="#c7ccd4" width={2.5} />
      <CoffeeTable position={[-4.6, 0, 6]} width={1.4} depth={0.75} />
      <SideTable position={[-2.6, 0, 4.6]} top="walnut" />
      <ConsoleTable position={[6.4, 0, 5.4]} rotation={[0, -Math.PI / 2, 0]} width={1.7} wood="oak" />
      <PottedPlant position={[-7, 0, -5.6]} height={1.8} />
      <PottedPlant position={[7, 0, -5.6]} height={1.8} />
      <spotLight position={[-3, 4.2, 5]} angle={0.55} penumbra={0.7} intensity={32} distance={18} decay={2} color="#fdfdff" />
      <spotLight position={[3.4, 4.2, 5]} angle={0.55} penumbra={0.7} intensity={30} distance={18} decay={2} color="#eef4ff" />
    </>
  );
});

/* ------------------------------------------- auction house */

export const AuctionHouseScene = memo(function AuctionHouseScene({
  sources,
  backdrop,
}: StudioSceneProps) {
  const lots = [-6.6, -3.4, 3.4, 6.6];
  return (
    <>
      <RoomShell
        width={20}
        depth={16}
        height={6}
        wallTexture="wall_paint"
        wallColor="#241a12"
        floorTexture="wood_walnut"
        floorColor="#3a2617"
        accent="#92400e"
        ceilingLights={0}
        openBack={false}
      />

      {/* lot wall over the saleroom, with the replaceable plate on the right */}
      <VideoWall source={sources.lot_wall} position={[0, 3.3, -7.94]} width={7.8} height={4.2} cols={3} rows={2} />
      <SetWindow
        source={activeView(backdrop, sources.backdrop)}
        position={[9.94, 2.9, -2]}
        rotation={[0, -Math.PI / 2, 0]}
        width={7}
        height={3.6}
        brightness={0.8}
        sky={{ top: '#e9d9bd', bottom: '#fbf3e4' }}
      />
      <FramedMonitor source={sources.bid_screen} position={[-9.94, 3, -2]} rotation={[0, Math.PI / 2, 0]} width={3} />

      {/* auctioneer's block */}
      <Podium position={[-1.8, 0, -3.6]} rotation={[0, 0.2, 0]} accent="#b45309" />
      <AnchorDesk position={[2, 0, -3.7]} rotation={[0, -0.25, 0]} accent="#c9a44a" body="#2a1a10" width={2.8} />
      <FramedMonitor source={sources.desk_monitor} position={[1.7, 1.06, -3.2]} rotation={[0, -0.25, 0]} width={0.66} />

      {/* lit display cases with a hot spot each */}
      {lots.map((x) => (
        <DisplayCase key={x} position={[x, 0, -6.3]} glow="#ffe2b0" />
      ))}
      {lots.map((x) => (
        <spotLight key={`spot-${x}`} position={[x, 5.4, -6.7]} angle={0.26} penumbra={0.45} intensity={30} distance={14} decay={2} color="#ffe4bd" />
      ))}

      {/* saleroom seating */}
      <AreaRug position={[0, 0.02, 2.8]} width={7} depth={4.4} color="#5b1f14" />
      <StudioArmchair position={[-3.3, 0, 2.6]} rotation={[0, 0.6, 0]} color="#5a2a1e" />
      <StudioArmchair position={[3.3, 0, 2.6]} rotation={[0, -0.6, 0]} color="#5a2a1e" />
      <ConsoleTable position={[-9.6, 0, 4]} rotation={[0, Math.PI / 2, 0]} width={1.8} />
      {[-5.4, -0.6, 4.2].map((z) => (
        <group key={z}>
          <WallSconce position={[-9.9, 4, z]} rotation={[0, Math.PI / 2, 0]} glow="#ffd9a0" />
          <WallSconce position={[9.9, 4, z]} rotation={[0, -Math.PI / 2, 0]} glow="#ffd9a0" />
        </group>
      ))}
      <PottedPlant position={[-8.6, 0, 7]} height={1.7} />
      <PottedPlant position={[8.6, 0, 7]} height={1.7} />
      <spotLight position={[0, 5.6, 1.4]} angle={0.5} penumbra={0.6} intensity={38} distance={20} decay={2} color="#fff0d6" />
    </>
  );
});

/* ---------------------------------------------- film noir */

export const FilmNoirScene = memo(function FilmNoirScene({
  sources,
  backdrop,
}: StudioSceneProps) {
  return (
    <>
      <RoomShell
        width={14}
        depth={12}
        height={4}
        wallTexture="wall_paint"
        wallColor="#191921"
        floorTexture="wood_walnut"
        floorColor="#241c14"
        accent="#9ca3af"
        ceilingLights={0}
        openBack={false}
      />

      {/* venetian window: the slot's own view behind slats that throw the room */}
      <SetWindow
        source={sources.window_blinds}
        position={[3.4, 2.3, -5.94]}
        width={3.6}
        height={3}
        brightness={0.8}
        sky={{ top: '#2b3446', bottom: '#c8d4e6' }}
      />
      <VenetianWindow position={[3.4, 2.3, -5.78]} width={3.4} height={2.8} tilt={0.5} beam="#cfe0ff" />

      {/* operator's full-scene plate dressed as the office's side window */}
      <SetWindow
        source={activeView(backdrop, sources.backdrop)}
        position={[-6.94, 2.4, 1.6]}
        rotation={[0, Math.PI / 2, 0]}
        width={5.6}
        height={3.2}
        brightness={0.7}
      />
      <CurtainPanel position={[-6.86, 2.4, 4.8]} rotation={[0, Math.PI / 2, 0]} width={1.4} height={3.4} color="#2c2c34" />

      {/* detective's desk under the banker's lamp */}
      <AreaRug position={[-0.4, 0.02, -1.6]} width={4.8} depth={3.6} color="#2a2118" />
      <DiningTable position={[0.6, 0, -1.8]} rotation={[0, 0.2, 0]} width={2.2} depth={1} wood="walnut" />
      <LeatherDiningChair position={[0.6, 0, -2.8]} rotation={[0, Math.PI, 0]} leather="#3d2b1f" wood="#4b382a" />
      <DeskLamp position={[0, 0.78, -1.9]} rotation={[0, 0.5, 0]} glow="#ffd9a0" />
      <FramedMonitor source={sources.desk_lamp} position={[1.5, 1.0, -1.6]} rotation={[0, -0.45, 0]} width={0.8} />
      <FloorLamp position={[-4.4, 0, -2.6]} glow="#e8d9a8" height={1.7} />
      <ConsoleTable position={[-6.5, 0, 3.4]} rotation={[0, Math.PI / 2, 0]} width={1.6} />

      {/* moonlight shaft through the blinds across the boards */}
      <LightBeam position={[3.4, 3.4, -5.5]} rotation={[-1.15, 0, 0]} height={6.6} radius={1.7} color="#cfe0ff" opacity={0.1} />
      <spotLight position={[5, 3.8, -6.4]} angle={0.5} penumbra={0.5} intensity={36} distance={18} decay={2} color="#dbe7ff" />
      <pointLight position={[0, 1.05, -1.9]} intensity={3.2} distance={5.5} decay={2} color="#ffd9a0" />
      <spotLight position={[-3.4, 3.7, 3.2]} angle={0.6} penumbra={0.8} intensity={20} distance={14} decay={2} color="#9fb4d8" />
    </>
  );
});

/* ----------------------------------------- rooftop terrace */

export const RooftopTerraceScene = memo(function RooftopTerraceScene({
  sources,
  backdrop,
}: StudioSceneProps) {
  const deck = useMemo(() => pbrFromTexture('concrete', 21, { roughness: 0.88, envMapIntensity: 0.6 }), []);
  useEffect(() => () => deck.dispose(), [deck]);
  const poles: [number, number][] = [
    [-8.4, -4.8],
    [8.4, -4.8],
    [-8.4, 2.8],
    [8.4, 2.8],
  ];
  return (
    <>
      {/* dusk sky and the skyline behind the parapet */}
      <SetWindow
        source={activeView(backdrop, sources.sky)}
        position={[0, 5.4, -9.4]}
        width={34}
        height={16}
        brightness={1}
        sky={{ top: '#101a33', bottom: '#f0a06a' }}
      />
      <SkylineBlock position={[-7.6, 0, -8.6]} size={[6.5, 7, 1.2]} seed={3} />
      <SkylineBlock position={[-1, 0, -8.9]} size={[7, 9.5, 1.2]} seed={11} />
      <SkylineBlock position={[6.6, 0, -8.5]} size={[6, 6.2, 1.2]} seed={7} />

      {/* deck slab, parapet and rail */}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[22, 18]} />
        <primitive object={deck} attach="material" />
      </mesh>
      <mesh position={[0, 0.45, -7.6]} castShadow receiveShadow>
        <boxGeometry args={[22, 0.9, 0.32]} />
        <PbrSurface color="#6b7280" roughness={0.85} />
      </mesh>
      {[-10.8, 10.8].map((x) => (
        <mesh key={x} position={[x, 0.45, -0.6]} castShadow receiveShadow>
          <boxGeometry args={[0.32, 0.9, 14.4]} />
          <PbrSurface color="#6b7280" roughness={0.85} />
        </mesh>
      ))}
      <mesh position={[0, 1.02, -7.6]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.035, 21.6, 10]} />
        <PbrSurface color="#9ca3af" metalness={0.9} roughness={0.3} />
      </mesh>
      <GlowStrip position={[0, 0.06, -7.36]} size={[21.4, 0.05, 0.06]} color="#0ea5e9" intensity={2.6} />

      {/* festoon lights strung between the poles */}
      {poles.map(([x, z]) => (
        <mesh key={`p${x}-${z}`} position={[x, 1.7, z]} castShadow>
          <cylinderGeometry args={[0.06, 0.07, 3.4, 10]} />
          <PbrSurface color="#2f3138" metalness={0.6} roughness={0.5} />
        </mesh>
      ))}
      <StringLights position={[0, 3.35, -4.8]} span={16.6} sag={0.5} bulbs={17} glow="#ffd9a0" />
      <StringLights position={[0, 3.35, 2.8]} span={16.6} sag={0.55} bulbs={17} glow="#ffd9a0" />

      {/* terrace TV on its floor stand + the accent banner */}
      <Television source={sources.outdoor_tv} position={[-6.6, 0.78, -6.2]} rotation={[0, 0.2, 0]} width={2.1} />
      <StandingBanner source={sources.accent_light} position={[6.9, 0, -6]} rotation={[0, -0.3, 0]} width={1} height={2.2} />

      {/* patio dining set (kept clear of the talent mark) and a lounge corner */}
      <DiningTable position={[4.8, 0, 1.4]} width={2} depth={1} wood="oak" />
      <LeatherDiningChair position={[3.1, 0, 1.4]} rotation={[0, Math.PI / 2, 0]} leather="#5b6b52" wood="#8a6a44" />
      <LeatherDiningChair position={[6.5, 0, 1.4]} rotation={[0, -Math.PI / 2, 0]} leather="#5b6b52" wood="#8a6a44" />
      <LeatherDiningChair position={[4.8, 0, 2.9]} rotation={[0, Math.PI, 0]} leather="#5b6b52" wood="#8a6a44" />
      <StudioSofa position={[-5.4, 0, 2]} rotation={[0, 0.35, 0]} color="#4b5563" width={2.3} fabric="linen" />
      <SideTable position={[-3.6, 0, 0.9]} top="walnut" />
      <PottedPlant position={[-9.6, 0, -6.4]} height={1.7} />
      <PottedPlant position={[9.6, 0, -6.4]} height={1.7} />
      <PottedPlant position={[-9.6, 0, 6.4]} height={1.7} />

      <spotLight position={[-1.5, 4.8, 5.5]} angle={0.6} penumbra={0.75} intensity={30} distance={20} decay={2} color="#ffe6c9" />
      <pointLight position={[0, 6.5, -7]} intensity={7} distance={24} decay={2} color="#8fb6ff" />
    </>
  );
});

/* ------------------------------------------- library study */

export const LibraryStudyScene = memo(function LibraryStudyScene({
  sources,
  backdrop,
}: StudioSceneProps) {
  return (
    <>
      <RoomShell
        width={18}
        depth={14}
        height={4.4}
        wallTexture="wall_paint"
        wallColor="#2e2318"
        floorTexture="wood_walnut"
        floorColor="#3b2a1a"
        accent="#78350f"
        ceilingLights={2}
        openBack={false}
      />

      {/* stacked bookcase wall across the back */}
      {[-6.3, 0, 6.3].map((x) => (
        <BookcaseWall key={x} position={[x, 0, -6.85]} width={4.4} height={3.4} />
      ))}

      {/* lecture screen left, dressed window right */}
      <VideoWall source={sources.presentation_screen} position={[-8.94, 2.5, -1]} rotation={[0, Math.PI / 2, 0]} width={4.6} height={2.7} />
      <SetWindow
        source={activeView(backdrop, sources.backdrop)}
        position={[8.94, 2.4, -1.4]}
        rotation={[0, -Math.PI / 2, 0]}
        width={6}
        height={3.4}
        brightness={0.85}
        sky={{ top: '#9ec8f5', bottom: '#fdf3df' }}
      />
      <CurtainPanel position={[8.86, 2.4, -4.9]} rotation={[0, -Math.PI / 2, 0]} width={1.5} height={3.6} color="#7a5a3a" />
      <CurtainPanel position={[8.86, 2.4, 2.1]} rotation={[0, -Math.PI / 2, 0]} width={1.5} height={3.6} color="#7a5a3a" />

      {/* oak reading desk with its lamp and display */}
      <AreaRug position={[3.6, 0.02, 1]} width={6} depth={4.6} color="#7a2f1d" />
      <DiningTable position={[3.4, 0, -1.8]} rotation={[0, -0.3, 0]} width={2.1} depth={1.05} wood="oak" />
      <LeatherDiningChair position={[3.4, 0, -2.9]} rotation={[0, Math.PI, 0]} leather="#4a3324" wood="#5b4630" />
      <DeskLamp position={[2.7, 0.78, -1.9]} rotation={[0, 0.5, 0]} glow="#ffe6b8" />
      <FramedMonitor source={sources.desk_lamp_screen} position={[4.2, 1.0, -1.7]} rotation={[0, -0.5, 0]} width={0.8} />

      {/* reading pair */}
      <StudioArmchair position={[2.3, 0, 2.8]} rotation={[0, Math.PI / 2, 0]} color="#5a3a26" />
      <StudioArmchair position={[4.9, 0, 2.8]} rotation={[0, -Math.PI / 2, 0]} color="#5a3a26" />
      <CoffeeTable position={[3.6, 0, 2.8]} width={1.2} depth={0.7} />

      {/* more shelving, pendants and a warm sconce run */}
      <Bookshelf position={[-8.2, 0, 4.4]} rotation={[0, Math.PI / 2, 0]} width={2.6} height={3.4} />
      <PendantLight position={[3.1, 4.35, -1.6]} drop={1.5} glow="#ffe6b8" />
      <PendantLight position={[3.6, 4.35, 2.6]} drop={1.7} glow="#ffe6b8" />
      {[-8.9, 8.9].map((x, i) => (
        <group key={x}>
          <WallSconce
            position={[x, 3.4, i === 0 ? 3.4 : 5]}
            rotation={[0, i === 0 ? Math.PI / 2 : -Math.PI / 2, 0]}
            glow="#ffdca6"
          />
        </group>
      ))}
      <PottedPlant position={[-8, 0, -5.6]} height={1.7} />
      <PottedPlant position={[7.6, 0, 5.8]} height={1.7} />
      <spotLight position={[3.4, 4.2, 4.4]} angle={0.55} penumbra={0.7} intensity={30} distance={16} decay={2} color="#ffeccb" />
    </>
  );
});
