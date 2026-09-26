import { memo, useEffect, useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { StudioScreenSource } from '../../../lib/virtualStudio/types';
import {
  AnchorDesk,
  AreaRug,
  Bed,
  Bookshelf,
  CoffeeTable,
  CurtainPanel,
  FloorLamp,
  Lectern,
  MediaConsole,
  OverheadTruss,
  PendantLight,
  PottedPlant,
  SportsDesk,
  StageDeck,
  StudioArmchair,
  StudioChair,
  StudioSofa,
} from '../fixtures/furniture';
import {
  CeilingCove,
  CeilingGrid,
  GeometricFrameWall,
  GlassPendantCluster,
  GlowLineWall,
  HudRingPanel,
  RingCeiling,
  SwirlLedDisc,
  TieredPlatform,
  WallRails,
  WorldMapWall,
} from '../fixtures/stagecraft';
import {
  CabinetRun,
  KitchenBarStool,
  KitchenIsland,
  OpenShelving,
  OvenStack,
} from '../fixtures/kitchen';
import { useStudioMaterials } from '../fixtures/materials';
import {
  AccentWall,
  BackdropPlane,
  CycloramaShell,
  RoomShell,
  WindowFrame,
} from '../fixtures/architecture';
import {
  CurvedVideoWall,
  FramedMonitor,
  RibbonBanner,
  StandingBanner,
  Television,
  VideoWall,
} from '../fixtures/screens';

/**
 * Complete, ready-to-air virtual production scenes. Each one is a finished
 * environment: set dressing, light practicals, PBR surfaces and every screen
 * slot bound to whatever the operator routed to it.
 */

export interface StudioSceneProps {
  sources: Record<string, StudioScreenSource>;
  backdrop?: StudioScreenSource;
  /** Ribbon scroll speed in texture px/s. */
  tickerSpeed?: number;
}

function ribbonScroll(tickerSpeed?: number): number {
  return Math.max(0, tickerSpeed ?? 120) / 2048;
}

/** Procedural sky/gradient panel — the default "view" behind windows. */
const SkyPanel = memo(function SkyPanel({
  position,
  rotation,
  width,
  height,
  top = '#6db6f5',
  bottom = '#e8f3ff',
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
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

function MaybeBackdrop({
  source,
  position,
  rotation,
  width,
  height,
  brightness = 0.92,
}: {
  source?: StudioScreenSource;
  position: [number, number, number];
  rotation?: [number, number, number];
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

/* ------------------------------------------------------------ newsroom */

export const NewsroomScene = memo(function NewsroomScene({
  sources,
  backdrop,
  tickerSpeed,
}: StudioSceneProps) {
  const scroll = ribbonScroll(tickerSpeed);
  return (
    <>
      <RoomShell
        width={16}
        depth={14}
        height={5.5}
        wallTexture="concrete"
        floorTexture="concrete"
        floorColor="#131318"
        accent="#e11d48"
        ceilingLights={2}
        openBack
        position={[0, 0, -0.5]}
      />
      {/* broadcast ceiling grid with rows of hot spot fixtures */}
      <CeilingGrid position={[0, 0, -0.5]} width={15} depth={12.5} height={4.85} slatsX={8} slatsZ={6} spotsX={5} spotsZ={3} color="#fff3dd" />
      <MaybeBackdrop source={backdrop} position={[0, 2.5, -7.42]} width={15.4} height={5} brightness={0.8} />
      <VideoWall source={sources.video_wall} position={[0, 2.0, -7.0]} width={5.6} height={3.1} />
      <RibbonBanner source={sources.ticker} position={[0, 3.98, -7.02]} width={6.4} height={0.42} scroll={scroll} />
      <FramedMonitor source={sources.side_screen} position={[-4.7, 2.1, -7.06]} rotation={[0, 0.3, 0]} width={1.7} />
      <FramedMonitor source={sources.side_screen} position={[4.7, 2.1, -7.06]} rotation={[0, -0.3, 0]} width={1.7} />

      {/* warm architectural side walls with LED channel inlays */}
      <GlowLineWall position={[-7.94, 1.9, -3.2]} rotation={[0, Math.PI / 2, 0]} width={7} height={3.6} color="#e11d48" pattern={4} />
      <GlowLineWall position={[7.94, 1.9, -3.2]} rotation={[0, -Math.PI / 2, 0]} width={7} height={3.6} color="#e11d48" pattern={4} />

      <AnchorDesk position={[0, 0, 1.6]} accent="#e11d48" />
      <FramedMonitor source={sources.desk_monitor} position={[1.15, 1.03, 1.28]} rotation={[0, -0.55, 0]} width={0.62} />
      <StudioChair position={[0, 0, -0.35]} rotation={[0, Math.PI, 0]} />

      {/* interview lounge — sofa group on a rug, like the flagship news sets */}
      <AreaRug position={[5.1, 0.015, 2.4]} width={3.6} depth={2.6} color="#23262e" />
      <StudioSofa position={[5.6, 0, 1.2]} rotation={[0, Math.PI, 0]} color="#c8102e" />
      <CoffeeTable position={[5.1, 0, 2.9]} />
      <PottedPlant position={[7.0, 0, 3.4]} height={1.9} />

      {/* arena cues: red LED rails, tiered riser and glowing floor arcs */}
      <WallRails position={[-7.92, 2.3, -1.5]} rotation={[0, Math.PI / 2, 0]} width={10} count={3} spacing={0.5} color="#e11d48" />
      <WallRails position={[7.92, 2.3, -1.5]} rotation={[0, -Math.PI / 2, 0]} width={10} count={3} spacing={0.5} color="#e11d48" />
      <TieredPlatform position={[0, 0, -5.8]} tiers={1} radius={7.2} arc={Math.PI * 0.9} color="#e11d48" />
      <FloorArcStrip position={[0, 0.012, 1.6]} radius={3.3} arc={Math.PI * 1.3} color="#38bdf8" tube={0.045} spin={Math.PI * 0.35} />

      <OverheadTruss position={[0, 4.7, 1.6]} length={8} spots={5} accent="#e11d48" />
      <PottedPlant position={[-6.4, 0, 1.2]} height={1.7} />
      <PottedPlant position={[6.4, 0, 1.2]} height={1.7} />
    </>
  );
});

/* -------------------------------------------------------- sports arena */

export const SportsArenaScene = memo(function SportsArenaScene({
  sources,
  backdrop,
  tickerSpeed,
}: StudioSceneProps) {
  const scroll = ribbonScroll(tickerSpeed);
  return (
    <>
      {/* arena bowl floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[70, 70]} />
        <meshStandardMaterial color="#0c0d10" roughness={0.62} metalness={0.12} envMapIntensity={1.2} />
      </mesh>
      {/* studio ceiling rig — dense grid of spot fixtures over the desk area */}
      <CeilingGrid position={[0, 0, 0.5]} width={22} depth={16} height={6.4} slatsX={10} slatsZ={7} spotsX={6} spotsZ={4} color="#fff1e0" />
      <MaybeBackdrop source={backdrop} position={[0, 6, -16.5]} width={44} height={17} brightness={0.75} />
      {!backdrop || backdrop.kind === 'off' ? (
        <SkyPanel position={[0, 6, -16.6]} width={44} height={17} top="#070a14" bottom="#101830" />
      ) : null}

      <CurvedVideoWall
        source={sources.jumbotron}
        position={[0, 2.5, 0]}
        rotation={[0, Math.PI, 0]}
        radius={9}
        arc={Math.PI * 0.62}
        height={3.4}
      />
      <RibbonBanner source={sources.ribbon} position={[0, 4.7, -6.2]} width={9} height={0.5} scroll={scroll} />

      <SportsDesk position={[0, 0, 1.5]} accent="#f97316" />
      <FramedMonitor source={sources.desk_monitor} position={[1.05, 1.12, 1.24]} rotation={[0, -0.5, 0]} width={0.66} />
      <StudioChair position={[-0.9, 0, 0.3]} rotation={[0, Math.PI + 0.3, 0]} />
      <StudioChair position={[0.9, 0, 0.3]} rotation={[0, Math.PI - 0.3, 0]} />

      <StandingBanner source={sources.sponsor_banner} position={[-5.4, 0, -3.4]} rotation={[0, 0.5, 0]} />
      <StandingBanner source={sources.sponsor_banner} position={[5.4, 0, -3.4]} rotation={[0, -0.5, 0]} />

      {/* arena floor LED: vortex disc + glowing arcs around the desk */}
      <SwirlLedDisc position={[0, 0.015, 2.2]} radius={1.7} color="#22d3ee" spin={0.05} />
      <FloorArcStrip position={[0, 0.012, 1.5]} radius={3.4} arc={Math.PI * 1.4} color="#f97316" tube={0.05} spin={Math.PI * 0.3} />
      <FloorArcStrip position={[0, 0.012, 1.5]} radius={4.2} arc={Math.PI * 1.15} color="#38bdf8" tube={0.035} spin={-Math.PI * 0.35} />
      <WallRails position={[0, 0.22, -6.4]} width={16} count={1} color="#f97316" />

      <OverheadTruss position={[0, 5.4, 0.5]} length={11} spots={7} accent="#f97316" />
      <spotLight position={[-7, 8, 4]} angle={0.6} penumbra={0.7} intensity={40} distance={30} decay={2} color="#e8f1ff" />
      <spotLight position={[7, 8, 4]} angle={0.6} penumbra={0.7} intensity={40} distance={30} decay={2} color="#fff0dd" />
    </>
  );
});

/* --------------------------------------------------------- living room */

export const LivingRoomScene = memo(function LivingRoomScene({
  sources,
  backdrop,
}: StudioSceneProps) {
  return (
    <>
      <RoomShell
        width={14}
        depth={12}
        height={3.2}
        wallColor="#312a26"
        wallTexture="wall_paint"
        floorTexture="wood_walnut"
        floorColor="#3a2a1d"
        accent="#f59e0b"
        ceilingLights={3}
        openBack
      />
      {/* window view — replaceable, with a procedural sky behind it */}
      {!backdrop || backdrop.kind === 'off' ? (
        <SkyPanel position={[2.6, 1.7, -5.9]} width={3.4} height={2.2} />
      ) : null}
      <MaybeBackdrop source={backdrop} position={[2.6, 1.7, -5.9]} width={3.4} height={2.2} brightness={1} />
      <WindowFrame position={[2.6, 1.7, -5.86]} width={3.4} height={2.2} cols={3} rows={2} />

      {/* wall-mounted living room TV */}
      <Television source={sources.tv} position={[-3.1, 1.55, -5.72]} width={2.3} stand={false} />
      <MediaConsole position={[-3.1, 0, -5.5]} width={2.6} />
      <FramedMonitor source={sources.shelf_frame} position={[-0.4, 1.85, -5.92]} width={1.1} />

      <AreaRug position={[0.7, 0, 0.6]} width={4.6} depth={3.2} color="#5b3a29" />
      <StudioSofa position={[0.7, 0, -0.9]} color="#6b584a" width={2.7} />
      <CoffeeTable position={[0.7, 0, 1.0]} width={1.5} depth={0.8} />
      <StudioArmchair position={[3.9, 0, 0.7]} rotation={[0, -1.0, 0]} color="#7c6a58" />
      <Bookshelf position={[6.55, 0, -2.2]} rotation={[0, -Math.PI / 2, 0]} width={1.5} height={2.1} />
      <FloorLamp position={[-1.6, 0, -3.6]} glow="#ffd9a0" height={1.65} />
      <PottedPlant position={[5.6, 0, 3.6]} height={1.6} />
      <PendantLight position={[0.7, 3.15, 0.9]} drop={0.4} glow="#ffe9c7" />
    </>
  );
});

/* ------------------------------------------------------------ talk show */

export const TalkShowScene = memo(function TalkShowScene({
  sources,
  backdrop,
  tickerSpeed,
}: StudioSceneProps) {
  const scroll = ribbonScroll(tickerSpeed);
  return (
    <>
      <RoomShell
        width={16}
        depth={14}
        height={5}
        wallTexture="concrete"
        floorTexture="wood_walnut"
        floorColor="#17110d"
        accent="#8b5cf6"
        ceilingLights={2}
        openBack
      />
      {/* broadcast ceiling grid with rows of warm spot fixtures */}
      <CeilingGrid position={[0, 0, -0.8]} width={15} depth={12.4} height={4.55} slatsX={8} slatsZ={6} spotsX={5} spotsZ={3} color="#ffe9c9" />
      <MaybeBackdrop source={backdrop} position={[0, 2.5, -7.42]} width={15.4} height={4.8} brightness={0.75} />
      <AccentWall position={[0, 2.4, -7.0]} width={13} height={4.6} accent="#8b5cf6" slats={16} />
      <VideoWall source={sources.main_screen} position={[0, 2.5, -6.78]} width={3.8} height={2.1} cols={2} rows={1} />
      <FramedMonitor source={sources.side_screen} position={[-4.4, 2.4, -6.74]} rotation={[0, 0.28, 0]} width={1.8} />
      <FramedMonitor source={sources.side_screen} position={[4.4, 2.4, -6.74]} rotation={[0, -0.28, 0]} width={1.8} />
      <RibbonBanner source={sources.ticker} position={[0, 4.4, -6.7]} width={8.4} height={0.44} scroll={scroll} />

      <StudioSofa position={[-2.6, 0, 0.3]} rotation={[0, 0.85, 0]} color="#5b4a7c" width={2.4} />
      <StudioSofa position={[2.6, 0, 0.3]} rotation={[0, -0.85, 0]} color="#5b4a7c" width={2.4} />
      <CoffeeTable position={[0, 0, 1.35]} width={1.4} depth={0.8} />
      <AreaRug position={[0, 0, 0.6]} width={7.5} depth={4.4} color="#2e2440" />

      <FloorLamp position={[-5.6, 0, -3.4]} glow="#e4d9ff" height={1.7} />
      <FloorLamp position={[5.6, 0, -3.4]} glow="#e4d9ff" height={1.7} />
      <PendantLight position={[-2.6, 4.7, 1.1]} drop={0.7} glow="#f3ecff" />
      <PendantLight position={[2.6, 4.7, 1.1]} drop={0.7} glow="#f3ecff" />

      {/* studio cues: blue cove, geometric frame walls, curved floor line */}
      <CeilingCove position={[0, 0, -0.8]} width={15.4} depth={13.4} height={4.82} color="#38bdf8" intensity={0.9} />
      <GeometricFrameWall position={[-7.92, 2.3, -2.2]} rotation={[0, Math.PI / 2, 0]} width={8} height={3.2} color="#8b5cf6" cols={3} />
      <GeometricFrameWall position={[7.92, 2.3, -2.2]} rotation={[0, -Math.PI / 2, 0]} width={8} height={3.2} color="#8b5cf6" cols={3} />
      <FloorArcStrip position={[-1.2, 0.012, 1.4]} radius={5} arc={Math.PI * 0.6} color="#b79dff" tube={0.05} spin={Math.PI * 0.6} />

      <OverheadTruss position={[0, 4.6, 2.6]} length={7} spots={4} accent="#8b5cf6" />
    </>
  );
});

/* ------------------------------------------------------------- worship */

const Pew = memo(function Pew({
  position,
  rotation,
  width = 2.1,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  width?: number;
}) {
  const m = useStudioMaterials();
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0.45, 0]} material={m.walnut} castShadow receiveShadow>
        <boxGeometry args={[width, 0.1, 0.55]} />
      </mesh>
      <mesh position={[0, 0.75, -0.25]} material={m.walnut} castShadow>
        <boxGeometry args={[width, 0.55, 0.07]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * width) / 2 - side * 0.08, 0.22, 0]} material={m.dark} castShadow>
          <boxGeometry args={[0.08, 0.44, 0.5]} />
        </mesh>
      ))}
    </group>
  );
});

export const WorshipStageScene = memo(function WorshipStageScene({
  sources,
  backdrop,
  tickerSpeed,
}: StudioSceneProps) {
  const scroll = ribbonScroll(tickerSpeed);
  return (
    <>
      <RoomShell
        width={18}
        depth={16}
        height={6.5}
        wallTexture="wall_brick"
        wallColor="#241a14"
        floorTexture="wood_oak"
        floorColor="#2f2216"
        accent="#f59e0b"
        ceilingLights={2}
        openBack
      />
      <MaybeBackdrop source={backdrop} position={[0, 3.2, -7.94]} width={17.4} height={6.4} brightness={0.72} />
      <StageDeck position={[0, 0, -1.6]} width={11} depth={5.4} height={0.35} accent="#f59e0b" />
      <VideoWall source={sources.projection_wall} position={[0, 3.0, -7.3]} width={6.6} height={3.3} />
      <RibbonBanner source={sources.lyric_banner} position={[0, 5.1, -7.24]} width={10} height={0.5} scroll={scroll} />
      <FramedMonitor source={sources.side_screen} position={[-5.4, 3.0, -7.34]} rotation={[0, 0.24, 0]} width={2} />
      <FramedMonitor source={sources.side_screen} position={[5.4, 3.0, -7.34]} rotation={[0, -0.24, 0]} width={2} />

      <Lectern position={[-2.7, 0.35, 0.3]} rotation={[0, 0.25, 0]} />
      <PottedPlant position={[-4.6, 0.35, -2.6]} height={1.5} />
      <PottedPlant position={[4.6, 0.35, -2.6]} height={1.5} />

      <Pew position={[-2.4, 0, 2.6]} rotation={[0, 0.06, 0]} />
      <Pew position={[2.4, 0, 2.6]} rotation={[0, -0.06, 0]} />
      <Pew position={[-2.4, 0, 4.2]} rotation={[0, 0.06, 0]} />
      <Pew position={[2.4, 0, 4.2]} rotation={[0, -0.06, 0]} />

      <OverheadTruss position={[0, 5.7, -1.2]} length={10} spots={6} accent="#f59e0b" />
      <pointLight position={[-3.5, 4.5, -3]} intensity={12} distance={12} decay={2} color="#fbbf24" />
      <pointLight position={[3.5, 4.5, -3]} intensity={12} distance={12} decay={2} color="#fb923c" />
    </>
  );
});

/* ----------------------------------------------------------- cyclorama */

export const CycloramaScene = memo(function CycloramaScene({
  sources,
  backdrop,
}: StudioSceneProps) {
  return (
    <>
      <CycloramaShell position={[0, 0, 0]} rotation={[0, Math.PI, 0]} width={18} depth={14} height={6} radius={3} />
      <MaybeBackdrop source={backdrop} position={[0, 3, -6.6]} width={16} height={5.8} brightness={1} />
      <StandingBanner source={sources.banner} position={[-4.6, 0, -2.2]} rotation={[0, 0.45, 0]} />
      <StandingBanner source={sources.banner} position={[4.6, 0, -2.2]} rotation={[0, -0.45, 0]} />
    </>
  );
});

/* ------------------------------------------------------ weather center */

export const WeatherCenterScene = memo(function WeatherCenterScene({
  sources,
  backdrop,
  tickerSpeed,
}: StudioSceneProps) {
  const scroll = ribbonScroll(tickerSpeed);
  return (
    <>
      <RoomShell
        width={17}
        depth={14}
        height={5.6}
        wallTexture="concrete"
        floorTexture="concrete"
        floorColor="#121217"
        accent="#06b6d4"
        ceilingLights={7}
        openBack
        position={[0, 0, -0.5]}
      />
      <MaybeBackdrop source={backdrop} position={[0, 2.5, -7.42]} width={16.4} height={5} brightness={0.8} />

      {/* chroma-lit presenter wall */}
      <AccentWall position={[4.9, 2.2, -7.0]} width={6} height={4.3} accent="#06b6d4" slats={9} />

      {/* live map wall + forecast crawl */}
      <VideoWall source={sources.map_wall} position={[-1.7, 2.05, -7.0]} width={6.6} height={3.35} cols={3} rows={2} />
      <RibbonBanner source={sources.forecast_ticker} position={[-1.7, 4.1, -7.02]} width={7.2} height={0.42} scroll={scroll} />

      {/* radar / satellite monitor bank */}
      <FramedMonitor source={sources.radar_left} position={[4.15, 2.85, -6.72]} rotation={[0, -0.22, 0]} width={1.5} />
      <FramedMonitor source={sources.radar_right} position={[4.15, 1.42, -6.72]} rotation={[0, -0.22, 0]} width={1.5} />
      <FramedMonitor source={sources.radar_right} position={[5.95, 2.85, -6.38]} rotation={[0, -0.52, 0]} width={1.5} />
      <FramedMonitor source={sources.radar_left} position={[5.95, 1.42, -6.38]} rotation={[0, -0.52, 0]} width={1.5} />

      {/* presenter station */}
      <AnchorDesk position={[2.35, 0, -1.05]} accent="#06b6d4" />
      <FramedMonitor source={sources.desk_monitor} position={[1.35, 1.02, -1.35]} rotation={[0, 0.55, 0]} width={0.62} />
      <StudioChair position={[2.35, 0, -2.6]} rotation={[0, Math.PI, 0]} />

      <OverheadTruss position={[0, 4.95, 1.2]} length={9} spots={6} accent="#06b6d4" />
      <spotLight position={[4.2, 8, 1.6]} angle={0.5} penumbra={0.72} intensity={38} distance={28} decay={2} color="#dff1ff" />
      <spotLight position={[-5, 8, 3]} angle={0.55} penumbra={0.7} intensity={32} distance={28} decay={2} color="#eaf4ff" />

      <PottedPlant position={[-7.1, 0, 1.4]} height={1.7} />
      <PottedPlant position={[7.1, 0, 1.4]} height={1.7} />
    </>
  );
});

/* ------------------------------------------------------------- kitchen */

export const KitchenScene = memo(function KitchenScene({
  sources,
  backdrop,
}: StudioSceneProps) {
  const m = useStudioMaterials();
  return (
    <>
      <RoomShell
        width={14}
        depth={12}
        height={3.3}
        wallColor="#f2efe9"
        wallTexture="wall_paint"
        floorTexture="wood_oak"
        floorColor="#c4ab8c"
        accent="#b08d4f"
        ceilingLights={2}
        openBack
      />
      {/* white slab backsplash behind the runs */}
      <mesh position={[0, 1.62, -5.92]} material={m.white} receiveShadow>
        <boxGeometry args={[12, 1.5, 0.08]} />
      </mesh>

      {/* navy cabinetry: main run with uppers + right return */}
      <CabinetRun position={[-3.3, 0, -5.55]} width={5.6} uppers color="#2b3444" />
      <CabinetRun position={[4.3, 0, -5.55]} width={3.4} uppers color="#2b3444" />
      <OvenStack position={[-0.05, 0, -5.5]} />

      {/* sink + black faucet on the left counter */}
      <mesh position={[-4.6, 0.955, -5.42]}>
        <boxGeometry args={[0.62, 0.035, 0.44]} />
        <meshStandardMaterial color="#17181c" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[-4.6, 1.14, -5.62]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.016, 0.016, 0.34, 10]} />
        <meshStandardMaterial color="#101013" metalness={0.75} roughness={0.28} />
      </mesh>
      <mesh position={[-4.6, 1.3, -5.54]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.18, 10]} />
        <meshStandardMaterial color="#101013" metalness={0.75} roughness={0.28} />
      </mesh>

      {/* open shelving with dishware */}
      <OpenShelving position={[2.35, 0, -5.72]} width={2.1} />

      {/* window over the right return */}
      {!backdrop || backdrop.kind === 'off' ? (
        <SkyPanel position={[4.3, 2.15, -5.94]} width={2.6} height={1.5} />
      ) : null}
      <MaybeBackdrop source={backdrop} position={[4.3, 2.15, -5.94]} width={2.6} height={1.5} brightness={1} />
      <WindowFrame position={[4.3, 2.15, -5.9]} width={2.6} height={1.5} cols={3} rows={2} />

      {/* travertine island + waterfall marble top */}
      <KitchenIsland position={[0.25, 0, -1.85]} width={2.9} depth={1.25} baseColor="#c9bda9" />

      {/* designer glass pendants */}
      <GlassPendantCluster position={[0.25, 3.22, -1.85]} count={3} spacing={1.02} drop={1.15} glow="#ffd9a0" />

      {/* black-frame bar stools */}
      <KitchenBarStool position={[1.35, 0, -0.72]} rotation={[0, -0.35, 0]} />
      <KitchenBarStool position={[2.15, 0, -0.95]} rotation={[0, -0.55, 0]} />

      {/* wall TV on the left + fridge display */}
      <Television source={sources.tv} position={[-6.15, 1.75, -5.78]} width={1.9} stand={false} />
      <FramedMonitor source={sources.fridge_display} position={[6.35, 1.62, -5.75]} width={0.72} />

      <PottedPlant position={[-6.2, 0, 2.2]} height={1.35} />
      <FloorLamp position={[6.2, 0, 1.6]} glow="#ffe6bd" height={1.6} />
    </>
  );
});

/* ------------------------------------------------------------- bedroom */

export const BedroomScene = memo(function BedroomScene({
  sources,
  backdrop,
}: StudioSceneProps) {
  const m = useStudioMaterials();
  return (
    <>
      <RoomShell
        width={13}
        depth={11}
        height={3.1}
        wallColor="#2c2622"
        wallTexture="wall_paint"
        floorTexture="wood_oak"
        floorColor="#4a3527"
        accent="#f472b6"
        ceilingLights={3}
        openBack
      />
      {!backdrop || backdrop.kind === 'off' ? (
        <SkyPanel position={[3.1, 1.7, -5.4]} width={3.2} height={2} top="#f6b9c8" bottom="#fde9d9" />
      ) : null}
      <MaybeBackdrop source={backdrop} position={[3.1, 1.7, -5.4]} width={3.2} height={2} brightness={1} />
      <WindowFrame position={[3.1, 1.7, -5.36]} width={3.2} height={2} cols={3} rows={2} />

      {/* upholstered bed with tufted headboard + draped duvet */}
      <Bed position={[0, 0, -3.0]} width={2.2} color="#7d6b5d" />
      {/* dressed window */}
      <CurtainPanel position={[4.35, 0, -5.22]} width={1.1} height={2.4} color="#a58d7c" />
      <CurtainPanel position={[1.85, 0, -5.22]} width={1.1} height={2.4} color="#a58d7c" />
      {/* nightstands + practicals */}
      {[-1.75, 1.75].map((x) => (
        <RoundedBox key={x} args={[0.55, 0.5, 0.42]} radius={0.03} smoothness={3} position={[x, 0.25, -3.35]} material={m.walnut} castShadow receiveShadow />
      ))}
      <FloorLamp position={[-2.9, 0, -3.4]} glow="#ffd9a8" height={1.5} />
      <AreaRug position={[0, 0, -1.2]} width={4.4} depth={3} color="#7c5566" />

      {/* wall TV + console */}
      <Television source={sources.tv} position={[-2.2, 1.5, -5.28]} width={2} stand={false} />
      <MediaConsole position={[-2.2, 0, -5.05]} width={2.4} />
      <StandingBanner source={sources.art_frame} position={[1.2, 0, -5.2]} width={1.1} height={1.7} />
      <StudioArmchair position={[3.4, 0, 0.4]} rotation={[0, -1.1, 0]} color="#8a6d7c" />
      <PottedPlant position={[-4.9, 0, 1.6]} height={1.5} />
      <Bookshelf position={[5.6, 0, -1.2]} rotation={[0, -Math.PI / 2, 0]} width={1.3} height={1.9} />
      <PendantLight position={[0, 3.05, -1.2]} drop={0.35} glow="#ffe1c4" />
    </>
  );
});

/* ---------------------------------------------------------- conference */

export const ConferenceRoomScene = memo(function ConferenceRoomScene({
  sources,
  backdrop,
  tickerSpeed,
}: StudioSceneProps) {
  const m = useStudioMaterials();
  const scroll = ribbonScroll(tickerSpeed);
  return (
    <>
      <RoomShell
        width={15}
        depth={13}
        height={3.6}
        wallColor="#22262c"
        wallTexture="wall_paint"
        floorTexture="carpet"
        floorColor="#2a2f36"
        accent="#38bdf8"
        ceilingLights={4}
        openBack
      />
      {/* glass wall view */}
      {!backdrop || backdrop.kind === 'off' ? (
        <SkyPanel position={[0, 1.9, -6.42]} width={13.2} height={2.6} top="#8fc3f2" bottom="#e6f1fb" />
      ) : null}
      <MaybeBackdrop source={backdrop} position={[0, 1.9, -6.42]} width={13.2} height={2.6} brightness={0.95} />

      {/* presentation wall */}
      <AccentWall position={[0, 1.9, -6.0]} width={7.2} height={3} accent="#38bdf8" slats={12} />
      <VideoWall source={sources.main_screen} position={[0, 1.95, -5.78]} width={5.4} height={2.4} cols={3} rows={1} seams={false} />
      <FramedMonitor source={sources.side_screen} position={[-5.2, 1.7, -5.72]} rotation={[0, 0.22, 0]} width={1.7} />
      <RibbonBanner source={sources.agenda_ticker} position={[0, 3.35, -5.72]} width={7.4} height={0.4} scroll={scroll} />

      {/* boardroom table + chairs */}
      <RoundedBox args={[4.8, 0.08, 1.7]} radius={0.03} smoothness={4} position={[0, 0.76, -1.1]} material={m.walnut} castShadow receiveShadow />
      <RoundedBox args={[1.2, 0.72, 1.15]} radius={0.03} smoothness={3} position={[0, 0.37, -1.1]} material={m.dark} castShadow />
      {[-1.7, -0.55, 0.55, 1.7].map((x) => (
        <StudioChair key={`f${x}`} position={[x, 0, 0.15]} rotation={[0, Math.PI, 0]} />
      ))}
      {[-1.7, -0.55, 0.55, 1.7].map((x) => (
        <StudioChair key={`b${x}`} position={[x, 0, -2.35]} />
      ))}
      <StudioChair position={[-2.85, 0, -1.1]} rotation={[0, Math.PI / 2, 0]} />
      <StudioChair position={[2.85, 0, -1.1]} rotation={[0, -Math.PI / 2, 0]} />

      <PottedPlant position={[-6.6, 0, -3.2]} height={1.6} />
      <PottedPlant position={[6.6, 0, -3.2]} height={1.6} />
      <MediaConsole position={[-5.2, 0, -5.45]} width={1.9} />
    </>
  );
});

/* ---------------------------------------------------- house exterior */

export const HouseExteriorScene = memo(function HouseExteriorScene({
  sources,
  backdrop,
}: StudioSceneProps) {
  const m = useStudioMaterials();
  return (
    <>
      {/* open sky */}
      {!backdrop || backdrop.kind === 'off' ? (
        <SkyPanel position={[0, 5.2, -11]} width={30} height={13} top="#4f9de0" bottom="#d9ecff" />
      ) : null}
      <MaybeBackdrop source={backdrop} position={[0, 5.2, -11]} width={30} height={13} brightness={1} />
      {/* ground + driveway */}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.concrete} receiveShadow>
        <planeGeometry args={[30, 22]} />
      </mesh>
      {/* facade */}
      <mesh position={[0, 2.3, -6]} material={m.white} castShadow receiveShadow>
        <boxGeometry args={[11, 4.6, 0.4]} />
      </mesh>
      <mesh position={[0, 4.85, -6]} material={m.dark} castShadow>
        <boxGeometry args={[11.6, 0.42, 0.9]} />
      </mesh>
      <mesh position={[0, 4.62, -4.6]} material={m.dark} castShadow>
        <boxGeometry args={[5.2, 0.16, 3.2]} />
      </mesh>
      {/* windows + entry */}
      {[-3.4, 3.4].map((x) => (
        <group key={x}>
          <SkyPanel position={[x, 2.35, -5.78]} width={2.6} height={1.9} />
          <WindowFrame position={[x, 2.35, -5.74]} width={2.6} height={1.9} cols={2} rows={2} />
        </group>
      ))}
      <RoundedBox args={[1.25, 2.35, 0.12]} radius={0.03} smoothness={3} position={[0, 1.175, -5.74]} material={m.walnut} castShadow />
      {/* patio deck + furniture */}
      <mesh position={[0, 0.06, -3.2]} material={m.oak} receiveShadow>
        <boxGeometry args={[9.5, 0.12, 4.6]} />
      </mesh>
      <Television source={sources.porch_tv} position={[-3.6, 1.35, -5.35]} rotation={[0, 0.35, 0]} width={1.6} />
      <StudioSofa position={[2.9, 0.12, -3.3]} rotation={[0, -0.5, 0]} color="#4b5563" width={2.1} />
      <CoffeeTable position={[1.85, 0.12, -2.3]} width={1.1} depth={0.6} />
      <StudioArmchair position={[0.8, 0.12, -3.6]} rotation={[0, 0.7, 0]} color="#57616e" />
      <StandingBanner source={sources.banner} position={[-5.2, 0.12, -2.6]} />
      <PottedPlant position={[-4.6, 0.12, -4.9]} height={1.4} />
      <PottedPlant position={[4.6, 0.12, -4.9]} height={1.4} />
      <PottedPlant position={[-1.5, 0, -4.6]} height={1.2} />
    </>
  );
});

/* ---------------------------------------------------------- green room */

export const GreenRoomScene = memo(function GreenRoomScene({
  sources,
  backdrop,
}: StudioSceneProps) {
  const m = useStudioMaterials();
  return (
    <>
      <RoomShell
        width={13}
        depth={11}
        height={3.2}
        wallColor="#241f2c"
        wallTexture="wall_paint"
        floorTexture="wood_walnut"
        floorColor="#221710"
        accent="#a78bfa"
        ceilingLights={3}
        openBack
      />
      <MaybeBackdrop source={backdrop} position={[0, 1.9, -5.42]} width={8.4} height={2.6} brightness={0.8} />
      <AccentWall position={[0, 1.8, -5.1]} width={9} height={3} accent="#a78bfa" slats={14} />

      {/* vanity mirror with bulb strip */}
      <RoundedBox args={[2.3, 1.5, 0.07]} radius={0.03} smoothness={3} position={[-4.2, 1.75, -5.0]} material={m.walnut} castShadow />
      <mesh position={[-4.2, 1.75, -4.95]}>
        <planeGeometry args={[2.05, 1.25]} />
        <meshStandardMaterial color="#c7d2fe" metalness={0.92} roughness={0.07} envMapIntensity={1.8} />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[-5.15 + i * 0.38, 2.62, -4.95]}>
          <sphereGeometry args={[0.055, 12, 12]} />
          <meshStandardMaterial color="#fef3c7" emissive="#fde68a" emissiveIntensity={2.2} toneMapped={false} />
        </mesh>
      ))}

      {/* lounge cluster */}
      <AreaRug position={[0.8, 0, 0.4]} width={5.2} depth={3.4} color="#3b2f4d" />
      <StudioSofa position={[0.8, 0, -1.1]} color="#6d5a8c" width={2.6} />
      <StudioSofa position={[-1.6, 0, 0.9]} rotation={[0, Math.PI / 2, 0]} color="#6d5a8c" width={2.1} />
      <StudioArmchair position={[3.2, 0, 0.8]} rotation={[0, -1.9, 0]} color="#7c6a9c" />
      <CoffeeTable position={[0.8, 0, 1.1]} width={1.4} depth={0.75} />

      {/* show feed + signage */}
      <Television source={sources.show_feed} position={[4.4, 1.75, -5.0]} width={2.1} stand={false} />
      <MediaConsole position={[4.4, 0, -4.85]} width={2.4} />
      <StandingBanner source={sources.on_air_sign} position={[-2.2, 0, -4.6]} />
      <PottedPlant position={[5.8, 0, 1.8]} height={1.6} />
      <FloorLamp position={[-4.6, 0, 1.2]} glow="#e4d9ff" height={1.65} />
      <Bookshelf position={[-6.05, 0, -1.4]} rotation={[0, Math.PI / 2, 0]} width={1.3} height={1.9} />
      <PendantLight position={[0.8, 3.15, 0.9]} drop={0.4} glow="#e9dcff" />
    </>
  );
});

/* --------------------------------------------------------- xr concert */

export const XrConcertScene = memo(function XrConcertScene({
  sources,
  backdrop,
  tickerSpeed,
}: StudioSceneProps) {
  const scroll = ribbonScroll(tickerSpeed);
  return (
    <>
      {!backdrop || backdrop.kind === 'off' ? (
        <SkyPanel position={[0, 5, -11]} width={28} height={12} top="#050810" bottom="#101c33" />
      ) : null}
      <MaybeBackdrop source={backdrop} position={[0, 5, -11]} width={28} height={12} brightness={0.7} />

      {/* stage + floor glow */}
      <StageDeck position={[0, 0, -2.4]} width={11} depth={6.5} height={0.36} accent="#22d3ee" />
      {[-3.6, 0, 3.6].map((x) => (
        <mesh key={x} position={[x, 0.375, -2.4]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.16, 6.2]} />
          <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={2.4} toneMapped={false} />
        </mesh>
      ))}

      {/* curved main LED + wings */}
      <CurvedVideoWall source={sources.main_wall} position={[0, 2.55, -4.2]} radius={8} arc={Math.PI * 0.52} height={3.4} brightness={1.12} scroll={scroll * 0.4} />
      <VideoWall source={sources.left_wall} position={[-5.5, 2.2, -2.6]} rotation={[0, 0.65, 0]} width={3} height={2.8} cols={2} rows={2} />
      <VideoWall source={sources.right_wall} position={[5.5, 2.2, -2.6]} rotation={[0, -0.65, 0]} width={3} height={2.8} cols={2} rows={2} />
      <RibbonBanner source={sources.ribbon} position={[0, 0.95, -5.9]} width={10.6} height={0.5} scroll={scroll} />

      {/* truss rig */}
      <OverheadTruss position={[0, 5.1, -3]} length={13} />
      <OverheadTruss position={[0, 5.1, -0.2]} length={13} />
      <StandingBanner source={sources.ribbon} position={[-6.4, 0, 0.8]} />
      <PottedPlant position={[-6.2, 0, -1.6]} height={1.6} />
      <PottedPlant position={[6.2, 0, -1.6]} height={1.6} />
    </>
  );
});

/* ===================================================== reference sets ==== */

/** Flat glowing arc strip laid on the floor — the curved LED floor lines. */
function FloorArcStrip({
  position,
  radius,
  arc = Math.PI,
  color = '#eef4ff',
  tube = 0.045,
  spin = 0,
}: {
  position: [number, number, number];
  radius: number;
  arc?: number;
  color?: string;
  tube?: number;
  spin?: number;
}) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, spin]}>
      <torusGeometry args={[radius, tube, 8, 72, arc]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

/** Glowing ring encircling a desk plinth. */
function DeskGlowRing({
  position,
  radius,
  color = '#e11d48',
  tube = 0.032,
}: {
  position: [number, number, number];
  radius: number;
  color?: string;
  tube?: number;
}) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, tube, 10, 80]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

/* ------------------------------------------- global news arena (ref 1) */

export const GlobalNewsArenaScene = memo(function GlobalNewsArenaScene({
  sources,
  backdrop,
  tickerSpeed,
}: StudioSceneProps) {
  const scroll = ribbonScroll(tickerSpeed);
  return (
    <>
      <RoomShell
        width={18}
        depth={15}
        height={6}
        wallTexture="concrete"
        floorTexture="concrete"
        floorColor="#23262c"
        accent="#e11d48"
        ceilingLights={2}
        openBack
        position={[0, 0, -0.5]}
      />
      {/* broadcast ceiling grid with rows of hot spot fixtures */}
      <CeilingGrid position={[0, 0, -0.5]} width={17} depth={13.4} height={5.5} slatsX={9} slatsZ={6} spotsX={6} spotsZ={4} color="#fff3dd" />
      <MaybeBackdrop source={backdrop} position={[0, 2.6, -7.9]} width={16} height={5.4} brightness={0.78} />

      {/* curved tiered risers with LED-edged steps */}
      <TieredPlatform position={[0, 0, -4.6]} tiers={2} radius={6.6} arc={Math.PI * 1.05} color="#e11d48" />

      {/* vortex LED media floor */}
      <SwirlLedDisc position={[0, 0.015, 2.3]} radius={2.25} color="#22d3ee" spin={0.06} />
      <FloorArcStrip position={[0, 0.012, 2.3]} radius={3.1} arc={Math.PI * 1.5} color="#38bdf8" tube={0.05} spin={Math.PI * 0.25} />
      <FloorArcStrip position={[0, 0.012, 2.3]} radius={3.7} arc={Math.PI * 1.2} color="#e11d48" tube={0.035} spin={-Math.PI * 0.4} />

      {/* main LED wall + ticker */}
      <VideoWall source={sources.video_wall} position={[0, 2.5, -7.4]} width={6.2} height={3.4} />
      <RibbonBanner source={sources.ticker} position={[0, 4.55, -7.42]} width={7} height={0.44} scroll={scroll} />
      <FramedMonitor source={sources.side_screen} position={[-4.6, 2.35, -7.3]} rotation={[0, 0.32, 0]} width={1.9} />
      <FramedMonitor source={sources.side_screen} position={[4.6, 2.35, -7.3]} rotation={[0, -0.32, 0]} width={1.9} />

      {/* red LED rails across the back and side walls */}
      <WallRails position={[0, 3.9, -7.82]} width={16} count={2} spacing={0.34} color="#e11d48" y={0} />
      <WallRails position={[-8.92, 1.9, -1.6]} rotation={[0, Math.PI / 2, 0]} width={11} count={3} spacing={0.5} color="#e11d48" />
      <WallRails position={[8.92, 1.9, -1.6]} rotation={[0, -Math.PI / 2, 0]} width={11} count={3} spacing={0.5} color="#e11d48" />

      {/* clad columns with red accents */}
      {[-7.4, 7.4].map((x) => (
        <group key={x} position={[x, 0, -4.4]}>
          <RoundedBox args={[1.05, 6, 1.05]} radius={0.02} smoothness={2} position={[0, 3, 0]} castShadow receiveShadow>
            <meshStandardMaterial color="#3a3e46" roughness={0.6} metalness={0.25} />
          </RoundedBox>
          {[1.2, 2.1, 3.0].map((y) => (
            <mesh key={y} position={[0, y, 0.54]}>
              <boxGeometry args={[1.1, 0.045, 0.03]} />
              <meshBasicMaterial color="#e11d48" toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}

      {/* anchor desk + secondary desk */}
      <AnchorDesk position={[0, 0, 0.7]} accent="#e11d48" />
      <FramedMonitor source={sources.desk_monitor} position={[1.15, 1.03, 0.38]} rotation={[0, -0.55, 0]} width={0.62} />
      <StudioChair position={[0, 0, -1.25]} rotation={[0, Math.PI, 0]} />
      <SportsDesk position={[-5.1, 0, 1.4]} rotation={[0, 0.62, 0]} accent="#e11d48" />

      {/* interview lounge right */}
      <AreaRug position={[5.6, 0, -1.6]} width={3.6} depth={3.2} color="#6d2b33" />
      <StudioArmchair position={[5.0, 0, -2.2]} rotation={[0, -0.85, 0]} color="#c4727f" />
      <StudioArmchair position={[6.6, 0, -0.7]} rotation={[0, -2.2, 0]} color="#c4727f" />
      <CoffeeTable position={[5.9, 0, -1.3]} width={1.15} depth={0.7} />

      {/* overhead rig */}
      <OverheadTruss position={[0, 5.35, -2.2]} length={9} spots={5} accent="#e11d48" />
      <OverheadTruss position={[0, 5.35, -5.2]} length={9} spots={5} accent="#e11d48" />
      <PottedPlant position={[-7.9, 0, 2.4]} height={1.7} />
      <PottedPlant position={[8.0, 0, 2.4]} height={1.7} />
    </>
  );
});

/* -------------------------------------------- classic blue news (ref 2) */

export const ClassicBlueNewsScene = memo(function ClassicBlueNewsScene({
  sources,
  backdrop,
  tickerSpeed,
}: StudioSceneProps) {
  const scroll = ribbonScroll(tickerSpeed);
  return (
    <>
      <RoomShell
        width={15}
        depth={12}
        height={4.6}
        wallColor="#0d2444"
        wallTexture="wall_paint"
        floorTexture="marble"
        floorColor="#0a2140"
        accent="#3b82f6"
        ceilingLights={0}
        openBack
      />
      {/* curved world-map wall */}
      <WorldMapWall position={[0, 2.35, -5.6]} width={12.5} height={4.3} arc={0.62} land="#2f7fd0" bg="#0b2a52" />
      <MaybeBackdrop source={backdrop} position={[0, 2.35, -5.72]} width={12} height={4.3} brightness={0.85} />

      {/* halo ceiling with recessed downlights */}
      <RingCeiling position={[0, 0, -1.6]} radius={3.9} height={4.32} downlights={5} color="#dceaff" />
      <CeilingCove position={[0, 0, -0.4]} width={14.5} depth={11.4} height={4.42} color="#3b82f6" intensity={1.1} />

      {/* blue floor glow lines */}
      <WallRails position={[0, 0.12, -5.62]} width={12} count={1} color="#3b82f6" />
      <FloorArcStrip position={[0, 0.012, -0.6]} radius={4.6} arc={Math.PI} color="#4f9dff" tube={0.05} spin={Math.PI} />
      <FloorArcStrip position={[0, 0.012, -0.6]} radius={5.4} arc={Math.PI} color="#2f6fd0" tube={0.035} spin={Math.PI} />

      {/* glowing white news desk */}
      <AnchorDesk position={[0, 0, 0.4]} accent="#7db4ff" body="#dfe6f4" width={3.6} />
      <FramedMonitor source={sources.desk_monitor} position={[1.2, 1.03, 0.08]} rotation={[0, -0.55, 0]} width={0.62} />
      <StudioChair position={[0, 0, -1.5]} rotation={[0, Math.PI, 0]} />
      <RibbonBanner source={sources.ticker} position={[0, 2.35, -5.58]} width={10.5} height={0.4} scroll={scroll} />
    </>
  );
});

/* --------------------------------------------- amber talk studio (ref 3) */

export const AmberTalkScene = memo(function AmberTalkScene({
  sources,
  backdrop,
  tickerSpeed,
}: StudioSceneProps) {
  const scroll = ribbonScroll(tickerSpeed);
  return (
    <>
      <RoomShell
        width={16}
        depth={12}
        height={4.6}
        wallColor="#e9e5df"
        wallTexture="wall_paint"
        floorTexture="marble"
        floorColor="#c7cad0"
        accent="#f97316"
        ceilingLights={0}
        openBack
      />
      <MaybeBackdrop source={backdrop} position={[0, 2.35, -5.85]} width={13} height={4.2} brightness={0.95} />

      {/* blue ceiling cove + black spot grid */}
      <CeilingCove position={[0, 0, -0.4]} width={15.4} depth={11.4} height={4.42} color="#38bdf8" intensity={1.15} />
      <OverheadTruss position={[0, 4.35, -2.6]} length={10} spots={6} accent="#f97316" />
      <OverheadTruss position={[0, 4.35, 0.4]} length={10} spots={6} accent="#38bdf8" />

      {/* orange geometric frame walls */}
      <GeometricFrameWall position={[-7.92, 2.15, -1.8]} rotation={[0, Math.PI / 2, 0]} width={8} height={3.2} color="#f97316" cols={3} />
      <GeometricFrameWall position={[7.92, 2.15, -1.8]} rotation={[0, -Math.PI / 2, 0]} width={8} height={3.2} color="#f97316" cols={3} />

      {/* vertical framed displays on the left wall */}
      <FramedMonitor source={sources.side_screen} position={[-7.72, 2.05, -3.4]} rotation={[0, Math.PI / 2, 0]} width={1.35} />
      <FramedMonitor source={sources.side_screen} position={[-7.72, 2.05, -1.2]} rotation={[0, Math.PI / 2, 0]} width={1.35} />
      <FramedMonitor source={sources.side_screen} position={[7.72, 2.05, -3.4]} rotation={[0, -Math.PI / 2, 0]} width={1.35} />

      {/* central LED wall + ticker */}
      <VideoWall source={sources.main_screen} position={[0, 2.35, -5.55]} width={5.6} height={3.1} />
      <RibbonBanner source={sources.ticker} position={[0, 4.18, -5.57]} width={6.2} height={0.4} scroll={scroll} />

      {/* white curved desk with orange inset */}
      <AnchorDesk position={[0, 0, 0.2]} accent="#f97316" body="#eef0f4" width={3.5} />
      <FramedMonitor source={sources.desk_monitor} position={[1.15, 1.03, -0.12]} rotation={[0, -0.55, 0]} width={0.62} />
      <StudioChair position={[0, 0, -1.7]} rotation={[0, Math.PI, 0]} />

      {/* orange sofa lounge */}
      <AreaRug position={[4.9, 0, -1.1]} width={4} depth={3.1} color="#d9dde4" />
      <StudioSofa position={[5.2, 0, -1.9]} rotation={[0, -0.72, 0]} color="#e2661f" width={2.9} />
      <CoffeeTable position={[4.5, 0, -0.7]} width={1.3} depth={0.8} />
      <PottedPlant position={[6.9, 0, -2.4]} height={1.05} />

      {/* signature curved floor line */}
      <FloorArcStrip position={[-1.8, 0.012, 1.2]} radius={5.2} arc={Math.PI * 0.62} color="#f2f6ff" tube={0.05} spin={Math.PI * 0.62} />
    </>
  );
});

/* -------------------------------------------- crimson ring studio (ref 4) */

export const CrimsonRingScene = memo(function CrimsonRingScene({
  sources,
  backdrop,
  tickerSpeed,
}: StudioSceneProps) {
  const scroll = ribbonScroll(tickerSpeed);
  return (
    <>
      <RoomShell
        width={15}
        depth={12}
        height={4.8}
        wallColor="#0e0f13"
        wallTexture="concrete"
        floorTexture="marble"
        floorColor="#0b0c10"
        accent="#ef4444"
        ceilingLights={0}
        openBack
      />
      <MaybeBackdrop source={backdrop} position={[0, 2.4, -5.85]} width={13} height={4.2} brightness={0.7} />

      {/* signature glowing ceiling ring */}
      <RingCeiling position={[0, 0, -1.2]} radius={4.3} height={4.45} downlights={6} color="#f4f6ff" />

      {/* triple screens */}
      <VideoWall source={sources.main_screen} position={[0, 2.25, -5.55]} width={4.9} height={2.8} />
      <FramedMonitor source={sources.side_screen} position={[-4.7, 2.1, -5.4]} rotation={[0, 0.3, 0]} width={2.3} />
      <FramedMonitor source={sources.side_screen} position={[4.7, 2.1, -5.4]} rotation={[0, -0.3, 0]} width={2.3} />

      {/* red wall accents */}
      <WallRails position={[0, 3.85, -5.82]} width={12} count={2} spacing={0.3} color="#ef4444" />
      <WallRails position={[-7.42, 1.5, -1]} rotation={[0, Math.PI / 2, 0]} width={9} count={2} spacing={0.42} color="#ef4444" />
      <WallRails position={[7.42, 1.5, -1]} rotation={[0, -Math.PI / 2, 0]} width={9} count={2} spacing={0.42} color="#ef4444" />

      {/* circular dais + ringed desk */}
      <TieredPlatform position={[0, 0, 0.8]} tiers={1} radius={3.1} arc={Math.PI * 2} color="#ef4444" />
      <AnchorDesk position={[0, 0, 0.8]} accent="#ef4444" body="#101116" width={3.4} />
      <DeskGlowRing position={[0, 0.42, 0.8]} radius={2.05} color="#ef4444" tube={0.036} />
      <DeskGlowRing position={[0, 0.2, 0.8]} radius={2.2} color="#ef4444" tube={0.028} />
      <FramedMonitor source={sources.desk_monitor} position={[1.15, 1.03, 0.48]} rotation={[0, -0.55, 0]} width={0.62} />
      <StudioChair position={[0, 0, -1.1]} rotation={[0, Math.PI, 0]} />
      <RibbonBanner source={sources.ticker} position={[0, 4.02, -5.57]} width={7} height={0.4} scroll={scroll} />
    </>
  );
});

/* --------------------------------------------- violet hud news (ref 7/8) */

export const VioletHudScene = memo(function VioletHudScene({
  sources,
  backdrop,
  tickerSpeed,
}: StudioSceneProps) {
  const scroll = ribbonScroll(tickerSpeed);
  return (
    <>
      <RoomShell
        width={14}
        depth={11}
        height={4.8}
        wallColor="#1a1230"
        wallTexture="wall_paint"
        floorTexture="marble"
        floorColor="#141026"
        accent="#a78bfa"
        ceilingLights={0}
        openBack
      />
      {/* violet world-map wall */}
      <WorldMapWall position={[0, 2.25, -5.3]} width={10.5} height={4.1} arc={0.62} land="#8b7cf0" bg="#241a4d" />
      <MaybeBackdrop source={backdrop} position={[0, 2.25, -5.42]} width={10} height={4.1} brightness={0.85} />

      {/* red HUD ring graphics flanking the wall */}
      <HudRingPanel position={[-5.35, 2.1, -5.05]} rotation={[0, 0.42, 0]} width={2.7} height={2.7} accent="#e11d48" />
      <HudRingPanel position={[5.35, 2.1, -5.05]} rotation={[0, -0.42, 0]} width={2.7} height={2.7} accent="#e11d48" flip />

      {/* hanging spot trio with haze beams */}
      <OverheadTruss position={[0, 4.5, -1.2]} length={6} spots={3} accent="#a78bfa" />

      {/* purple circular stage + ringed glowing desk */}
      <TieredPlatform position={[0, 0, 0.55]} tiers={1} radius={2.9} arc={Math.PI * 2} color="#8b5cf6" />
      <AnchorDesk position={[0, 0, 0.55]} accent="#e11d48" body="#6d5bd0" width={3.3} />
      <DeskGlowRing position={[0, 0.44, 0.55]} radius={1.95} color="#e11d48" tube={0.038} />
      <DeskGlowRing position={[0, 0.22, 0.55]} radius={2.12} color="#e11d48" tube={0.03} />
      <FramedMonitor source={sources.desk_monitor} position={[1.12, 1.03, 0.23]} rotation={[0, -0.55, 0]} width={0.62} />
      <StudioChair position={[0, 0, -1.35]} rotation={[0, Math.PI, 0]} />
      <RibbonBanner source={sources.ticker} position={[0, 3.95, -5.32]} width={7} height={0.4} scroll={scroll} />
    </>
  );
});
