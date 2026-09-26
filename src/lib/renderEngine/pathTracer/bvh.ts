/**
 * CPU BVH builder for the cinematic path tracer.
 *
 * Binned-median hybrid split over triangle centroids, flattened into the GPU
 * node layout the WGSL traversal expects:
 *
 *   node = { min.xyz, leftFirst, max.xyz, count }
 *   count > 0  → leaf: `leftFirst` indexes the reordered triangle index list
 *   count == 0 → inner: `leftFirst` is the left child (right = left + 1)
 *
 * Pure TypeScript — no GPU, no three — so it is unit tested directly.
 */

export interface FlattenedBvh {
  /** 8 floats per node. */
  nodes: Float32Array;
  /** Triangle indices in leaf order. */
  indices: Uint32Array;
  nodeCount: number;
  maxDepth: number;
  leafCount: number;
}

interface BuildTri {
  index: number;
  min: [number, number, number];
  max: [number, number, number];
  centroid: [number, number, number];
}

const MAX_DEPTH = 40;

function triBounds(positions: Float32Array, tri: number): BuildTri {
  const base = tri * 9;
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < 3; v += 1) {
    for (let c = 0; c < 3; c += 1) {
      const value = positions[base + v * 3 + c];
      if (value < min[c]) min[c] = value;
      if (value > max[c]) max[c] = value;
    }
  }
  return {
    index: tri,
    min,
    max,
    centroid: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
  };
}

export function buildBvh(
  positions: Float32Array,
  triCount: number,
  maxLeafSize = 4,
): FlattenedBvh {
  const tris: BuildTri[] = [];
  for (let i = 0; i < triCount; i += 1) tris.push(triBounds(positions, i));

  const indices = new Uint32Array(triCount);
  for (let i = 0; i < triCount; i += 1) indices[i] = i;

  if (triCount === 0) {
    return { nodes: new Float32Array(8), indices, nodeCount: 1, maxDepth: 0, leafCount: 0 };
  }

  const nodes: number[] = [];
  let leafCount = 0;
  let maxDepth = 0;

  interface Frame {
    start: number;
    count: number;
    nodeIndex: number;
    depth: number;
  }

  const stack: Frame[] = [{ start: 0, count: triCount, nodeIndex: 0, depth: 0 }];
  // Reserve root slot.
  nodes.push(0, 0, 0, 0, 0, 0, 0, 0);

  while (stack.length > 0) {
    const frame = stack.pop() as Frame;
    const slice = tris.slice(frame.start, frame.start + frame.count);

    const boundsMin: [number, number, number] = [Infinity, Infinity, Infinity];
    const boundsMax: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    const centroidMin: [number, number, number] = [Infinity, Infinity, Infinity];
    const centroidMax: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    for (const t of slice) {
      for (let c = 0; c < 3; c += 1) {
        if (t.min[c] < boundsMin[c]) boundsMin[c] = t.min[c];
        if (t.max[c] > boundsMax[c]) boundsMax[c] = t.max[c];
        if (t.centroid[c] < centroidMin[c]) centroidMin[c] = t.centroid[c];
        if (t.centroid[c] > centroidMax[c]) centroidMax[c] = t.centroid[c];
      }
    }

    maxDepth = Math.max(maxDepth, frame.depth);
    const split =
      frame.count <= maxLeafSize || frame.depth >= MAX_DEPTH;

    if (split) {
      leafCount += 1;
      const base = frame.nodeIndex * 8;
      nodes[base + 0] = boundsMin[0];
      nodes[base + 1] = boundsMin[1];
      nodes[base + 2] = boundsMin[2];
      nodes[base + 3] = frame.start; // leftFirst → first index slot
      nodes[base + 4] = boundsMax[0];
      nodes[base + 5] = boundsMax[1];
      nodes[base + 6] = boundsMax[2];
      nodes[base + 7] = frame.count;
      continue;
    }

    // Split along the widest centroid axis at the median.
    let axis = 0;
    let widest = -Infinity;
    for (let c = 0; c < 3; c += 1) {
      const extent = centroidMax[c] - centroidMin[c];
      if (extent > widest) {
        widest = extent;
        axis = c;
      }
    }
    slice.sort((a, b) => a.centroid[axis] - b.centroid[axis]);
    for (let i = 0; i < slice.length; i += 1) {
      // Keep the working array in index order so child frames slice correctly.
      tris[frame.start + i] = slice[i];
      indices[frame.start + i] = slice[i].index;
    }
    const half = Math.max(1, Math.floor(frame.count / 2));

    const leftIndex = nodes.length / 8;
    // Reserve both children.
    nodes.push(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

    const base = frame.nodeIndex * 8;
    nodes[base + 0] = boundsMin[0];
    nodes[base + 1] = boundsMin[1];
    nodes[base + 2] = boundsMin[2];
    nodes[base + 3] = leftIndex;
    nodes[base + 4] = boundsMax[0];
    nodes[base + 5] = boundsMax[1];
    nodes[base + 6] = boundsMax[2];
    nodes[base + 7] = 0;

    stack.push({ start: frame.start, count: half, nodeIndex: leftIndex, depth: frame.depth + 1 });
    stack.push({
      start: frame.start + half,
      count: frame.count - half,
      nodeIndex: leftIndex + 1,
      depth: frame.depth + 1,
    });
  }

  return {
    nodes: new Float32Array(nodes),
    indices,
    nodeCount: nodes.length / 8,
    maxDepth,
    leafCount,
  };
}

/**
 * Structural validation — cheap enough to run in dev builds and in tests:
 * every triangle referenced exactly once, leaves in range, bounds contain
 * their triangles.
 */
export function validateBvh(
  bvh: FlattenedBvh,
  positions: Float32Array,
  triCount: number,
): string[] {
  const problems: string[] = [];
  const seen = new Uint32Array(triCount);

  for (let n = 0; n < bvh.nodeCount; n += 1) {
    const base = n * 8;
    const leftFirst = bvh.nodes[base + 3];
    const count = bvh.nodes[base + 7];
    if (count > 0) {
      for (let i = 0; i < count; i += 1) {
        const slot = leftFirst + i;
        if (slot < 0 || slot >= bvh.indices.length) {
          problems.push(`node ${n}: leaf slot ${slot} out of range`);
          continue;
        }
        const tri = bvh.indices[slot];
        if (tri >= triCount) {
          problems.push(`node ${n}: triangle ${tri} out of range`);
          continue;
        }
        seen[tri] += 1;
        const tBase = tri * 9;
        for (let v = 0; v < 3; v += 1) {
          for (let c = 0; c < 3; c += 1) {
            const value = positions[tBase + v * 3 + c];
            if (value < bvh.nodes[base + c] - 1e-4 || value > bvh.nodes[base + 4 + c] + 1e-4) {
              problems.push(`node ${n}: triangle ${tri} escapes node bounds`);
            }
          }
        }
      }
    } else if (bvh.nodeCount > 1) {
      const left = leftFirst;
      if (left + 1 >= bvh.nodeCount) problems.push(`node ${n}: child index ${left} out of range`);
    }
  }

  for (let t = 0; t < triCount; t += 1) {
    if (seen[t] !== 1) problems.push(`triangle ${t} referenced ${seen[t]} times`);
  }
  return problems;
}

/** Brute-force ray/triangle test — used to verify traversal and for picking. */
export function intersectSceneBruteForce(
  positions: Float32Array,
  triCount: number,
  ro: readonly [number, number, number],
  rd: readonly [number, number, number],
): number {
  let best = Infinity;
  for (let t = 0; t < triCount; t += 1) {
    const base = t * 9;
    const p0 = [positions[base], positions[base + 1], positions[base + 2]];
    const e1 = [
      positions[base + 3] - p0[0],
      positions[base + 4] - p0[1],
      positions[base + 5] - p0[2],
    ];
    const e2 = [
      positions[base + 6] - p0[0],
      positions[base + 7] - p0[1],
      positions[base + 8] - p0[2],
    ];
    const p = [
      rd[1] * e2[2] - rd[2] * e2[1],
      rd[2] * e2[0] - rd[0] * e2[2],
      rd[0] * e2[1] - rd[1] * e2[0],
    ];
    const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
    if (Math.abs(det) < 1e-9) continue;
    const inv = 1 / det;
    const tv = [ro[0] - p0[0], ro[1] - p0[1], ro[2] - p0[2]];
    const u = (tv[0] * p[0] + tv[1] * p[1] + tv[2] * p[2]) * inv;
    if (u < 0 || u > 1) continue;
    const q = [
      tv[1] * e1[2] - tv[2] * e1[1],
      tv[2] * e1[0] - tv[0] * e1[2],
      tv[0] * e1[1] - tv[1] * e1[0],
    ];
    const v = (rd[0] * q[0] + rd[1] * q[1] + rd[2] * q[2]) * inv;
    if (v < 0 || u + v > 1) continue;
    const hit = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) * inv;
    if (hit > 1e-4 && hit < best) best = hit;
  }
  return Number.isFinite(best) ? best : -1;
}
