import { memo, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStudioMaterials } from './materials';
import { PbrSurface } from './PbrSurface';
import { LightBeam } from './LightBeam';

/**
 * Signature broadcast-stage fixtures modelled on professional virtual set
 * designs: circular LED stage floors, glowing ceiling rings, LED accent rails,
 * ceiling coves, tiered platforms, world-map walls and tech HUD panels.
 */

const Place = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  scale: 1,
};

export interface PlaceProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
}

/* ------------------------------------------------------ texture helpers */

const swirlCache = new Map<string, THREE.CanvasTexture>();
/** Concentric swirl LED face — the vortex media floor seen on arena sets. */
function getSwirlTexture(color = '#22d3ee', dark = '#06121f'): THREE.CanvasTexture {
  const key = `${color}:${dark}`;
  const hit = swirlCache.get(key);
  if (hit) return hit;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;
  ctx.fillStyle = dark;
  ctx.fillRect(0, 0, size, size);
  // radial glow core
  const core = ctx.createRadialGradient(cx, cy, 10, cx, cy, size / 2);
  core.addColorStop(0, color);
  core.addColorStop(0.35, `${color}66`);
  core.addColorStop(1, `${dark}`);
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);
  // spiral arcs
  ctx.lineWidth = 7;
  for (let i = 0; i < 26; i += 1) {
    const t = i / 26;
    const r = 26 + t * (size / 2 - 30);
    const spin = t * Math.PI * 1.4;
    ctx.strokeStyle = i % 2 === 0 ? `${color}cc` : `${color}55`;
    ctx.beginPath();
    ctx.arc(cx, cy, r, spin, spin + Math.PI * (0.9 + t * 0.8));
    ctx.stroke();
  }
  // faint pixel pitch
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= size; i += 16) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.center.set(0.5, 0.5);
  swirlCache.set(key, tex);
  return tex;
}

/** Continents as rough equirectangular silhouettes (x,y in 0..1 map space). */
const CONTINENTS: number[][][] = [
  // North America
  [[0.08, 0.16], [0.2, 0.1], [0.3, 0.13], [0.31, 0.24], [0.26, 0.3], [0.24, 0.42], [0.19, 0.4], [0.16, 0.3], [0.1, 0.26]],
  // Central + South America
  [[0.22, 0.44], [0.28, 0.45], [0.31, 0.52], [0.33, 0.62], [0.3, 0.78], [0.25, 0.86], [0.22, 0.74], [0.23, 0.6], [0.2, 0.5]],
  // Europe
  [[0.45, 0.14], [0.55, 0.12], [0.58, 0.2], [0.53, 0.27], [0.47, 0.28], [0.43, 0.22]],
  // Africa
  [[0.44, 0.33], [0.55, 0.31], [0.6, 0.38], [0.59, 0.52], [0.54, 0.68], [0.48, 0.7], [0.45, 0.58], [0.42, 0.43]],
  // Asia
  [[0.58, 0.1], [0.78, 0.08], [0.9, 0.16], [0.88, 0.28], [0.8, 0.34], [0.76, 0.46], [0.68, 0.42], [0.62, 0.32], [0.57, 0.2]],
  // Australia
  [[0.8, 0.6], [0.9, 0.58], [0.93, 0.68], [0.87, 0.76], [0.8, 0.72]],
];

const worldMapCache = new Map<string, THREE.CanvasTexture>();
/** Stylised broadcast world-map wall: continents, lat/long grid, soft glow. */
function getWorldMapTexture(
  land = '#2f7fd0',
  grid = 'rgba(120,190,255,0.35)',
  bg = '#0b2a52',
): THREE.CanvasTexture {
  const key = `${land}:${grid}:${bg}`;
  const hit = worldMapCache.get(key);
  if (hit) return hit;
  const w = 1024;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(w / 2, h / 2, 60, w / 2, h / 2, w * 0.65);
  grad.addColorStop(0, '#164a8c');
  grad.addColorStop(1, bg);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // lat/long grid
  ctx.strokeStyle = grid;
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 12; i += 1) {
    const x = (i / 12) * w;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let i = 1; i < 6; i += 1) {
    const y = (i / 6) * h;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  // continents
  ctx.fillStyle = land;
  ctx.shadowColor = 'rgba(120,190,255,0.8)';
  ctx.shadowBlur = 18;
  for (const poly of CONTINENTS) {
    ctx.beginPath();
    poly.forEach(([x, y], i) => {
      const px = x * w;
      const py = y * h;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  worldMapCache.set(key, tex);
  return tex;
}

const hudCache = new Map<string, THREE.CanvasTexture>();
/** Tech HUD panel — circular target rings, tick arcs, diagonal hazard stripes. */
function getHudTexture(accent = '#e11d48'): THREE.CanvasTexture {
  const hit = hudCache.get(accent);
  if (hit) return hit;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.clearRect(0, 0, size, size);
  const cx = size * 0.34;
  const cy = size * 0.5;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 5;
  for (const r of [60, 110, 150, 205]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI * 0.85, Math.PI * 0.85);
    ctx.stroke();
  }
  ctx.lineWidth = 2;
  for (let i = 0; i < 36; i += 1) {
    const a = (i / 36) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 225, cy + Math.sin(a) * 225);
    ctx.lineTo(cx + Math.cos(a) * 245, cy + Math.sin(a) * 245);
    ctx.stroke();
  }
  // diagonal hazard stripes on the right
  ctx.lineWidth = 14;
  for (let i = 0; i < 7; i += 1) {
    ctx.beginPath();
    ctx.moveTo(size * 0.62 + i * 26, size * 0.2);
    ctx.lineTo(size * 0.5 + i * 26, size * 0.8);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  hudCache.set(accent, tex);
  return tex;
}

/* ------------------------------------------------------------ fixtures */

/** Circular LED media floor — the glowing vortex disc at the heart of arena sets. */
export const SwirlLedDisc = memo(function SwirlLedDisc({
  position = Place.position,
  rotation = Place.rotation,
  scale = Place.scale,
  radius = 2.2,
  color = '#22d3ee',
  spin = 0.05,
}: PlaceProps & { radius?: number; color?: string; spin?: number }) {
  const tex = useMemo(() => getSwirlTexture(color), [color]);
  const rim = useMemo(() => new THREE.Color(color), [color]);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* recessed dark ring housing */}
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[radius, radius + 0.34, 64]} />
        <PbrSurface color="#14161c" metalness={0.55} roughness={0.42} />
      </mesh>
      {/* LED face */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius, 64]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {/* glow rim */}
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius - 0.05, radius + 0.06, 64]} />
        <meshBasicMaterial color={rim} transparent opacity={0.75} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      {spin > 0 && <SpinDisc texture={tex} speed={spin} />}
    </group>
  );
});

function SpinDisc({ texture, speed }: { texture: THREE.Texture; speed: number }) {
  // Slow rotation of the LED media face — subtle live-studio motion.
  useFrame((_, delta) => {
    // eslint-disable-next-line react-hooks/immutability -- live three.js texture animation
    texture.rotation += speed * delta;
  });
  return null;
}

/**
 * Glowing ceiling ring with integrated downlights — the signature halo ceiling
 * of modern news studios.
 */
export const RingCeiling = memo(function RingCeiling({
  position = Place.position,
  rotation = Place.rotation,
  scale = Place.scale,
  radius = 4.2,
  color = '#ffffff',
  downlights = 8,
  height = 4.6,
}: PlaceProps & { radius?: number; color?: string; downlights?: number; height?: number }) {
  const m = useStudioMaterials();
  const glow = useMemo(() => new THREE.Color(color), [color]);
  const spots = useMemo(
    () => Array.from({ length: downlights }, (_, i) => (i / downlights) * Math.PI * 2),
    [downlights],
  );
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* dark ceiling annulus */}
      <mesh position={[0, height + 0.12, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.dark}>
        <ringGeometry args={[radius - 0.5, radius + 1.6, 64]} />
      </mesh>
      {/* glowing ring */}
      <mesh position={[0, height, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, 0.16, 12, 72]} />
        <meshBasicMaterial color={glow} toneMapped={false} />
      </mesh>
      {/* soft glow halo */}
      <mesh position={[0, height - 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, 0.38, 10, 72]} />
        <meshBasicMaterial color={glow} transparent opacity={0.16} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* recessed inner disc */}
      <mesh position={[0, height + 0.2, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.dark}>
        <circleGeometry args={[radius - 0.5, 64]} />
      </mesh>
      {spots.map((a, i) => {
        const x = Math.sin(a) * (radius - 0.55);
        const z = Math.cos(a) * (radius - 0.55);
        return (
          <group key={i} position={[x, height - 0.06, z]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.12, 16]} />
              <meshBasicMaterial color={glow} toneMapped={false} />
            </mesh>
            <pointLight position={[0, -0.3, 0]} intensity={2.4} distance={6.5} decay={2} color={glow} />
            <LightBeam position={[0, -1.7, 0]} height={3.4} radius={0.55} color={color} opacity={0.07} />
          </group>
        );
      })}
    </group>
  );
});

/** Horizontal LED accent rails that run along set walls. */
export const WallRails = memo(function WallRails({
  position = Place.position,
  rotation = Place.rotation,
  scale = Place.scale,
  width = 12,
  count = 3,
  spacing = 0.55,
  color = '#e11d48',
  y = 1.6,
  thickness = 0.035,
}: PlaceProps & { width?: number; count?: number; spacing?: number; color?: string; y?: number; thickness?: number }) {
  const glow = useMemo(() => new THREE.Color(color), [color]);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {Array.from({ length: count }, (_, i) => {
        const yy = y + (i - (count - 1) / 2) * spacing;
        return (
          <group key={i}>
            <mesh position={[0, yy, 0]}>
              <boxGeometry args={[width, thickness, 0.02]} />
              <meshBasicMaterial color={glow} toneMapped={false} />
            </mesh>
            <mesh position={[0, yy, -0.015]}>
              <boxGeometry args={[width, thickness * 3.6, 0.012]} />
              <meshBasicMaterial color={glow} transparent opacity={0.14} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
});

/** Perimeter ceiling cove — the glowing band where wall meets ceiling. */
export const CeilingCove = memo(function CeilingCove({
  position = Place.position,
  rotation = Place.rotation,
  scale = Place.scale,
  width = 14,
  depth = 10,
  height = 4.2,
  color = '#38bdf8',
  intensity = 0.9,
}: PlaceProps & { width?: number; depth?: number; height?: number; color?: string; intensity?: number }) {
  const glow = useMemo(() => new THREE.Color(color), [color]);
  const halfW = width / 2 - 0.12;
  const halfD = depth / 2 - 0.12;
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {[
        { pos: [0, height, -halfD] as [number, number, number], size: [width, 0.07, 0.07] as [number, number, number] },
        { pos: [0, height, halfD] as [number, number, number], size: [width, 0.07, 0.07] as [number, number, number] },
        { pos: [-halfW, height, 0] as [number, number, number], size: [0.07, 0.07, depth] as [number, number, number] },
        { pos: [halfW, height, 0] as [number, number, number], size: [0.07, 0.07, depth] as [number, number, number] },
      ].map((seg, i) => (
        <group key={i} position={seg.pos}>
          <mesh>
            <boxGeometry args={seg.size} />
            <meshBasicMaterial color={glow} toneMapped={false} />
          </mesh>
          <mesh position={[0, -0.05, 0]}>
            <boxGeometry args={[seg.size[0] * 1.02, 0.22, seg.size[2] * 1.02]} />
            <meshBasicMaterial color={glow} transparent opacity={0.12 * intensity} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
});

/** Teardrop glass pendants with brass fittings — designer kitchen lighting. */
export const GlassPendantCluster = memo(function GlassPendantCluster({
  position = Place.position,
  rotation = Place.rotation,
  scale = Place.scale,
  count = 3,
  spacing = 1.05,
  drop = 1.35,
  glow = '#ffd9a0',
}: PlaceProps & { count?: number; spacing?: number; drop?: number; glow?: string }) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {Array.from({ length: count }, (_, i) => {
        const x = (i - (count - 1) / 2) * spacing;
        const d = drop + (i % 2) * 0.18;
        return (
          <group key={i} position={[x, 0, 0]}>
            {/* braided cord + brass collar */}
            <mesh position={[0, -d / 2, 0]}>
              <cylinderGeometry args={[0.006, 0.006, d, 6]} />
              <PbrSurface color="#1c1917" roughness={0.7} />
            </mesh>
            <mesh position={[0, -d - 0.02, 0]}>
              <cylinderGeometry args={[0.035, 0.022, 0.09, 12]} />
              <PbrSurface color="#b08d4f" metalness={1} roughness={0.32} envMapIntensity={1.5} />
            </mesh>
            {/* teardrop glass globe */}
            <mesh position={[0, -d - 0.22, 0]} scale={[1, 1.32, 1]}>
              <sphereGeometry args={[0.16, 24, 20]} />
              <PbrSurface physical
                color="#fdf6ec"
                transparent
                opacity={0.28}
                roughness={0.06}
                metalness={0}
                clearcoat={1}
                clearcoatRoughness={0.05}
                envMapIntensity={1.6}
              />
            </mesh>
            {/* filament */}
            <mesh position={[0, -d - 0.21, 0]}>
              <sphereGeometry args={[0.045, 12, 10]} />
              <meshBasicMaterial color={glow} toneMapped={false} />
            </mesh>
            <pointLight position={[0, -d - 0.24, 0]} intensity={1.6} distance={4} decay={2} color={glow} />
          </group>
        );
      })}
    </group>
  );
});

/** Curved tiered platform with LED-edged steps — arena anchor risers. */
export const TieredPlatform = memo(function TieredPlatform({
  position = Place.position,
  rotation = Place.rotation,
  scale = Place.scale,
  tiers = 2,
  radius = 5.4,
  arc = Math.PI * 0.9,
  color = '#e11d48',
}: PlaceProps & { tiers?: number; radius?: number; arc?: number; color?: string }) {
  const glow = useMemo(() => new THREE.Color(color), [color]);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {Array.from({ length: tiers }, (_, i) => {
        const r = radius - i * 0.85;
        const h = 0.16 * (i + 1);
        return (
          <group key={i}>
            {/* deck */}
            <mesh position={[0, h / 2, 0]} receiveShadow castShadow>
              <cylinderGeometry args={[r, r, h, 48, 1, false, -arc / 2, arc]} />
              <PbrSurface color="#2a2d34" roughness={0.52} metalness={0.22} envMapIntensity={1.1} />
            </mesh>
            {/* LED edge strip along the arc */}
            <mesh position={[0, h + 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[r - 0.07, r, 48, 1, -arc / 2, arc]} />
              <meshBasicMaterial color={glow} toneMapped={false} side={THREE.DoubleSide} />
            </mesh>
            {/* riser face */}
            <mesh position={[0, h / 2, 0]}>
              <cylinderGeometry args={[r + 0.012, r + 0.012, h * 0.82, 48, 1, true, -arc / 2, arc]} />
              <PbrSurface color="#1b1e24" roughness={0.6} metalness={0.35} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
});

/** Orange geometric line frames — the graphic wall language of talk sets. */
export const GeometricFrameWall = memo(function GeometricFrameWall({
  position = Place.position,
  rotation = Place.rotation,
  scale = Place.scale,
  width = 6,
  height = 3.4,
  color = '#f97316',
  cols = 3,
}: PlaceProps & { width?: number; height?: number; color?: string; cols?: number }) {
  const glow = useMemo(() => new THREE.Color(color), [color]);
  const frames = useMemo(
    () =>
      Array.from({ length: cols }, (_, i) => ({
        x: ((i + 0.5) / cols - 0.5) * width * 0.9,
        w: (width / cols) * 0.62,
        h: height * (0.5 + ((i % 3) * 0.16)),
        y: (i % 2 === 0 ? 0.12 : -0.1) * height,
      })),
    [cols, width, height],
  );
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {frames.map((f, i) => (
        <group key={i} position={[f.x, f.y, 0]}>
          {/* clean rectangular line frame (4 rails) */}
          {[[-f.w / 2, 0], [f.w / 2, 0]].map(([x], j) => (
            <mesh key={`v${j}`} position={[x, 0, 0]}>
              <boxGeometry args={[0.035, f.h, 0.018]} />
              <meshBasicMaterial color={glow} toneMapped={false} />
            </mesh>
          ))}
          {[[0, f.h / 2], [0, -f.h / 2]].map(([, y], j) => (
            <mesh key={`h${j}`} position={[0, y, 0]}>
              <boxGeometry args={[f.w, 0.035, 0.018]} />
              <meshBasicMaterial color={glow} toneMapped={false} />
            </mesh>
          ))}
          {/* soft inner glow panel */}
          <mesh position={[0, 0, -0.012]}>
            <planeGeometry args={[f.w * 0.9, f.h * 0.9]} />
            <meshBasicMaterial color={glow} transparent opacity={0.1} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
});

/** Tech HUD ring panels flanking a video wall (targeting graphics + stripes). */
export const HudRingPanel = memo(function HudRingPanel({
  position = Place.position,
  rotation = Place.rotation,
  scale = Place.scale,
  width = 2.6,
  height = 2.6,
  accent = '#e11d48',
  flip = false,
}: PlaceProps & { width?: number; height?: number; accent?: string; flip?: boolean }) {
  const tex = useMemo(() => getHudTexture(accent), [accent]);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh scale={[flip ? -1 : 1, 1, 1]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={tex} transparent opacity={0.92} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
});

/** Curved world-map wall — the classic news backdrop with lat/long grid. */
export const WorldMapWall = memo(function WorldMapWall({
  position = Place.position,
  rotation = Place.rotation,
  scale = Place.scale,
  width = 12,
  height = 5,
  arc = 0.55,
  land = '#2f7fd0',
  bg = '#0b2a52',
}: PlaceProps & { width?: number; height?: number; arc?: number; land?: string; bg?: string }) {
  const tex = useMemo(() => getWorldMapTexture(land, undefined, bg), [land, bg]);
  // Curved wall: a cylinder segment behind the group origin, concave toward
  // the camera so it wraps around the desk like a real news backdrop.
  const radius = width / arc;
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh position={[0, height / 2, radius]}>
        <cylinderGeometry args={[radius, radius, height, 64, 1, true, Math.PI - arc / 2, arc]} />
        <meshBasicMaterial map={tex} side={THREE.BackSide} toneMapped={false} />
      </mesh>
    </group>
  );
});

/**
 * Broadcast ceiling grid — dark coffered slats, track rails and rows of studio
 * spot fixtures with glowing lenses. The dense, fixture-rich ceilings of real
 * studios (and the strongest ceiling cue in the reference photos).
 */
export const CeilingGrid = memo(function CeilingGrid({
  position = Place.position,
  rotation = Place.rotation,
  scale = Place.scale,
  width = 15,
  depth = 11,
  height = 4.6,
  slatsX = 8,
  slatsZ = 6,
  spotsX = 5,
  spotsZ = 3,
  color = '#fff3dd',
  rails = true,
}: PlaceProps & {
  width?: number;
  depth?: number;
  height?: number;
  slatsX?: number;
  slatsZ?: number;
  spotsX?: number;
  spotsZ?: number;
  color?: string;
  rails?: boolean;
}) {
  const m = useStudioMaterials();
  const glow = useMemo(() => new THREE.Color(color), [color]);
  const slat = 0.14;
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* dark deck above the grid */}
      <mesh position={[0, height + 0.22, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.dark}>
        <planeGeometry args={[width + 0.6, depth + 0.6]} />
      </mesh>
      {/* coffered slat lattice */}
      {Array.from({ length: slatsX + 1 }, (_, i) => {
        const x = -width / 2 + (i * width) / slatsX;
        return (
          <mesh key={`sx${i}`} position={[x, height, 0]} material={m.dark}>
            <boxGeometry args={[slat, 0.16, depth]} />
          </mesh>
        );
      })}
      {Array.from({ length: slatsZ + 1 }, (_, i) => {
        const z = -depth / 2 + (i * depth) / slatsZ;
        return (
          <mesh key={`sz${i}`} position={[0, height - 0.02, z]} material={m.dark}>
            <boxGeometry args={[width, 0.12, slat]} />
          </mesh>
        );
      })}
      {/* metal track rails the fixtures clamp onto */}
      {rails &&
        Array.from({ length: Math.max(1, spotsZ) }, (_, i) => {
          const z = -depth / 2 + ((i + 0.5) * depth) / spotsZ;
          return (
            <mesh key={`rail${i}`} position={[0, height - 0.14, z]} material={m.metal}>
              <boxGeometry args={[width * 0.94, 0.05, 0.09]} />
            </mesh>
          );
        })}
      {/* spot fixture rows — housings with hot emissive lenses */}
      {Array.from({ length: spotsX * spotsZ }, (_, i) => {
        const ix = i % spotsX;
        const iz = Math.floor(i / spotsX);
        const x = -width / 2 + ((ix + 0.5) * width) / spotsX;
        const z = -depth / 2 + ((iz + 0.5) * depth) / spotsZ;
        return (
          <group key={`spot${i}`} position={[x, height - 0.2, z]} rotation={[Math.PI / 2 - 0.22, 0, 0]}>
            {/* yoke + housing */}
            <mesh castShadow material={m.metal}>
              <cylinderGeometry args={[0.085, 0.115, 0.24, 14]} />
            </mesh>
            {/* barn doors */}
            <mesh position={[0, -0.13, 0.05]} material={m.dark}>
              <boxGeometry args={[0.26, 0.02, 0.12]} />
            </mesh>
            {/* hot lens */}
            <mesh position={[0, -0.125, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.085, 18]} />
              <meshBasicMaterial color={glow} toneMapped={false} />
            </mesh>
            {/* glow halo */}
            <mesh position={[0, -0.122, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.17, 18]} />
              <meshBasicMaterial color={glow} transparent opacity={0.14} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
});

/**
 * Backlit feature wall with recessed glowing channels — the warm wood-panel
 * walls with LED line inlays seen on flagship news and talk sets.
 */
export const GlowLineWall = memo(function GlowLineWall({
  position = Place.position,
  rotation = Place.rotation,
  scale = Place.scale,
  width = 8,
  height = 3.6,
  color = '#f97316',
  pattern = 4,
  wood = true,
}: PlaceProps & { width?: number; height?: number; color?: string; pattern?: number; wood?: boolean }) {
  const m = useStudioMaterials();
  const glow = useMemo(() => new THREE.Color(color), [color]);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* panel slab */}
      <mesh receiveShadow material={wood ? m.walnut : m.dark}>
        <boxGeometry args={[width, height, 0.12]} />
      </mesh>
      {/* recessed glow channels — offset rectangles like architectural LED inlays */}
      {Array.from({ length: pattern }, (_, i) => {
        const cx = ((i + 0.5) / pattern - 0.5) * width * 0.86;
        const w = (width / pattern) * 0.56;
        const h = height * (0.5 + (i % 3) * 0.14);
        const y = ((i % 2 === 0 ? 1 : -1) * height) * 0.06;
        return (
          <group key={i} position={[cx, y, 0.075]}>
            {[[-w / 2, 0], [w / 2, 0]].map(([x], j) => (
              <mesh key={`v${j}`} position={[x, 0, 0]}>
                <boxGeometry args={[0.045, h, 0.02]} />
                <meshBasicMaterial color={glow} toneMapped={false} />
              </mesh>
            ))}
            {[[-h / 2], [h / 2]].map(([yy], j) => (
              <mesh key={`h${j}`} position={[0, yy, 0]}>
                <boxGeometry args={[w + 0.045, 0.045, 0.02]} />
                <meshBasicMaterial color={glow} toneMapped={false} />
              </mesh>
            ))}
            {/* soft halo on the wood */}
            <mesh position={[0, 0, -0.02]}>
              <planeGeometry args={[w * 1.25, h * 1.12]} />
              <meshBasicMaterial color={glow} transparent opacity={0.09} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
});
