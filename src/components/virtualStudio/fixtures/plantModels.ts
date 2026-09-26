import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Photoreal plant models (Poly Haven CC0 scans under `public/models/`).
 *
 * The set fixtures use real scanned geometry instead of procedural foliage —
 * that's what makes plants read as photographic. Loads are cached and shared;
 * every instance clones the object hierarchy while reusing GPU geometry and
 * materials. Loading never suspends and never throws: a failed fetch degrades
 * to the procedural fallback plant so a missing asset can never take down a
 * scene behind the stage error boundary.
 */

export interface PlantSpecies {
  /** Poly Haven folder under `public/models/`. */
  folder: string;
  /** Natural scan height in metres (before normalization). */
  naturalHeight: number;
  /** The scan includes its own pot (potted_plant_* series). */
  hasPot: boolean;
  /** Ceramic pot palette rotation for the foliage-only species. */
  potStyle?: 'terracotta' | 'charcoal' | 'cream' | 'sage';
}

export const PLANT_SPECIES: Record<string, PlantSpecies> = {
  broadleaf: { folder: 'potted_plant_01', naturalHeight: 1.05, hasPot: true },
  compact: { folder: 'potted_plant_02', naturalHeight: 0.9, hasPot: true },
  tall: { folder: 'potted_plant_04', naturalHeight: 1.0, hasPot: true },
  fern: { folder: 'fern_02', naturalHeight: 0.75, hasPot: false, potStyle: 'terracotta' },
  calathea: { folder: 'calathea_orbifolia_01', naturalHeight: 0.8, hasPot: false, potStyle: 'cream' },
  anthurium: { folder: 'anthurium_botany_01', naturalHeight: 0.55, hasPot: false, potStyle: 'charcoal' },
  pachira: { folder: 'pachira_aquatica_01', naturalHeight: 1.6, hasPot: false, potStyle: 'sage' },
};

const SPECIES_NAMES = Object.keys(PLANT_SPECIES);

export function plantModelUrl(species: PlantSpecies): string {
  return `/models/${species.folder}/${species.folder}_1k.gltf`;
}

/** Deterministic seed from a placement so repeated plants vary naturally. */
export function plantSeed(x: number, y: number, z: number): number {
  return Math.abs(Math.round((x * 73.13 + y * 191.7 + z * 131.31) * 1000)) % 9973;
}

/**
 * Picks a species for a requested display height: candidates that fit within
 * 0.65x–1.8x of their natural size, broken deterministically by the seed so a
 * set gets real variety instead of one repeated plant.
 */
export function pickPlantSpecies(height: number, seed: number): PlantSpecies {
  const viable = SPECIES_NAMES.map((n) => PLANT_SPECIES[n])
    .filter((s) => {
      const ratio = height / s.naturalHeight;
      return ratio >= 0.65 && ratio <= 1.9;
    })
    .sort((a, b) => Math.abs(height / a.naturalHeight - 1) - Math.abs(height / b.naturalHeight - 1));
  // Prefer the closest-proportioned scans (never stretch a plant more than it
  // has to), with deterministic variety across the three best fits.
  const pool = viable.length > 0 ? viable.slice(0, 3) : [PLANT_SPECIES.broadleaf];
  return pool[seed % pool.length];
}

const loader = new GLTFLoader();
const modelCache = new Map<string, Promise<THREE.Group | null>>();

/** Cached, failure-tolerant glTF load — resolves `null` on any error. */
function loadPlantModel(url: string): Promise<THREE.Group | null> {
  let hit = modelCache.get(url);
  if (!hit) {
    hit = loader
      .loadAsync(url)
      .then((gltf) => gltf.scene)
      .catch(() => null);
    modelCache.set(url, hit);
  }
  return hit;
}

/** Shared resolved scene root (clone before use) or `null` while loading/failed. */
export function usePlantModel(url: string): THREE.Group | null {
  const [scene, setScene] = useState<THREE.Group | null>(null);
  useEffect(() => {
    let alive = true;
    void loadPlantModel(url).then((g) => {
      if (alive) setScene(g);
    });
    return () => {
      alive = false;
    };
  }, [url]);
  return scene;
}

/**
 * Clones a loaded scan, applies studio shadow flags and crisp texel filtering,
 * normalizes to the target height and grounds the bounding box at y = 0.
 */
export function preparePlantInstance(source: THREE.Group, height: number): THREE.Group {
  const root = source.clone(true);
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        for (const value of Object.values(mat ?? {})) {
          const tex = value as THREE.Texture;
          if (tex && tex.isTexture) tex.anisotropy = 8;
        }
        // Leaf cards must not look like glass — keep the baked PBR honest.
        if (mat && 'envMapIntensity' in mat && (mat as THREE.MeshStandardMaterial).envMapIntensity < 0.9) {
          (mat as THREE.MeshStandardMaterial).envMapIntensity = 1.05;
        }
      }
    }
  });
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const s = height / (size.y || 1);
  const wrap = new THREE.Group();
  wrap.scale.setScalar(s);
  wrap.position.y = -box.min.y * s;
  wrap.add(root);
  return wrap;
}
