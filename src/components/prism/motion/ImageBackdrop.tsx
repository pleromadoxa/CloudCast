import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

/**
 * Operator-supplied background image (data URL / URL) — cover-fitted onto a
 * full-frame plate behind the 3D scene, replacing the void backdrop when a
 * template override provides one.
 */
export function ImageBackdrop({
  url,
  position = [0, 0, -16],
  width = 52,
  height = 30,
  dim = 1,
}: {
  url: string;
  position?: [number, number, number];
  width?: number;
  height?: number;
  dim?: number;
}) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  const texture = useMemo(() => {
    const tex = new THREE.TextureLoader().load(url, (loaded) => {
      loaded.colorSpace = THREE.SRGBColorSpace;
      loaded.wrapS = THREE.ClampToEdgeWrapping;
      loaded.wrapT = THREE.ClampToEdgeWrapping;
      // Cover-fit: crop whichever axis overflows the plate aspect.
      const img = loaded.image as { width?: number; height?: number } | undefined;
      const iw = img?.width ?? 0;
      const ih = img?.height ?? 0;
      if (iw > 0 && ih > 0) {
        const target = width / height;
        const aspect = iw / ih;
        if (aspect > target) {
          const rx = target / aspect;
          loaded.repeat.set(rx, 1);
          loaded.offset.set((1 - rx) / 2, 0);
        } else {
          const ry = aspect / target;
          loaded.repeat.set(1, ry);
          loaded.offset.set(0, (1 - ry) / 2);
        }
      }
      loaded.needsUpdate = true;
    });
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [url, width, height]);

  useEffect(() => () => texture.dispose(), [texture]);

  useEffect(() => {
    if (matRef.current) matRef.current.color.setScalar(dim);
  }, [dim]);

  return (
    <mesh position={position} renderOrder={-10}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        ref={matRef}
        map={texture}
        transparent={false}
        depthWrite={false}
        toneMapped={false}
        fog={false}
      />
    </mesh>
  );
}
