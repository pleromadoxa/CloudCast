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
  const cloned = useMemo(() => scene.clone(true), [scene]);
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
