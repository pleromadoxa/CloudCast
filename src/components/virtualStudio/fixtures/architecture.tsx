import { memo, useMemo } from 'react';
import * as THREE from 'three';
import { pbrFromTexture, pbrSolid } from '../../../lib/prism/pbrMaterials';
import { PbrSurface } from './PbrSurface';
import type { StudioFit, StudioScreenSource } from '../../../lib/virtualStudio/types';
import { ScreenSurface } from '../ScreenSurface';

/**
 * Architecture for virtual sets: room shells, infinity cycloramas, and the
 * full-height replaceable backdrop that lets an operator swap the entire
 * environment for an image or a live feed.
 */

type PlaceProps = {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
};

/**
 * The "replace the whole world" panel — a large screen sitting at the back of
 * the set that accepts an image URL, live video, canvas or broadcast graphic.
 */
export const BackdropPlane = memo(function BackdropPlane({
  source,
  position,
  rotation,
  scale = 1,
  width = 18,
  height = 9,
  brightness = 0.92,
  fit = 'cover',
}: PlaceProps & {
  source?: StudioScreenSource;
  width?: number;
  height?: number;
  brightness?: number;
  fit?: StudioFit;
}) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh>
        <planeGeometry args={[width, height]} />
        <PbrSurface color="#0b0d12" roughness={0.9} />
      </mesh>
      <group position={[0, 0, 0.01]}>
        <ScreenSurface
          source={source}
          width={width}
          height={height}
          brightness={brightness}
          fit={fit}
          glass={false}
          form="window"
        />
      </group>
    </group>
  );
});

export interface RoomShellProps extends PlaceProps {
  width?: number;
  depth?: number;
  height?: number;
  wallColor?: string;
  wallTexture?: 'wall_paint' | 'wall_brick' | 'concrete';
  floorTexture?: 'wood_oak' | 'wood_walnut' | 'carpet' | 'tile' | 'marble' | 'concrete';
  floorColor?: string;
  floorReflective?: boolean;
  accent?: string;
  /** Recessed ceiling light panels to switch on. */
  ceilingLights?: number;
  /** Leave the back wall open for a backdrop plane. */
  openBack?: boolean;
}

/** Boxed room: floor, ceiling, walls, recessed light panels. */
export const RoomShell = memo(function RoomShell({
  position,
  rotation,
  scale = 1,
  width = 16,
  depth = 12,
  height = 5,
  wallColor = '#111318',
  wallTexture = 'wall_paint',
  floorTexture = 'wood_walnut',
  floorColor = '#1a1512',
  accent = '#38bdf8',
  ceilingLights = 4,
  openBack = true,
}: RoomShellProps) {
  const materials = useMemo(() => {
    const wall = pbrFromTexture(wallTexture, 11, { roughness: 0.85 });
    wall.color = new THREE.Color(wallColor);
    return {
      wall,
      floor: pbrFromTexture(floorTexture, 12, {
        roughness:
          floorTexture === 'carpet' ? 0.92 : floorTexture === 'marble' ? 0.12 : 0.16,
        metalness: floorTexture === 'carpet' ? 0 : 0.1,
        envMapIntensity: floorTexture === 'carpet' ? 0.5 : 1.75,
      }),
      ceiling: pbrSolid('#0c0e13', { roughness: 0.95 }),
      trim: pbrSolid('#1c1f26', { metalness: 0.5, roughness: 0.4 }),
    };
  }, [wallTexture, wallColor, floorTexture]);

  const lights = useMemo(
    () =>
      Array.from({ length: ceilingLights }, (_, i) => {
        const cols = Math.ceil(Math.sqrt(ceilingLights));
        const col = i % cols;
        const row = Math.floor(i / cols);
        return {
          x: ((col + 0.5) / cols - 0.5) * (width * 0.8),
          z: ((row + 0.5) / cols - 0.5) * (depth * 0.7),
        };
      }),
    [ceilingLights, width, depth],
  );

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* floor — double-sided so low hero-angle cameras keep the ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <PbrSurface
          map={materials.floor.map}
          color={floorColor}
          roughness={materials.floor.roughness}
          metalness={materials.floor.metalness}
          envMapIntensity={1.8}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* ceiling */}
      <mesh position={[0, height, 0]} rotation={[Math.PI / 2, 0, 0]} material={materials.ceiling}>
        <planeGeometry args={[width, depth]} />
      </mesh>
      {/* side walls */}
      <mesh position={[-width / 2, height / 2, 0]} rotation={[0, Math.PI / 2, 0]} material={materials.wall} receiveShadow>
        <planeGeometry args={[depth, height]} />
      </mesh>
      <mesh position={[width / 2, height / 2, 0]} rotation={[0, -Math.PI / 2, 0]} material={materials.wall} receiveShadow>
        <planeGeometry args={[depth, height]} />
      </mesh>
      {/* front wall (behind camera) */}
      <mesh position={[0, height / 2, depth / 2]} rotation={[Math.PI, 0, 0]} material={materials.wall} receiveShadow>
        <planeGeometry args={[width, height]} />
      </mesh>
      {/* back wall header so the backdrop reads as set into the room */}
      {!openBack && (
        <mesh position={[0, height / 2, -depth / 2]} material={materials.wall} receiveShadow>
          <planeGeometry args={[width, height]} />
        </mesh>
      )}
      {openBack && (
        <mesh position={[0, height - 0.5, -depth / 2]} material={materials.wall}>
          <planeGeometry args={[width, 1]} />
        </mesh>
      )}
      {/* skirting — full perimeter */}
      {[-1, 1].map((side) => (
        <mesh key={`s${side}`} position={[(side * width) / 2 - side * 0.03, 0.06, 0]} rotation={[0, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0]} material={materials.trim}>
          <planeGeometry args={[depth, 0.12]} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={`b${side}`} position={[0, 0.06, (side * depth) / 2 - side * 0.03]} rotation={[0, side > 0 ? Math.PI : 0, 0]} material={materials.trim}>
          <planeGeometry args={[width, 0.12]} />
        </mesh>
      ))}
      {/* crown molding at the wall/ceiling junction */}
      {[-1, 1].map((side) => (
        <mesh key={`c${side}`} position={[(side * width) / 2 - side * 0.05, height - 0.06, 0]} rotation={[0, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0]} material={materials.trim}>
          <planeGeometry args={[depth, 0.16]} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={`cb${side}`} position={[0, height - 0.06, (side * depth) / 2 - side * 0.05]} rotation={[0, side > 0 ? Math.PI : 0, 0]} material={materials.trim}>
          <planeGeometry args={[width, 0.16]} />
        </mesh>
      ))}
      {/* recessed ceiling panels with glossy floor reflections */}
      {lights.map((light, i) => (
        <group key={i} position={[light.x, height - 0.02, light.z]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.6, 0.7]} />
            <PbrSurface color="#f8fafc" emissive="#eef4ff" emissiveIntensity={2.2} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]} material={materials.trim}>
            <planeGeometry args={[1.8, 0.9]} />
          </mesh>
          <pointLight position={[0, -0.4, 0]} intensity={5} distance={9} decay={2} color={i % 2 === 0 ? '#f5f7ff' : accent} />
          {/* stretched light pool on the polished floor */}
          <mesh position={[0, -height + 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
            <planeGeometry args={[1.5, 3.2]} />
            <meshBasicMaterial
              color={i % 2 === 0 ? '#e8eeff' : accent}
              transparent
              opacity={0.1}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
});

/** White infinity cyclorama — the blank canvas studio. */
export const CycloramaShell = memo(function CycloramaShell({
  position,
  scale = 1,
  width = 16,
  depth = 14,
  height = 6,
  radius = 2.5,
}: PlaceProps & { width?: number; depth?: number; height?: number; radius?: number }) {
  const mat = useMemo(() => pbrSolid('#eef1f5', { roughness: 0.72, envMapIntensity: 1.1 }), []);
  const curve = useMemo(() => {
    const shape = new THREE.Shape();
    // cross-section: floor -> quarter-round -> wall
    shape.moveTo(0, 0);
    shape.lineTo(depth - radius, 0);
    shape.quadraticCurveTo(depth, 0, depth, radius);
    shape.lineTo(depth, height);
    shape.lineTo(depth - 0.35, height);
    shape.lineTo(depth - 0.35, radius);
    shape.quadraticCurveTo(depth - 0.35, 0.35, depth - radius - 0.35, 0.35);
    shape.lineTo(0, 0.35);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: width,
      bevelEnabled: false,
      curveSegments: 24,
    });
    geometry.rotateY(-Math.PI / 2);
    geometry.center();
    return geometry;
  }, [width, depth, height, radius]);

  return (
    <group position={position} scale={scale}>
      <mesh geometry={curve} material={mat} receiveShadow castShadow />
      {/* side walls to close the horizon */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * width) / 2, height / 2, 0]} rotation={[0, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0]} material={mat}>
          <planeGeometry args={[depth, height]} />
        </mesh>
      ))}
    </group>
  );
});

/** Window with mullions — sits in front of a replaceable view/backdrop. */
export const WindowFrame = memo(function WindowFrame({
  position,
  rotation,
  scale = 1,
  width = 4.2,
  height = 2.6,
  cols = 3,
  rows = 2,
}: PlaceProps & { width?: number; height?: number; cols?: number; rows?: number }) {
  const frame = useMemo(() => pbrSolid('#1f2937', { metalness: 0.7, roughness: 0.3 }), []);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* frame bars around the opening (never occludes the view) */}
      <mesh position={[0, height / 2 + 0.05, 0]} material={frame} castShadow>
        <boxGeometry args={[width + 0.2, 0.1, 0.12]} />
      </mesh>
      <mesh position={[0, -height / 2 - 0.05, 0]} material={frame} castShadow>
        <boxGeometry args={[width + 0.2, 0.1, 0.12]} />
      </mesh>
      <mesh position={[-width / 2 - 0.05, 0, 0]} material={frame} castShadow>
        <boxGeometry args={[0.1, height + 0.2, 0.12]} />
      </mesh>
      <mesh position={[width / 2 + 0.05, 0, 0]} material={frame} castShadow>
        <boxGeometry args={[0.1, height + 0.2, 0.12]} />
      </mesh>
      <group position={[0, 0, 0.05]}>
        {Array.from({ length: cols - 1 }, (_, i) => {
          const x = -width / 2 + ((i + 1) * width) / cols;
          return (
            <mesh key={`c${i}`} position={[x, 0, 0.02]} material={frame}>
              <boxGeometry args={[0.06, height, 0.06]} />
            </mesh>
          );
        })}
        {Array.from({ length: rows - 1 }, (_, i) => {
          const y = -height / 2 + ((i + 1) * height) / rows;
          return (
            <mesh key={`r${i}`} position={[0, y, 0.02]} material={frame}>
              <boxGeometry args={[width, 0.06, 0.06]} />
            </mesh>
          );
        })}
        <mesh position={[0, 0, 0.01]}>
          <planeGeometry args={[width, height]} />
          <PbrSurface physical
            color="#cfe8ff"
            transparent
            opacity={0.07}
            roughness={0.03}
            metalness={0}
            clearcoat={1}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
});

/** Backlit slat wall used behind talk-show and news sets. */
export const AccentWall = memo(function AccentWall({
  position,
  rotation,
  scale = 1,
  width = 10,
  height = 4,
  accent = '#8b5cf6',
  slats = 14,
}: PlaceProps & { width?: number; height?: number; accent?: string; slats?: number }) {
  const back = useMemo(() => pbrSolid('#0a0b10', { roughness: 0.85 }), []);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh material={back} receiveShadow>
        <planeGeometry args={[width, height]} />
      </mesh>
      {Array.from({ length: slats }, (_, i) => {
        const x = -width / 2 + ((i + 0.5) * width) / slats;
        const glow = i % 3 === 0;
        return (
          <mesh key={i} position={[x, 0, 0.06]}>
            <boxGeometry args={[width / slats - 0.12, height * 0.94, 0.05]} />
            <PbrSurface
              color={glow ? accent : '#161a24'}
              emissive={glow ? accent : '#000000'}
              emissiveIntensity={glow ? 1.5 : 0}
              roughness={0.6}
              metalness={0.2}
              toneMapped={false}
            />
          </mesh>
        );
      })}
      <pointLight position={[0, 0, 1.4]} intensity={6} distance={9} decay={2} color={accent} />
    </group>
  );
});
