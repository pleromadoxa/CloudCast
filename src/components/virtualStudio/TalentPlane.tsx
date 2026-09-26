import { memo, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Keyed (chroma) or raw talent composited into the virtual set — the Aximetry
 * "front plate". The plane is unlit so the studio lighting never double-hits
 * the live image, and an optional mirrored floor reflection grounds the talent.
 */
export interface TalentPlaneProps {
  keyedCanvas: HTMLCanvasElement | null;
  rawVideo: HTMLVideoElement | null;
  keyerEnabled?: boolean;
  position?: [number, number, number];
  width?: number;
  yaw?: number;
  /** Tilt the plate forward/back (radians) — any-angle placement. */
  pitch?: number;
  /** Roll the plate (radians) for dutch-angle compositions. */
  roll?: number;
  /** Mirror the talent onto the polished studio floor. */
  reflection?: boolean;
}

export const TalentPlane = memo(function TalentPlane({
  keyedCanvas,
  rawVideo,
  keyerEnabled = true,
  position = [0, 0.95, 0.55],
  width = 2.4,
  yaw = 0,
  pitch = 0,
  roll = 0,
  reflection = true,
}: TalentPlaneProps) {
  const useKeyed = keyerEnabled && keyedCanvas;
  const source = useKeyed ? keyedCanvas : rawVideo;

  const texture = useMemo(() => {
    if (!source) return null;
    const tex = useKeyed
      ? new THREE.CanvasTexture(source as HTMLCanvasElement)
      : new THREE.VideoTexture(source as HTMLVideoElement);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    if (tex instanceof THREE.VideoTexture) tex.generateMipmaps = false;
    // The camera feed arrives mirrored (left/right reversed — held-up text reads
    // backwards). Un-mirror it on the plate so the broadcast output reads the
    // right way round. Only the talent plate is flipped; set graphics are not.
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.x = -1;
    tex.offset.x = 1;
    return tex;
  }, [source, useKeyed]);

  useEffect(() => () => texture?.dispose(), [texture]);

  useFrame(() => {
    if (texture) texture.needsUpdate = true;
  });

  if (!texture) return null;

  const height = width * (9 / 16);

  return (
    <group position={position} rotation={[pitch, yaw, roll]}>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={texture} transparent alphaTest={0.02} side={THREE.DoubleSide} />
      </mesh>
      {reflection && (
        <mesh position={[0, -position[1] + 0.014, height * 0.28]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[width, height * 0.75]} />
          <meshBasicMaterial
            map={texture}
            transparent
            opacity={0.16}
            alphaTest={0.02}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
});
