/**
 * three.js → cinematic scene extraction.
 *
 * Lets the path tracer render *the application's actual scenes* (virtual
 * studios, motion sets) as photoreal stills: meshes are baked to world-space
 * triangle soups with their PBR factors, and the camera is inherited from the
 * live stage. Textures are not transferred (factors only) — this pass exists
 * for lighting/material-grade fidelity, not texture replication.
 */
import * as THREE from 'three';
import type {
  CinematicCamera,
  CinematicMaterial,
  CinematicMesh,
  CinematicScene,
} from './pathTracer/scene';

function materialFromThree(material: THREE.Material): CinematicMaterial {
  const fallback: CinematicMaterial = {
    baseColor: [0.6, 0.6, 0.6],
    metallic: 0,
    roughness: 0.7,
    emissive: [0, 0, 0],
  };
  if (!(material instanceof THREE.MeshStandardMaterial)) return fallback;
  const color = material.color;
  const emissive = material.emissive;
  // Multiply emissive intensity into the radiance term.
  const intensity = material.emissiveIntensity ?? 1;
  return {
    baseColor: [color.r, color.g, color.b],
    metallic: material.metalness ?? 0,
    roughness: Math.max(0.04, material.roughness ?? 0.8),
    emissive: [emissive.r * intensity, emissive.g * intensity, emissive.b * intensity],
  };
}

export interface ExtractOptions {
  /** Skip meshes smaller than this world-space bounding radius. */
  minBoundingRadius?: number;
  /** Cap total triangles so extraction stays interactive. */
  maxTriangles?: number;
}

/**
 * Walk a three.js scene graph and bake every visible mesh into a
 * `CinematicScene`. The returned camera matches `threeCamera`'s pose.
 */
export function extractCinematicScene(
  root: THREE.Object3D,
  threeCamera: THREE.Camera,
  options: ExtractOptions = {},
): CinematicScene {
  const minRadius = options.minBoundingRadius ?? 0.02;
  const maxTriangles = options.maxTriangles ?? 400_000;

  const meshes: CinematicMesh[] = [];
  let triangles = 0;
  const world = new THREE.Matrix4();
  const normalMatrix = new THREE.Matrix3();
  const v = new THREE.Vector3();

  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    if (triangles >= maxTriangles) return;
    if (!(obj instanceof THREE.Mesh)) return;
    if (!obj.visible) return;
    const geometry = obj.geometry as THREE.BufferGeometry | undefined;
    if (!geometry) return;
    const position = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!position || position.itemSize < 3) return;

    geometry.computeBoundingSphere();
    const radius = geometry.boundingSphere?.radius ?? 0;
    if (radius < minRadius) return;

    obj.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), new THREE.Vector3());
    world.copy(obj.matrixWorld);
    normalMatrix.getNormalMatrix(world);

    const count = position.count;
    const indices = geometry.getIndex();
    const triCount = indices ? indices.count / 3 : count / 3;
    if (triangles + triCount > maxTriangles) return;
    triangles += triCount;

    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      v.fromBufferAttribute(position as THREE.BufferAttribute, i).applyMatrix4(world);
      positions[i * 3] = v.x;
      positions[i * 3 + 1] = v.y;
      positions[i * 3 + 2] = v.z;
    }

    const normalAttr = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined;
    let normals: Float32Array | undefined;
    if (normalAttr && normalAttr.itemSize >= 3) {
      normals = new Float32Array(count * 3);
      for (let i = 0; i < count; i += 1) {
        v.fromBufferAttribute(normalAttr as THREE.BufferAttribute, i)
          .applyMatrix3(normalMatrix)
          .normalize();
        normals[i * 3] = v.x;
        normals[i * 3 + 1] = v.y;
        normals[i * 3 + 2] = v.z;
      }
    }

    let material = materialFromThree(new THREE.MeshStandardMaterial());
    const rawMaterial = obj.material;
    if (Array.isArray(rawMaterial)) {
      // Multi-material geometry — bake with the first slot's factors.
      if (rawMaterial[0]) material = materialFromThree(rawMaterial[0]);
    } else if (rawMaterial) {
      material = materialFromThree(rawMaterial as THREE.Material);
    }

    meshes.push({
      positions,
      normals,
      indices: indices ? new Uint32Array(indices.array as ArrayLike<number>) : undefined,
      material,
    });
  });

  return {
    meshes,
    camera: cameraFromThree(threeCamera),
  };
}

export function cameraFromThree(camera: THREE.Camera): CinematicCamera {
  const position = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const target = position.clone().add(direction);
  const fov = (camera as THREE.PerspectiveCamera).fov ?? 40;
  return {
    position: [position.x, position.y, position.z],
    target: [target.x, target.y, target.z],
    fovDeg: fov,
  };
}
