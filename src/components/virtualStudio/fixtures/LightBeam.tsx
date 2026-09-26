import { memo, useMemo } from 'react';
import * as THREE from 'three';

/**
 * Volumetric light beam — a soft additive cone that reads as light shafts in
 * studio haze. Bright at the fixture end, dissolving into the air, exactly the
 * cue that separates a rendered set from a real lit stage.
 */

let beamTexture: THREE.CanvasTexture | null = null;
/** Bright at the cone apex (geometry top), dissolving toward the wide end. */
function getBeamTexture(): THREE.CanvasTexture {
  if (beamTexture) return beamTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.42)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 128);
  beamTexture = new THREE.CanvasTexture(canvas);
  beamTexture.colorSpace = THREE.SRGBColorSpace;
  return beamTexture;
}

export interface LightBeamProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  /** Beam length in metres. */
  height?: number;
  /** Radius at the wide end. */
  radius?: number;
  color?: string;
  opacity?: number;
  /**
   * Beam direction: 'down' has the narrow (bright) end at the top,
   * 'up' flips it. Use rotation for sideways beams.
   */
  direction?: 'down' | 'up';
}

export const LightBeam = memo(function LightBeam({
  position,
  rotation,
  height = 3,
  radius = 1,
  color = '#fff7ed',
  opacity = 0.13,
  direction = 'down',
}: LightBeamProps) {
  const map = useMemo(() => getBeamTexture(), []);
  // 'up' flips the cone so the narrow bright end sits at the floor fixture.
  const rot: [number, number, number] = direction === 'up'
    ? [Math.PI + (rotation?.[0] ?? 0), rotation?.[1] ?? 0, rotation?.[2] ?? 0]
    : (rotation ?? [0, 0, 0]);
  return (
    <mesh position={position} rotation={rot} renderOrder={3}>
      {/* open cone: apex at the fixture, flare at the far end */}
      <coneGeometry args={[radius, height, 28, 1, true]} />
      <meshBasicMaterial
        map={map}
        color={color}
        transparent
        opacity={opacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
        fog={false}
      />
    </mesh>
  );
});
