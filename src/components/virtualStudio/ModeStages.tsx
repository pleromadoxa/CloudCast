import { memo, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Production mode primitives shared by the photoreal stage:
 *
 * • {@link ArLivePlate}    — a screen-locked live camera "back plate" that fills
 *   the frame behind augmented 3D graphics (Aximetry-style AR back plate).
 * • {@link XrSetExtension} — peripheral LED wall bleed that extends the set to
 *   the edge of an XR volume, so a wide lens never sees past the stage.
 */

function useLiveTexture(source: HTMLVideoElement | HTMLCanvasElement | null) {
  const texture = useMemo(() => {
    if (!source) return null;
    const isVideo = source instanceof HTMLVideoElement;
    const tex = isVideo
      ? new THREE.VideoTexture(source)
      : new THREE.CanvasTexture(source as HTMLCanvasElement);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    if (tex instanceof THREE.VideoTexture) tex.generateMipmaps = false;
    return tex;
  }, [source]);

  useEffect(() => () => texture?.dispose(), [texture]);

  useFrame(() => {
    // live video/canvas textures must be re-uploaded to the GPU every frame
    // eslint-disable-next-line react-hooks/immutability
    if (texture) texture.needsUpdate = true;
  });

  return texture;
}

/**
 * A camera-facing plate locked to the viewport: it copies the camera's
 * orientation, sits a fixed distance down the view axis, and is sized each
 * frame to exactly cover the current field-of-view. The result is a live feed
 * that reads as the real world behind whatever 3D graphics are composited on
 * top — independent of where the operator orbits the camera.
 */
export const ArLivePlate = memo(function ArLivePlate({
  video,
  distance = 40,
}: {
  video: HTMLVideoElement | null;
  /** Plate depth down the view axis — far enough to sit behind every graphic. */
  distance?: number;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const texture = useLiveTexture(video);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    // same orientation as the camera, pushed straight down its view axis
    m.quaternion.copy(camera.quaternion);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    m.position.copy(camera.position).addScaledVector(fwd, distance);
    // scale to cover the frame at this depth for the live fov/aspect
    const cam = camera as THREE.PerspectiveCamera;
    const h = 2 * distance * Math.tan((cam.fov * Math.PI) / 360);
    const w = h * (cam.aspect || 16 / 9);
    m.scale.set(w, h, 1);
  });

  if (!texture) return null;

  return (
    /* Draws first and never writes/tests depth, so every augmented graphic
       composited afterwards lands on top of the feed. */
    <mesh ref={mesh} renderOrder={-1000}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        toneMapped={false}
        depthTest={false}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
});

/**
 * LED set-extension: angled peripheral walls + a curved header that bleed the
 * scene's accent light to the edge of frame. Mounts around the selected scene
 * so a wide XR lens never reveals a gap past the stage.
 */
export const XrSetExtension = memo(function XrSetExtension({
  accent = '#6366f1',
  radius = 11,
  height = 6.5,
}: {
  accent?: string;
  radius?: number;
  height?: number;
}) {
  const panels: { pos: [number, number, number]; rotY: number }[] = useMemo(
    () => [
      { pos: [-radius * 0.78, height / 2, -radius * 0.5], rotY: 0.62 },
      { pos: [radius * 0.78, height / 2, -radius * 0.5], rotY: -0.62 },
      { pos: [-radius * 0.98, height / 2, radius * 0.1], rotY: 1.25 },
      { pos: [radius * 0.98, height / 2, radius * 0.1], rotY: -1.25 },
    ],
    [radius, height],
  );

  return (
    <group>
      {panels.map((p, i) => (
        <group key={i} position={p.pos} rotation={[0, p.rotY, 0]}>
          {/* panel body */}
          <mesh receiveShadow>
            <planeGeometry args={[radius * 0.7, height]} />
            <meshStandardMaterial
              color={accent}
              emissive={accent}
              emissiveIntensity={0.32}
              metalness={0.2}
              roughness={0.45}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* bright bezel seam — sells the individual LED cabinet edges */}
          <mesh position={[0, 0, 0.02]}>
            <planeGeometry args={[radius * 0.7, 0.06]} />
            <meshStandardMaterial
              color="#0b0b12"
              emissive={accent}
              emissiveIntensity={1.4}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
      {/* overhead header glow bar tying the volume together */}
      <mesh position={[0, height + 0.15, -radius * 0.42]}>
        <boxGeometry args={[radius * 1.35, 0.1, 0.1]} />
        <meshStandardMaterial
          color="#0b0b12"
          emissive={accent}
          emissiveIntensity={1.1}
          toneMapped={false}
        />
      </mesh>
      {/* floor spill so the extension grounds into the set */}
      <mesh position={[0, 0.02, -radius * 0.35]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[radius * 1.6, radius * 0.5]} />
        <meshStandardMaterial color="#05050a" roughness={0.7} metalness={0.2} />
      </mesh>
    </group>
  );
});
