import { memo, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Volumetric light beam — a soft additive shaft that reads as light scattering
 * through studio haze. Bright at the fixture end, dissolving into the air,
 * with drifting noise so the shaft feels alive on camera rather than frozen.
 *
 * Built as two nested cones: a wide, faint outer scatter and a bright core
 * right under the fixture — the way a real beam's intensity falls off both with
 * distance from the fixture and with distance from its axis.
 */

let beamTextures: { gradient: THREE.CanvasTexture; noise: THREE.CanvasTexture } | null = null;

/** Bright at the cone apex (geometry top), dissolving toward the wide end. */
function getBeamTextures(): { gradient: THREE.CanvasTexture; noise: THREE.CanvasTexture } {
  if (beamTextures) return beamTextures;

  const gradientCanvas = document.createElement('canvas');
  gradientCanvas.width = 4;
  gradientCanvas.height = 128;
  const gctx = gradientCanvas.getContext('2d')!;
  const grad = gctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.42)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  gctx.fillStyle = grad;
  gctx.fillRect(0, 0, 4, 128);
  const gradient = new THREE.CanvasTexture(gradientCanvas);
  gradient.colorSpace = THREE.SRGBColorSpace;

  // Tileable value noise — the density variation that makes haze visible.
  const noiseCanvas = document.createElement('canvas');
  noiseCanvas.width = 64;
  noiseCanvas.height = 64;
  const nctx = noiseCanvas.getContext('2d')!;
  const image = nctx.createImageData(64, 64);
  let seed = 20260927;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < image.data.length; i += 4) {
    const v = Math.round(140 + rnd() * 115);
    image.data[i] = v;
    image.data[i + 1] = v;
    image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  nctx.putImageData(image, 0, 0);
  const noise = new THREE.CanvasTexture(noiseCanvas);
  noise.wrapS = THREE.RepeatWrapping;
  noise.wrapT = THREE.RepeatWrapping;
  noise.colorSpace = THREE.SRGBColorSpace;

  beamTextures = { gradient, noise };
  return beamTextures;
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
  /** Cone tessellation — the fidelity tier's `beamSegments`. */
  segments?: number;
  /** Drift the noise through the shaft (off on the cheapest tiers). */
  animated?: boolean;
}

export const LightBeam = memo(function LightBeam({
  position,
  rotation,
  height = 3,
  radius = 1,
  color = '#fff7ed',
  opacity = 0.13,
  direction = 'down',
  segments = 28,
  animated = true,
}: LightBeamProps) {
  const { gradient, noise } = useMemo(() => getBeamTextures(), []);
  const outerRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);

  // Drift the noise field through both cones so the haze shimmers gently.
  useFrame((state) => {
    if (!animated) return;
    const t = state.clock.elapsedTime * 0.045;
    // Textures are shared module state mutated by design — RepeatWrapping +
    // offset drives the drift without re-uploading pixels.
    noise.offset.y = -t;
    noise.offset.x = t * 0.35;
    if (outerRef.current) {
      outerRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.11) * 0.05;
    }
    if (innerRef.current) {
      innerRef.current.rotation.y = -Math.sin(state.clock.elapsedTime * 0.11) * 0.05;
    }
  });

  // 'up' flips the cone so the narrow bright end sits at the floor fixture.
  const rot: [number, number, number] = direction === 'up'
    ? [Math.PI + (rotation?.[0] ?? 0), rotation?.[1] ?? 0, rotation?.[2] ?? 0]
    : (rotation ?? [0, 0, 0]);
  return (
    <group position={position} rotation={rot}>
      {/* outer scatter: the wide, faint body of the shaft */}
      <mesh ref={outerRef} renderOrder={3}>
        <coneGeometry args={[radius, height, segments, 1, true]} />
        <meshBasicMaterial
          map={gradient}
          alphaMap={noise}
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
      {/* inner core: the hot cone right under the fixture */}
      <mesh ref={innerRef} renderOrder={4}>
        <coneGeometry args={[radius * 0.42, height * 0.92, segments, 1, true]} />
        <meshBasicMaterial
          map={gradient}
          alphaMap={noise}
          color={color}
          transparent
          opacity={opacity * 1.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
          fog={false}
        />
      </mesh>
    </group>
  );
});
