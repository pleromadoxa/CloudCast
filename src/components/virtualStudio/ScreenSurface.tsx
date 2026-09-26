import { memo, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { StudioFit, StudioScreenForm, StudioScreenSource } from '../../lib/virtualStudio/types';
import { useStudioTexture } from './useStudioTexture';

/**
 * The physical emissive panel every studio screen is built from: binds a
 * source to a plane, keeps it fresh each frame, and optionally overlays the
 * pixel grid that makes LED walls read as real panels.
 */

export interface ScreenSurfaceProps {
  source: StudioScreenSource | undefined;
  width: number;
  height: number;
  fit?: StudioFit;
  /** Draw the LED pixel grid (video walls / ribbons). */
  ledGrid?: boolean;
  /** Grid cell size in world units — defaults to a 4mm-ish pitch at set scale. */
  ledPitch?: number;
  /** Emissive lift so screens read as light sources after tone mapping. */
  brightness?: number;
  /** Faint specular glass layer over the panel. */
  glass?: boolean;
  /** Shown when nothing is bound — a neutral powered-off panel. */
  offColor?: string;
  /** Horizontal scroll in texture-units/second (ribbon tickers). */
  scroll?: number;
  /** Physical screen form — sizes procedural graphics correctly. */
  form?: StudioScreenForm;
}

function makeGridTexture(pitchPx: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = Math.max(1, Math.round(pitchPx * 0.18));
  for (let i = 0; i <= size; i += pitchPx) {
    ctx.beginPath();
    ctx.moveTo(i + 0.5, 0);
    ctx.lineTo(i + 0.5, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i + 0.5);
    ctx.lineTo(size, i + 0.5);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 14);
  return tex;
}

export const ScreenSurface = memo(function ScreenSurface({
  source,
  width,
  height,
  fit = 'cover',
  ledGrid = false,
  ledPitch = 16,
  brightness = 1,
  glass = true,
  offColor = '#07070b',
  scroll = 0,
  form = 'monitor',
}: ScreenSurfaceProps) {
  const { texture } = useStudioTexture(source, fit, form, height > 0 ? width / height : undefined);

  useFrame((_, delta) => {
    if (!texture || !scroll) return;
    texture.wrapS = THREE.RepeatWrapping;
    texture.offset.x = (texture.offset.x - delta * scroll) % 1;
  });

  const gridTexture = useMemo(
    () => (ledGrid ? makeGridTexture(ledPitch) : null),
    [ledGrid, ledPitch],
  );
  useEffect(() => () => gridTexture?.dispose(), [gridTexture]);

  const powered = Boolean(texture);

  return (
    <group>
      <mesh>
        <planeGeometry args={[width, height]} />
        {powered && texture ? (
          <meshBasicMaterial
            map={texture}
            toneMapped={false}
            color={new THREE.Color(brightness, brightness, brightness)}
          />
        ) : (
          <meshStandardMaterial
            color={offColor}
            metalness={0.35}
            roughness={0.22}
            envMapIntensity={1.1}
          />
        )}
      </mesh>

      {ledGrid && gridTexture && (
        <mesh position={[0, 0, 0.002]}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial
            color="#000000"
            transparent
            opacity={0.55}
            alphaMap={gridTexture}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}

      {glass && (
        <mesh position={[0, 0, 0.004]}>
          <planeGeometry args={[width, height]} />
          <meshPhysicalMaterial
            color="#ffffff"
            transparent
            opacity={0.05}
            roughness={0.08}
            metalness={0}
            clearcoat={1}
            clearcoatRoughness={0.06}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}
    </group>
  );
});
