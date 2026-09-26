import { memo, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { StudioScreenSource } from '../../../lib/virtualStudio/types';
import { ScreenSurface } from '../ScreenSurface';
import { useStudioTexture } from '../useStudioTexture';

/**
 * Physical screen fixtures — the "plugins" of a virtual set. Each one is a
 * finished piece of hardware (bezel, stand, panel seams, glass) that takes any
 * `StudioScreenSource` on its face.
 *
 * All components accept standard object props (`position`, `rotation`,
 * `scale`) so scenes can place them freely.
 */

type FixtureProps = {
  source?: StudioScreenSource;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  brightness?: number;
  /** Set false to drop the screen's light spill (perf on screen-heavy sets). */
  spill?: boolean;
};

const BEZEL = '#101013';
const BRUSHED = '#2a2a30';

/**
 * Practical light spilling from a screen onto the set — real screens visibly
 * wash nearby surfaces with cool light, which is one of the strongest
 * photoreal cues on a virtual set.
 */
function ScreenSpill({
  intensity,
  distance,
  position = [0, 0, 0.5],
}: {
  intensity: number;
  distance: number;
  position?: [number, number, number];
}) {
  return (
    <pointLight position={position} intensity={intensity} distance={distance} decay={2} color="#d7e6ff" />
  );
}

/**
 * Anti-glare glass reflection — a soft diagonal sheen across the panel, the
 * giveaway detail that separates real displays from flat emissive quads.
 */
let sheenTexture: THREE.CanvasTexture | null = null;
function getSheenTexture(): THREE.CanvasTexture {
  if (sheenTexture) return sheenTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,0.15)');
  g.addColorStop(0.32, 'rgba(255,255,255,0.025)');
  g.addColorStop(0.52, 'rgba(255,255,255,0.09)');
  g.addColorStop(0.78, 'rgba(255,255,255,0.015)');
  g.addColorStop(1, 'rgba(255,255,255,0.05)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  sheenTexture = new THREE.CanvasTexture(canvas);
  return sheenTexture;
}

function GlassSheen({
  width,
  height,
  z,
  opacity = 0.55,
}: {
  width: number;
  height: number;
  z: number;
  opacity?: number;
}) {
  return (
    <mesh position={[0, 0, z]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={getSheenTexture()}
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}

export const Television = memo(function Television({
  source,
  position,
  rotation,
  scale = 1,
  brightness = 1.05,
  width = 1.8,
  stand = true,
  scroll = 0,
  spill = true,
}: FixtureProps & {
  width?: number;
  stand?: boolean;
  scroll?: number;
}) {
  const height = width * 0.5625;
  const bezel = 0.045;
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {spill && <ScreenSpill intensity={5 * brightness} distance={3.2} position={[0, 0, 0.55]} />}
      <RoundedBox args={[width, height, 0.055]} radius={0.012} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial color={BEZEL} metalness={0.6} roughness={0.32} envMapIntensity={1.2} />
      </RoundedBox>
      <group position={[0, 0, 0.0285]}>
        <ScreenSurface
          source={source}
          width={width - bezel * 2}
          height={height - bezel * 2}
          brightness={brightness}
          scroll={scroll}
          form="television"
        />
        <GlassSheen width={width - bezel * 2} height={height - bezel * 2} z={0.003} />
      </group>
      {stand && (
        <group position={[0, -height / 2, 0]}>
          <mesh position={[0, -0.06, 0]} castShadow>
            <cylinderGeometry args={[0.035, 0.05, 0.12, 24]} />
            <meshStandardMaterial color={BRUSHED} metalness={0.85} roughness={0.28} />
          </mesh>
          <RoundedBox args={[width * 0.42, 0.02, 0.2]} radius={0.008} smoothness={3} position={[0, -0.125, 0.02]} receiveShadow>
            <meshStandardMaterial color={BEZEL} metalness={0.7} roughness={0.35} />
          </RoundedBox>
        </group>
      )}
    </group>
  );
});

export const FramedMonitor = memo(function FramedMonitor({
  source,
  position,
  rotation,
  scale = 1,
  brightness = 1,
  width = 1.1,
  scroll = 0,
  spill = true,
}: FixtureProps & { width?: number; scroll?: number }) {
  const height = width * 0.6;
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {spill && <ScreenSpill intensity={2.2 * brightness} distance={2.2} position={[0, 0, 0.4]} />}
      <RoundedBox args={[width, height, 0.04]} radius={0.01} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial color={BEZEL} metalness={0.55} roughness={0.3} />
      </RoundedBox>
      <group position={[0, 0, 0.0215]}>
        <ScreenSurface
          source={source}
          width={width - 0.05}
          height={height - 0.05}
          brightness={brightness}
          ledGrid
          ledPitch={22}
          scroll={scroll}
          form="monitor"
        />
        <GlassSheen width={width - 0.05} height={height - 0.05} z={0.003} opacity={0.4} />
      </group>
    </group>
  );
});

/**
 * Multi-panel LED video wall with visible seams — the centerpiece of news and
 * sports sets. Panels can be textured as one continuous image.
 */
export const VideoWall = memo(function VideoWall({
  source,
  position,
  rotation,
  scale = 1,
  brightness = 1.15,
  width = 5.2,
  height = 2.9,
  cols = 4,
  rows = 2,
  seams = true,
  scroll = 0,
  spill = true,
}: FixtureProps & {
  width?: number;
  height?: number;
  cols?: number;
  rows?: number;
  seams?: boolean;
  scroll?: number;
}) {
  const frame = 0.06;
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {spill && (
        <>
          <ScreenSpill intensity={9 * brightness} distance={8} position={[-width * 0.22, 0, 1]} />
          <ScreenSpill intensity={9 * brightness} distance={8} position={[width * 0.22, 0, 1]} />
        </>
      )}
      <RoundedBox args={[width + frame, height + frame, 0.12]} radius={0.02} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial color="#0b0b0e" metalness={0.5} roughness={0.42} envMapIntensity={1.1} />
      </RoundedBox>
      <group position={[0, 0, 0.062]}>
        <ScreenSurface
          source={source}
          width={width}
          height={height}
          brightness={brightness}
          ledGrid
          ledPitch={18}
          scroll={scroll}
          form="video-wall"
        />
        {seams &&
          Array.from({ length: cols - 1 }, (_, i) => {
            const x = -width / 2 + ((i + 1) * width) / cols;
            return (
              <mesh key={`c${i}`} position={[x, 0, 0.004]}>
                <planeGeometry args={[0.012, height]} />
                <meshBasicMaterial color="#050507" toneMapped={false} />
              </mesh>
            );
          })}
        {seams &&
          Array.from({ length: rows - 1 }, (_, i) => {
            const y = -height / 2 + ((i + 1) * height) / rows;
            return (
              <mesh key={`r${i}`} position={[0, y, 0.004]}>
                <planeGeometry args={[width, 0.012]} />
                <meshBasicMaterial color="#050507" toneMapped={false} />
              </mesh>
            );
          })}
        <GlassSheen width={width} height={height} z={0.006} opacity={0.34} />
      </group>
      {/* wall mounting rail */}
      <mesh position={[0, height / 2 + 0.1, -0.08]} castShadow>
        <boxGeometry args={[width * 0.9, 0.06, 0.06]} />
        <meshStandardMaterial color="#18181b" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
});

/** Thin LED ribbon board for tickers, scores and sponsor loops. */
export const RibbonBanner = memo(function RibbonBanner({
  source,
  position,
  rotation,
  scale = 1,
  brightness = 1.2,
  width = 6,
  height = 0.42,
  scroll = 0.06,
  spill = true,
}: FixtureProps & { width?: number; height?: number; scroll?: number }) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {spill && <ScreenSpill intensity={3 * brightness} distance={3} position={[0, -0.15, 0.5]} />}
      <RoundedBox args={[width, height, 0.07]} radius={0.02} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial color="#0c0c10" metalness={0.55} roughness={0.4} />
      </RoundedBox>
      <group position={[0, 0, 0.037]}>
        <ScreenSurface
          source={source}
          width={width - 0.04}
          height={height - 0.04}
          brightness={brightness}
          ledGrid
          ledPitch={20}
          scroll={scroll}
          form="ribbon"
        />
      </group>
    </group>
  );
});

/** Roll-up / pull-up banner for sponsors, logos and lower-third graphics. */
export const StandingBanner = memo(function StandingBanner({
  source,
  position,
  rotation,
  scale = 1,
  brightness = 0.95,
  width = 0.9,
  height = 2.1,
  spill = true,
}: FixtureProps & { width?: number; height?: number }) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {spill && <ScreenSpill intensity={1.4 * brightness} distance={2.4} position={[0, height / 2 + 0.08, 0.4]} />}
      <RoundedBox args={[width, height, 0.035]} radius={0.012} smoothness={4} position={[0, height / 2 + 0.08, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#15151a" metalness={0.4} roughness={0.5} />
      </RoundedBox>
      <group position={[0, height / 2 + 0.08, 0.019]}>
        <ScreenSurface source={source} width={width - 0.03} height={height - 0.03} brightness={brightness} form="banner" />
      </group>
      <RoundedBox args={[width * 0.9, 0.05, 0.34]} radius={0.015} smoothness={3} position={[0, 0.025, 0.04]} castShadow receiveShadow>
        <meshStandardMaterial color={BRUSHED} metalness={0.85} roughness={0.3} />
      </RoundedBox>
    </group>
  );
});

/** Curved LED wall — wraps the set the way stadium boards do. */
export const CurvedVideoWall = memo(function CurvedVideoWall({
  source,
  position,
  rotation,
  scale = 1,
  brightness = 1.1,
  radius = 7,
  arc = Math.PI * 0.55,
  height = 2.6,
  segments = 48,
  scroll = 0,
  spill = true,
}: FixtureProps & {
  radius?: number;
  arc?: number;
  height?: number;
  segments?: number;
  scroll?: number;
}) {
  const { texture } = useStudioTexture(source, 'cover', 'video-wall', height > 0 ? (arc * radius) / height : undefined);
  const color = useMemo(
    () => new THREE.Color(brightness, brightness, brightness),
    [brightness],
  );

  useFrame((_, delta) => {
    if (!texture || !scroll) return;
    // Textures are mutable by design; RepeatWrapping + offset.x drives the loop.
    // eslint-disable-next-line react-hooks/immutability
    texture.wrapS = THREE.RepeatWrapping;
    // eslint-disable-next-line react-hooks/immutability
    texture.offset.x = (texture.offset.x - delta * scroll) % 1;
  });

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {spill && (
        <>
          <ScreenSpill intensity={8 * brightness} distance={9} position={[-radius * 0.28, 0, radius - 2.4]} />
          <ScreenSpill intensity={8 * brightness} distance={9} position={[radius * 0.28, 0, radius - 2.4]} />
        </>
      )}
      {/* housing */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[radius + 0.1, radius + 0.1, height + 0.16, segments, 1, true, -arc / 2, arc]} />
        <meshStandardMaterial color="#0b0b0e" metalness={0.5} roughness={0.42} side={THREE.BackSide} />
      </mesh>
      {/* emissive face */}
      <mesh>
        <cylinderGeometry args={[radius, radius, height, segments, 1, true, -arc / 2, arc]} />
        <meshBasicMaterial
          map={texture}
          toneMapped={false}
          side={THREE.BackSide}
          color={color}
        />
      </mesh>
    </group>
  );
});
