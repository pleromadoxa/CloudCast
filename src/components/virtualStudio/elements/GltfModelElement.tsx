import { Suspense, memo, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

interface GltfModelProps {
  url: string;
  /** Target height in metres — the model is normalized and grounded at y = 0. */
  height: number;
  rotationY?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
}

/**
 * Loads a CC0 Poly Haven glTF, normalizes it to a physical height, grounds it
 * on the floor and enables studio shadow casting on every mesh.
 */
function LoadedModel({ url, height, rotationY = 0 }: { url: string; height: number; rotationY?: number }) {
  const { scene } = useGLTF(url);
  const prepared = useMemo(() => {
    const root = scene.clone(true);
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        // crisp texel response at grazing angles (floors, tabletops)
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          for (const value of Object.values(mat ?? {})) {
            const tex = value as THREE.Texture;
            if (tex && tex.isTexture) tex.anisotropy = 8;
          }
        }
      }
    });
    // normalize: fit to target height, sit the bounding box on the floor
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const s = height / (size.y || 1);
    const wrap = new THREE.Group();
    wrap.scale.setScalar(s);
    wrap.position.y = -box.min.y * s;
    wrap.add(root);
    return wrap;
  }, [scene, height]);
  return (
    <group rotation={[0, rotationY, 0]}>
      <primitive object={prepared} />
    </group>
  );
}

export const GltfModelElement = memo(function GltfModelElement({
  url,
  height,
  rotationY,
  position,
  rotation,
  scale,
}: GltfModelProps) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <Suspense fallback={null}>
        <LoadedModel url={url} height={height} rotationY={rotationY} />
      </Suspense>
    </group>
  );
});
