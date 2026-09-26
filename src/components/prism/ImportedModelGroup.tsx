import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

export interface ImportedModelEntry {
  id: string;
  name: string;
  url: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}

function GlbModel({ url, scale }: { url: string; scale: number }) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => {
    const root = scene.clone(true);
    // Scans ship 1k PBR maps: crank anisotropy so fabric/wood grain doesn't
    // shimmer at broadcast distance, and let the scans receive the light rig.
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const mat of mats) {
        const std = mat as THREE.MeshStandardMaterial;
        for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap'] as const) {
          const t = std[key];
          if (t) {
            t.anisotropy = 16;
            t.needsUpdate = true;
          }
        }
      }
    });
    return root;
  }, [scene]);
  return <primitive object={cloned} scale={scale} />;
}

export function ImportedModelGroup({ models }: { models: ImportedModelEntry[] }) {
  return (
    <>
      {models.map((m) => (
        <group key={m.id} position={m.position} rotation={m.rotation} scale={[m.scale, m.scale, m.scale]}>
          <GlbModel url={m.url} scale={1} />
        </group>
      ))}
    </>
  );
}

/** Preload a model URL for smoother first render. */
export function preloadGltf(url: string) {
  try {
    useGLTF.preload(url);
  } catch {
    /* ignore preload errors */
  }
}

export function disposeObjectUrl(url: string) {
  if (url.startsWith('blob:')) URL.revokeObjectURL(url);
}

export function validateGltfFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.glb') || name.endsWith('.gltf');
}

export function centerImportedModel(object: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  object.position.sub(center);
}
