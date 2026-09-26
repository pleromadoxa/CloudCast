/**
 * Cinematic scene model for the path tracer.
 *
 * Deliberately small and three-free: triangles + PBR factors + an equirect
 * HDR environment + a pinhole camera. `flattenCinematicScene` packs everything
 * into the exact buffer layouts the WGSL kernel reads; `buildEnvironmentCdf`
 * builds the luminance CDFs for importance-sampled HDRI lighting; and
 * `buildCalibrationScene` is a procedural photoreal studio (metal/roughness
 * chart, emissive panels, gradient sky) so the cinematic renderer can be
 * exercised — and demoed from Settings — with zero assets.
 */
import { buildBvh } from './bvh';
import type { FlattenedBvh } from './bvh';

export interface CinematicMaterial {
  /** Linear RGB albedo. */
  baseColor: [number, number, number];
  metallic: number;
  roughness: number;
  /** Linear RGB radiance. */
  emissive: [number, number, number];
}

export interface CinematicMesh {
  /** 3 floats per vertex. */
  positions: Float32Array;
  /** 3 floats per vertex — optional; face normals otherwise. */
  normals?: Float32Array;
  /** Triangle list — optional (non-indexed otherwise). */
  indices?: Uint32Array;
  material: CinematicMaterial;
}

export interface CinematicEnvironment {
  /** Equirectangular, linear RGB (3 floats per texel). */
  width: number;
  height: number;
  pixels: Float32Array;
  intensity: number;
}

export interface CinematicCamera {
  position: [number, number, number];
  target: [number, number, number];
  up?: [number, number, number];
  fovDeg: number;
}

export interface CinematicScene {
  meshes: CinematicMesh[];
  environment?: CinematicEnvironment;
  camera: CinematicCamera;
}

export interface FlattenedScene {
  /** 3 × vec4 per triangle: xyz + materialId. */
  triVertices: Float32Array;
  /** 2 × vec4 per triangle: e1.xyz + area, e2.xyz + 0. */
  triEdges: Float32Array;
  /** 3 × vec4 per triangle: xyz. */
  triNormals: Float32Array;
  /** 3 × vec4 per material: baseColor+1, params, emissive. */
  materials: Float32Array;
  materialCount: number;
  triCount: number;
  bvh: FlattenedBvh;
  /** Triangle indices with at least one emissive vertex material. */
  emissiveTris: Uint32Array;
}

function faceNormal(
  positions: Float32Array,
  base: number,
): [number, number, number] {
  const ax = positions[base + 3] - positions[base];
  const ay = positions[base + 4] - positions[base + 1];
  const az = positions[base + 5] - positions[base + 2];
  const bx = positions[base + 6] - positions[base];
  const by = positions[base + 7] - positions[base + 1];
  const bz = positions[base + 8] - positions[base + 2];
  const nx = ay * bz - az * by;
  const ny = az * bx - ax * bz;
  const nz = ax * by - ay * bx;
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

export function flattenCinematicScene(scene: CinematicScene): FlattenedScene {
  // Index every mesh, expanding indexed geometry to a plain triangle list.
  const meshes = scene.meshes;
  let triTotal = 0;
  const meshTriCounts: number[] = [];
  for (const mesh of meshes) {
    const count = mesh.indices ? mesh.indices.length / 3 : mesh.positions.length / 9;
    meshTriCounts.push(count);
    triTotal += count;
  }

  const positions = new Float32Array(triTotal * 9);
  const triVertices = new Float32Array(triTotal * 12);
  const triEdges = new Float32Array(triTotal * 8);
  const triNormals = new Float32Array(triTotal * 12);
  const emissiveList: number[] = [];

  const materialCount = meshes.length;
  const materials = new Float32Array(materialCount * 12);

  let tri = 0;
  meshes.forEach((mesh, materialId) => {
    const mat = mesh.material;
    const mBase = materialId * 12;
    materials[mBase + 0] = mat.baseColor[0];
    materials[mBase + 1] = mat.baseColor[1];
    materials[mBase + 2] = mat.baseColor[2];
    materials[mBase + 3] = 1;
    materials[mBase + 4] = mat.metallic;
    materials[mBase + 5] = mat.roughness;
    materials[mBase + 6] = 1.5;
    materials[mBase + 7] = 0;
    materials[mBase + 8] = mat.emissive[0];
    materials[mBase + 9] = mat.emissive[1];
    materials[mBase + 10] = mat.emissive[2];
    materials[mBase + 11] = 0;

    const isEmissive =
      mat.emissive[0] > 0 || mat.emissive[1] > 0 || mat.emissive[2] > 0;

    const localTris = meshTriCounts[materialId];
    for (let t = 0; t < localTris; t += 1) {
      const v0 = mesh.indices ? mesh.indices[t * 3] : t * 3;
      const v1 = mesh.indices ? mesh.indices[t * 3 + 1] : t * 3 + 1;
      const v2 = mesh.indices ? mesh.indices[t * 3 + 2] : t * 3 + 2;

      const pBase = tri * 9;
      for (let corner = 0; corner < 3; corner += 1) {
        const vertex = corner === 0 ? v0 : corner === 1 ? v1 : v2;
        const x = mesh.positions[vertex * 3];
        const y = mesh.positions[vertex * 3 + 1];
        const z = mesh.positions[vertex * 3 + 2];
        positions[pBase + corner * 3] = x;
        positions[pBase + corner * 3 + 1] = y;
        positions[pBase + corner * 3 + 2] = z;

        const tv = tri * 12 + corner * 4;
        triVertices[tv] = x;
        triVertices[tv + 1] = y;
        triVertices[tv + 2] = z;
        triVertices[tv + 3] = materialId;

        if (mesh.normals) {
          triNormals[tv] = mesh.normals[vertex * 3];
          triNormals[tv + 1] = mesh.normals[vertex * 3 + 1];
          triNormals[tv + 2] = mesh.normals[vertex * 3 + 2];
        }
      }

      if (!mesh.normals) {
        const fn = faceNormal(positions, pBase);
        for (let corner = 0; corner < 3; corner += 1) {
          const tv = tri * 12 + corner * 4;
          triNormals[tv] = fn[0];
          triNormals[tv + 1] = fn[1];
          triNormals[tv + 2] = fn[2];
        }
      }

      const e1x = positions[pBase + 3] - positions[pBase];
      const e1y = positions[pBase + 4] - positions[pBase + 1];
      const e1z = positions[pBase + 5] - positions[pBase + 2];
      const e2x = positions[pBase + 6] - positions[pBase];
      const e2y = positions[pBase + 7] - positions[pBase + 1];
      const e2z = positions[pBase + 8] - positions[pBase + 2];
      const area =
        Math.hypot(
          e1y * e2z - e1z * e2y,
          e1z * e2x - e1x * e2z,
          e1x * e2y - e1y * e2x,
        ) / 2;
      const eBase = tri * 8;
      triEdges[eBase] = e1x;
      triEdges[eBase + 1] = e1y;
      triEdges[eBase + 2] = e1z;
      triEdges[eBase + 3] = area;
      triEdges[eBase + 4] = e2x;
      triEdges[eBase + 5] = e2y;
      triEdges[eBase + 6] = e2z;
      triEdges[eBase + 7] = 0;

      if (isEmissive) emissiveList.push(tri);
      tri += 1;
    }
  });

  const bvh = buildBvh(positions, triTotal);
  return {
    triVertices,
    triEdges,
    triNormals,
    materials,
    materialCount,
    triCount: triTotal,
    bvh,
    emissiveTris: new Uint32Array(emissiveList),
  };
}

export interface EnvironmentCdf {
  /** Row CDFs, env_height × env_width texels. */
  rows: Float32Array;
  /** Marginal CDF over rows, env_height entries. */
  marginal: Float32Array;
  /** Per-texel probability density, env_height × env_width texels. */
  pdf: Float32Array;
}

/**
 * Luminance-weighted CDFs for importance sampling the environment map
 * (Veach, "Robust Monte Carlo Methods for Light Transport Simulation").
 */
export function buildEnvironmentCdf(env: CinematicEnvironment): EnvironmentCdf {
  const { width, height, pixels } = env;
  const lum = new Float32Array(width * height);
  const rowSums = new Float32Array(height);
  let total = 0;

  for (let y = 0; y < height; y += 1) {
    // Solid-angle weight of an equirect texel: sin(theta) at the row centre.
    const theta = ((y + 0.5) / height) * Math.PI;
    const sinTheta = Math.max(Math.sin(theta), 1e-4);
    let rowSum = 0;
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 3;
      const l =
        (0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]) *
        sinTheta;
      lum[y * width + x] = l;
      rowSum += l;
    }
    rowSums[y] = rowSum;
    total += rowSum;
  }

  const rows = new Float32Array(width * height);
  const marginal = new Float32Array(height);
  const pdf = new Float32Array(width * height);
  const invTotal = total > 0 ? 1 / total : 0;
  let marginalAcc = 0;

  for (let y = 0; y < height; y += 1) {
    let acc = 0;
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      acc += lum[i];
      rows[i] = rowSums[y] > 0 ? acc / rowSums[y] : (x + 1) / width;
      pdf[i] = lum[i] * invTotal;
    }
    // Guard degenerate rows (all black) — uniform within the row.
    if (rowSums[y] <= 0) {
      for (let x = 0; x < width; x += 1) {
        rows[y * width + x] = (x + 1) / width;
        pdf[y * width + x] = 1 / (width * height);
      }
    }
    marginalAcc += rowSums[y];
    marginal[y] = total > 0 ? marginalAcc * invTotal : (y + 1) / height;
  }

  return { rows, marginal, pdf };
}

/** Camera basis matching the WGSL ray generator. */
export function cameraBasis(camera: CinematicCamera): {
  position: [number, number, number];
  right: [number, number, number];
  up: [number, number, number];
  forward: [number, number, number];
  tanHalfFov: number;
} {
  const upHint = camera.up ?? [0, 1, 0];
  const forward = normalize([
    camera.target[0] - camera.position[0],
    camera.target[1] - camera.position[1],
    camera.target[2] - camera.position[2],
  ]);
  const right = normalize(cross(forward, upHint));
  const up = cross(right, forward);
  return {
    position: camera.position,
    right,
    up,
    forward,
    tanHalfFov: Math.tan((camera.fovDeg * Math.PI) / 360),
  };
}

function cross(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalize(v: readonly [number, number, number]): [number, number, number] {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

/* ----------------------------------------------- procedural scene/env --- */

/** Smooth procedural sky: horizon glow, cool zenith, warm sun lobe. */
export function proceduralEnvironment(width = 256, height = 128): CinematicEnvironment {
  const pixels = new Float32Array(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    const theta = ((y + 0.5) / height) * Math.PI;
    for (let x = 0; x < width; x += 1) {
      const phi = ((x + 0.5) / width) * Math.PI * 2 - Math.PI;
      const dirY = Math.cos(theta);
      const dirX = Math.sin(theta) * Math.cos(phi);
      const dirZ = Math.sin(theta) * Math.sin(phi);

      const t = Math.min(1, Math.max(0, dirY * 0.5 + 0.5));
      let r = 0.32 + 0.45 * t;
      let g = 0.36 + 0.48 * t;
      let b = 0.45 + 0.55 * t;

      // Warm sun lobe near (0.4, 0.6, 0.2).
      const sunDot = dirX * 0.42 + dirY * 0.62 + dirZ * 0.28;
      const sun = Math.pow(Math.max(sunDot, 0), 48) * 22;
      const glow = Math.pow(Math.max(sunDot, 0), 4) * 1.2;
      r += sun * 1.0 + glow * 0.55;
      g += sun * 0.92 + glow * 0.5;
      b += sun * 0.78 + glow * 0.42;

      // Horizon haze band.
      const haze = Math.exp(-Math.abs(dirY) * 8) * 0.35;
      r += haze * 0.5;
      g += haze * 0.52;
      b += haze * 0.58;

      const i = (y * width + x) * 3;
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
    }
  }
  return { width, height, pixels, intensity: 1 };
}

function makeSphere(
  center: readonly [number, number, number],
  radius: number,
  segments: number,
  material: CinematicMaterial,
): CinematicMesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  for (let y = 0; y <= segments; y += 1) {
    const v = y / segments;
    const theta = v * Math.PI;
    for (let x = 0; x <= segments; x += 1) {
      const u = x / segments;
      const phi = u * Math.PI * 2;
      const nx = Math.sin(theta) * Math.cos(phi);
      const ny = Math.cos(theta);
      const nz = Math.sin(theta) * Math.sin(phi);
      positions.push(center[0] + nx * radius, center[1] + ny * radius, center[2] + nz * radius);
      normals.push(nx, ny, nz);
    }
  }
  const stride = segments + 1;
  for (let y = 0; y < segments; y += 1) {
    for (let x = 0; x < segments; x += 1) {
      const a = y * stride + x;
      const b = a + stride;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
    material,
  };
}

function makeQuad(
  corners: [
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number],
  ],
  material: CinematicMaterial,
): CinematicMesh {
  return {
    positions: new Float32Array([
      ...corners[0],
      ...corners[1],
      ...corners[2],
      ...corners[3],
    ]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    material,
  };
}

/**
 * The calibration studio: matte floor, a metal/roughness sphere chart, a
 * glass-ish sphere, a brushed-metal column, and two emissive panels — the
 * minimum scene that shows off GI, reflections, soft shadows and bloom.
 */
export function buildCalibrationScene(): CinematicScene {
  const meshes: CinematicMesh[] = [];

  // Floor — dark matte with a hint of gloss so reflections read.
  meshes.push(
    makeQuad(
      [
        [-14, 0, -14],
        [14, 0, -14],
        [14, 0, 14],
        [-14, 0, 14],
      ],
      { baseColor: [0.22, 0.215, 0.21], metallic: 0, roughness: 0.38, emissive: [0, 0, 0] },
    ),
  );

  // Back wall.
  meshes.push(
    makeQuad(
      [
        [-14, 0, -10],
        [14, 0, -10],
        [14, 9, -10],
        [-14, 9, -10],
      ],
      { baseColor: [0.42, 0.43, 0.46], metallic: 0, roughness: 0.75, emissive: [0, 0, 0] },
    ),
  );

  // Metal/roughness sphere chart.
  const chart: Array<[number, number]> = [
    [1, 0.08],
    [1, 0.25],
    [1, 0.5],
    [1, 0.85],
  ];
  chart.forEach(([metallic, roughness], i) => {
    meshes.push(
      makeSphere([-3.6 + i * 2.4, 1, 0], 1, 40, {
        baseColor: metallic > 0.5 ? [0.92, 0.78, 0.55] : [0.72, 0.12, 0.1],
        metallic,
        roughness,
        emissive: [0, 0, 0],
      }),
    );
  });

  // Glossy blue dielectric hero sphere.
  meshes.push(
    makeSphere([0, 1.6, 3.4], 1.6, 48, {
      baseColor: [0.08, 0.18, 0.62],
      metallic: 0.1,
      roughness: 0.12,
      emissive: [0, 0, 0],
    }),
  );

  // Key light panel (warm, high radiance — drives the GI).
  meshes.push(
    makeQuad(
      [
        [-3.2, 6.4, 1.4],
        [3.2, 6.4, 1.4],
        [3.2, 6.4, -1.6],
        [-3.2, 6.4, -1.6],
      ],
      { baseColor: [1, 1, 1], metallic: 0, roughness: 1, emissive: [9.5, 8.6, 7.2] },
    ),
  );

  // Cool rim strip.
  meshes.push(
    makeQuad(
      [
        [-7.5, 2.2, -7],
        [-7.5, 2.2, -2],
        [-7.5, 3.4, -2],
        [-7.5, 3.4, -7],
      ],
      { baseColor: [1, 1, 1], metallic: 0, roughness: 1, emissive: [2.2, 3.1, 5.4] },
    ),
  );

  return {
    meshes,
    environment: proceduralEnvironment(),
    camera: {
      position: [6.2, 3.4, 8.4],
      target: [0, 1.2, 0],
      fovDeg: 42,
    },
  };
}
