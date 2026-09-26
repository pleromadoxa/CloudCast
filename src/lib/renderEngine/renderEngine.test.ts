/**
 * Render engine unit tests — the pure core of the CloudCast render engine.
 *
 * Covers the pieces that decide image correctness and performance without
 * needing a GPU: the path tracer's BVH builder, scene flattening and
 * environment CDF, the GPU scoring/preset recommendation, the scalability
 * presets and adaptive frame controller, settings normalization/persistence,
 * and the frame metrics helpers.
 */
import { describe, expect, it } from 'vitest';
import {
  buildBvh,
  intersectSceneBruteForce,
  validateBvh,
  type FlattenedBvh,
} from './pathTracer/bvh';
import {
  buildCalibrationScene,
  buildEnvironmentCdf,
  cameraBasis,
  flattenCinematicScene,
  proceduralEnvironment,
  type CinematicEnvironment,
  type CinematicScene,
} from './pathTracer/scene';
import {
  composeCapabilities,
  pickBackend,
  recommendPresetForScore,
  scoreGpu,
  type GpuScoreInput,
} from './capabilities';
import {
  DEFAULT_RENDER_ENGINE_SETTINGS,
  RenderEngineSettingsStore,
  normalizeRenderEngineSettings,
} from './settings';
import {
  applyPresetToSettings,
  derivePresetFromSettings,
  engineQualityProfile,
  ENGINE_QUALITY_PROFILES,
  frameBudgetMs,
  nextAdaptiveAction,
  qualityForStudioTier,
  studioTierForQuality,
  type AdaptiveFrameState,
} from './quality';
import { estimateVramBytes, formatBytes, FrameMetrics } from './metrics';
import { toHalfFloat } from './cinematicRenderer';

/* ------------------------------------------------------------ helpers --- */

/** Deterministic PRNG so tests never flake. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Scattered triangle soup — the stress case for the BVH split heuristic. */
function randomTriangles(count: number, seed = 7): Float32Array {
  const rand = mulberry32(seed);
  const positions = new Float32Array(count * 9);
  for (let t = 0; t < count; t += 1) {
    const cx = (rand() - 0.5) * 20;
    const cy = (rand() - 0.5) * 20;
    const cz = (rand() - 0.5) * 20;
    const s = 0.2 + rand() * 0.8;
    for (let v = 0; v < 3; v += 1) {
      positions[t * 9 + v * 3 + 0] = cx + (rand() - 0.5) * s;
      positions[t * 9 + v * 3 + 1] = cy + (rand() - 0.5) * s;
      positions[t * 9 + v * 3 + 2] = cz + (rand() - 0.5) * s;
    }
  }
  return positions;
}

function isPermutation(indices: Uint32Array, n: number): boolean {
  if (indices.length !== n) return false;
  const seen = new Uint8Array(n);
  for (const value of indices) {
    if (value >= n || seen[value]) return false;
    seen[value] = 1;
  }
  return true;
}

/**
 * Rebuild the plain world-space triangle list the BVH was built over from the
 * flattened GPU layout (3 × vec4 per triangle: xyz + materialId per corner).
 */
function positionsFromFlat(flat: { triVertices: Float32Array; triCount: number }): Float32Array {
  const positions = new Float32Array(flat.triCount * 9);
  for (let t = 0; t < flat.triCount; t += 1) {
    for (let corner = 0; corner < 3; corner += 1) {
      for (let c = 0; c < 3; c += 1) {
        positions[t * 9 + corner * 3 + c] = flat.triVertices[t * 12 + corner * 4 + c];
      }
    }
  }
  return positions;
}

const BASE_SCORE_INPUT: GpuScoreInput = {
  webgpuAvailable: false,
  webgpuFeatureCount: 0,
  hasTimestampQuery: false,
  hasSubgroups: false,
  hasFloat32Filterable: false,
  hasShaderF16: false,
  maxTextureDimension2D: 0,
  maxStorageBufferBindingSize: 0,
  webgl2Available: false,
  webgl2MaxSamples: 0,
  webgl2MaxTextureSize: 0,
};

/* ----------------------------------------------------------------- BVH --- */

describe('pathTracer/bvh', () => {
  it('builds a valid BVH over a scattered triangle soup', () => {
    const triCount = 256;
    const positions = randomTriangles(triCount);
    const bvh = buildBvh(positions, triCount, 4);

    expect(bvh.nodeCount).toBeGreaterThan(1);
    expect(bvh.leafCount).toBeGreaterThan(1);
    expect(bvh.maxDepth).toBeGreaterThan(0);
    expect(isPermutation(bvh.indices, triCount)).toBe(true);
    expect(validateBvh(bvh, positions, triCount)).toEqual([]);
  });

  it('respects maxLeafSize and depth limits', () => {
    const positions = randomTriangles(64, 11);
    const small = buildBvh(positions, 64, 1);
    const large = buildBvh(positions, 64, 16);
    expect(large.leafCount).toBeLessThan(small.leafCount);
    // Large leaves hold up to 16 triangles each.
    expect(64 / large.leafCount).toBeLessThanOrEqual(16);
  });

  it('handles an empty scene', () => {
    const bvh = buildBvh(new Float32Array(0), 0);
    expect(bvh.nodeCount).toBe(1);
    expect(bvh.leafCount).toBe(0);
    expect(bvh.indices.length).toBe(0);
  });

  it('produces bounds that contain every triangle', () => {
    const triCount = 128;
    const positions = randomTriangles(triCount, 23);
    const bvh = buildBvh(positions, triCount, 2);
    expect(validateBvh(bvh, positions, triCount)).toEqual([]);
  });

  it('brute-force ray cast hits a known triangle at the right distance', () => {
    // Unit triangle in the z=0 plane.
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const hit = intersectSceneBruteForce(positions, 1, [0.25, 0.25, 1], [0, 0, -1]);
    expect(hit).toBeCloseTo(1, 5);

    const miss = intersectSceneBruteForce(positions, 1, [5, 5, 1], [0, 0, -1]);
    expect(miss).toBe(-1);
  });

  it('leaf triangle counts sum to the scene triangle count', () => {
    const triCount = 100;
    const positions = randomTriangles(triCount, 31);
    const bvh = buildBvh(positions, triCount, 3);
    let sum = 0;
    for (let n = 0; n < bvh.nodeCount; n += 1) {
      const count = bvh.nodes[n * 8 + 7];
      sum += count;
    }
    expect(sum).toBe(triCount);
  });
});

/* -------------------------------------------------------------- scenes --- */

describe('pathTracer/scene', () => {
  it('flattens a scene into GPU-ready buffers', () => {
    const scene: CinematicScene = {
      meshes: [
        {
          positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          material: { baseColor: [0.8, 0.2, 0.2], metallic: 0, roughness: 0.5, emissive: [2, 2, 2] },
        },
        {
          positions: new Float32Array([0, 0, 1, 1, 0, 1, 0, 1, 1, 2, 0, 1, 1, 1, 1, 2, 1, 1]),
          material: { baseColor: [0.1, 0.1, 0.8], metallic: 1, roughness: 0.2, emissive: [0, 0, 0] },
        },
      ],
      camera: { position: [0, 1, 5], target: [0, 0, 0], fovDeg: 38 },
    };
    const flat = flattenCinematicScene(scene);
    expect(flat.triCount).toBe(3);
    expect(flat.materialCount).toBe(2);
    expect(flat.triVertices.length).toBe(3 * 12);
    expect(flat.triEdges.length).toBe(3 * 8);
    expect(flat.triNormals.length).toBe(3 * 12);
    // The first mesh is fully emissive — its triangle must register.
    expect([...flat.emissiveTris]).toContain(0);
    expect([...flat.emissiveTris]).not.toContain(1);
    // The BVH must survive the same triangle soup.
    expect(validateBvh(flat.bvh, positionsFromFlat(flat), flat.triCount)).toEqual([]);
  });

  it('builds monotonic environment CDFs with a normalized PDF', () => {
    const env = proceduralEnvironment(32, 16);
    const cdf = buildEnvironmentCdf(env);

    // Row CDFs are monotonic and end at 1.
    for (let y = 0; y < env.height; y += 1) {
      let previous = -1;
      for (let x = 0; x < env.width; x += 1) {
        const value = cdf.rows[y * env.width + x];
        expect(value).toBeGreaterThanOrEqual(previous - 1e-6);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1 + 1e-6);
        previous = value;
      }
      expect(cdf.rows[y * env.width + env.width - 1]).toBeCloseTo(1, 4);
    }

    // Marginal CDF is monotonic and ends at 1.
    for (let y = 1; y < env.height; y += 1) {
      expect(cdf.marginal[y]).toBeGreaterThanOrEqual(cdf.marginal[y - 1] - 1e-6);
    }
    expect(cdf.marginal[env.height - 1]).toBeCloseTo(1, 4);

    // The PDF integrates to 1.
    let sum = 0;
    for (const p of cdf.pdf) sum += p;
    expect(sum).toBeCloseTo(1, 4);
  });

  it('degrades gracefully on a black environment', () => {
    const env: CinematicEnvironment = {
      width: 8,
      height: 4,
      pixels: new Float32Array(8 * 4 * 3),
      intensity: 1,
    };
    const cdf = buildEnvironmentCdf(env);
    for (let y = 0; y < env.height; y += 1) {
      expect(cdf.rows[y * env.width + env.width - 1]).toBeCloseTo(1, 5);
    }
    expect(cdf.marginal[env.height - 1]).toBeCloseTo(1, 5);
    for (const value of cdf.pdf) expect(Number.isFinite(value)).toBe(true);
  });

  it('builds an orthonormal camera basis', () => {
    const basis = cameraBasis({ position: [0, 0, 5], target: [0, 0, 0], fovDeg: 60 });
    const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    expect(dot(basis.forward, basis.right)).toBeCloseTo(0, 5);
    expect(dot(basis.forward, basis.up)).toBeCloseTo(0, 5);
    expect(dot(basis.right, basis.up)).toBeCloseTo(0, 5);
    expect(basis.tanHalfFov).toBeCloseTo(Math.tan(Math.PI / 6), 5);
  });

  it('builds the calibration studio without errors and validates', () => {
    const scene = buildCalibrationScene();
    expect(scene.meshes.length).toBeGreaterThan(0);
    expect(scene.environment).toBeDefined();
    const flat = flattenCinematicScene(scene);
    expect(flat.triCount).toBeGreaterThan(10);
    expect(validateBvh(flat.bvh, positionsFromFlat(flat), flat.triCount)).toEqual([]);
    expect(flat.materialCount).toBe(scene.meshes.length);
  });
});

/* -------------------------------------------------------- capabilities --- */

describe('capabilities scoring', () => {
  it('scores a WebGL2-only machine in the entry band', () => {
    const score = scoreGpu({
      ...BASE_SCORE_INPUT,
      webgl2Available: true,
      webgl2MaxSamples: 4,
      webgl2MaxTextureSize: 4096,
    });
    expect(score).toBe(16);
    expect(recommendPresetForScore(score)).toBe('performance');
    expect(recommendPresetForScore(score, true)).toBe('performance');
  });

  it('scores a fully featured WebGPU adapter at the top', () => {
    const score = scoreGpu({
      webgpuAvailable: true,
      webgpuFeatureCount: 20,
      hasTimestampQuery: true,
      hasSubgroups: true,
      hasFloat32Filterable: true,
      hasShaderF16: true,
      maxTextureDimension2D: 16384,
      maxStorageBufferBindingSize: 256 * 1024 * 1024,
      webgl2Available: true,
      webgl2MaxSamples: 16,
      webgl2MaxTextureSize: 16384,
    });
    // 20 base + 10 timestamp + 8 subgroups + 7 f32-filter + 5 f16 + 5 tex +
    // 5 storage + 10 features + 20 WebGL2 = 90 — the top of the scale.
    expect(score).toBe(90);
    expect(recommendPresetForScore(score)).toBe('cinematic');
    // Mobile still lands one tier below desktop.
    expect(recommendPresetForScore(score, true)).toBe('quality');
  });

  it('caps the score at 100 and never goes negative', () => {
    expect(scoreGpu(BASE_SCORE_INPUT)).toBe(0);
    expect(scoreGpu({ ...BASE_SCORE_INPUT, webgpuAvailable: true, webgpuFeatureCount: 999 })).toBeLessThanOrEqual(100);
  });

  it('walks the recommendation bands', () => {
    expect(recommendPresetForScore(90)).toBe('cinematic');
    expect(recommendPresetForScore(70)).toBe('quality');
    expect(recommendPresetForScore(40)).toBe('balanced');
    expect(recommendPresetForScore(10)).toBe('performance');
    expect(recommendPresetForScore(80, true)).toBe('quality');
    expect(recommendPresetForScore(50, true)).toBe('balanced');
  });

  it('picks the backend from preference and availability', () => {
    expect(pickBackend('auto', true, true)).toBe('webgpu');
    expect(pickBackend('auto', false, true)).toBe('webgl2');
    expect(pickBackend('auto', false, false)).toBe('none');
    // Forced preference degrades instead of failing hard.
    expect(pickBackend('webgpu', false, true)).toBe('webgl2');
    expect(pickBackend('webgl2', true, false)).toBe('webgpu');
    expect(pickBackend('webgpu', false, false)).toBe('none');
  });

  it('composes an immutable capability report', () => {
    const webgpu = {
      capabilities: {
        available: true,
        adapterLabel: 'Test GPU',
        vendor: 'test',
        architecture: 'test-arch',
        features: ['timestamp-query', 'subgroups', 'shader-f16'],
        requestedFeatures: ['timestamp-query'],
        limits: {
          maxTextureDimension2D: 8192,
          maxStorageBufferBindingSize: 128 * 1024 * 1024,
        },
        isFallbackAdapter: false,
      },
      adapter: null,
      requestedFeatureNames: ['timestamp-query'],
      requestedLimitValues: {},
    };
    const webgl2 = {
      available: true,
      renderer: 'Test GL',
      maxTextureSize: 8192,
      maxSamples: 8,
      maxColorAttachments: 8,
      extensions: [],
    };
    const caps = composeCapabilities(webgpu, webgl2);
    expect(caps.score).toBeGreaterThan(40);
    expect(caps.recommendedPreset).toBe(recommendPresetForScore(caps.score));
    expect(caps.recommendedBackend).toBe('webgpu');
    expect(caps.webgpu.features).toContain('timestamp-query');
    expect(caps.probedAt).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------- quality --- */

describe('quality presets', () => {
  it('every preset round-trips through derive', () => {
    for (const preset of ['performance', 'balanced', 'quality', 'cinematic'] as const) {
      const settings = applyPresetToSettings(DEFAULT_RENDER_ENGINE_SETTINGS, preset);
      expect(settings.quality).toBe(preset);
      expect(derivePresetFromSettings(settings)).toBe(preset);
    }
  });

  it('applyPresetToSettings fills the preset-managed fields', () => {
    const settings = applyPresetToSettings(DEFAULT_RENDER_ENGINE_SETTINGS, 'performance');
    const profile = engineQualityProfile('performance');
    expect(profile).not.toBeNull();
    expect(settings.renderScale).toBe(profile!.renderScale);
    expect(settings.antiAliasing).toBe(profile!.antiAliasing);
    expect(settings.gtao).toBe(profile!.gtao);
    expect(settings.shadowQuality).toBe(profile!.shadowQuality);
  });

  it('leaves custom settings alone', () => {
    const custom = { ...DEFAULT_RENDER_ENGINE_SETTINGS, renderScale: 1.13, bloom: false };
    const result = applyPresetToSettings(custom, 'custom');
    expect(result.quality).toBe('custom');
    expect(result.renderScale).toBe(1.13);
    expect(result.bloom).toBe(false);
    expect(derivePresetFromSettings(custom)).toBe('custom');
  });

  it('marks deviations as custom', () => {
    const settings = applyPresetToSettings(DEFAULT_RENDER_ENGINE_SETTINGS, 'balanced');
    settings.bloom = !settings.bloom;
    expect(derivePresetFromSettings(settings)).toBe('custom');
  });

  it('bridges studio tier names in both directions', () => {
    expect(studioTierForQuality('performance')).toBe('low');
    expect(studioTierForQuality('cinematic')).toBe('ultra');
    expect(qualityForStudioTier('ultra')).toBe('cinematic');
    expect(qualityForStudioTier('low')).toBe('performance');
    for (const tier of ['low', 'balanced', 'high', 'ultra'] as const) {
      expect(studioTierForQuality(qualityForStudioTier(tier))).toBe(tier);
    }
  });

  it('profiles are internally consistent', () => {
    for (const [name, profile] of Object.entries(ENGINE_QUALITY_PROFILES)) {
      expect(profile.preset).toBe(name);
      expect(profile.renderScale).toBeGreaterThan(0);
      expect(profile.label.length).toBeGreaterThan(0);
    }
  });
});

/* ----------------------------------------------------- adaptive control --- */

describe('adaptive frame controller', () => {
  const state = (partial: Partial<AdaptiveFrameState>): AdaptiveFrameState => ({
    avgFrameMs: 16.7,
    targetFrameMs: 16.7,
    renderScale: 1,
    preset: 'balanced',
    overWindows: 0,
    headroomWindows: 0,
    ...partial,
  });

  it('does nothing inside the hysteresis band', () => {
    expect(nextAdaptiveAction(state({})).kind).toBe('none');
    // Slightly hot but not yet sustained — still nothing.
    expect(nextAdaptiveAction(state({ avgFrameMs: 18, overWindows: 1 })).kind).toBe('none');
  });

  it('scales down after 3 sustained over-budget windows', () => {
    const action = nextAdaptiveAction(state({ avgFrameMs: 25, overWindows: 2 }));
    expect(action.kind).toBe('scale-down');
    expect(action.renderScale).toBeCloseTo(0.9, 5);
  });

  it('scales up after 8 sustained headroom windows', () => {
    const action = nextAdaptiveAction(state({ avgFrameMs: 9, headroomWindows: 7 }));
    expect(action.kind).toBe('scale-up');
    expect(action.renderScale).toBeCloseTo(1.1, 5);
  });

  it('steps the whole preset down when the scale floor is reached', () => {
    const action = nextAdaptiveAction(state({ avgFrameMs: 30, renderScale: 0.5, overWindows: 2 }));
    expect(action.kind).toBe('preset-down');
    expect(action.preset).toBe('performance');
  });

  it('steps the whole preset up when the scale ceiling is reached', () => {
    const action = nextAdaptiveAction(state({ avgFrameMs: 5, renderScale: 2, headroomWindows: 7 }));
    expect(action.kind).toBe('preset-up');
    expect(action.preset).toBe('quality');
  });

  it('stops at the extremes', () => {
    expect(
      nextAdaptiveAction(state({ avgFrameMs: 30, renderScale: 0.5, preset: 'performance', overWindows: 5 })).kind,
    ).toBe('none');
    expect(
      nextAdaptiveAction(state({ avgFrameMs: 5, renderScale: 2, preset: 'cinematic', headroomWindows: 9 })).kind,
    ).toBe('none');
  });

  it('computes frame budgets from power profile and operator cap', () => {
    expect(frameBudgetMs('balanced', 0)).toBeCloseTo(1000 / 60, 5);
    expect(frameBudgetMs('battery', 0)).toBeCloseTo(1000 / 30, 5);
    expect(frameBudgetMs('performance', 0)).toBeCloseTo(1000 / 240, 5);
    // An operator cap tightens the profile cap but never widens it.
    expect(frameBudgetMs('performance', 30)).toBeCloseTo(1000 / 30, 5);
    expect(frameBudgetMs('battery', 120)).toBeCloseTo(1000 / 30, 5);
  });
});

/* ------------------------------------------------------------- settings --- */

describe('settings normalization', () => {
  it('falls back to defaults on garbage', () => {
    expect(normalizeRenderEngineSettings(null)).toEqual(DEFAULT_RENDER_ENGINE_SETTINGS);
    expect(normalizeRenderEngineSettings('nope')).toEqual(DEFAULT_RENDER_ENGINE_SETTINGS);
    expect(normalizeRenderEngineSettings(42)).toEqual(DEFAULT_RENDER_ENGINE_SETTINGS);
  });

  it('clamps numbers and coerces enums', () => {
    const s = normalizeRenderEngineSettings({
      renderScale: 99,
      bloomIntensity: -5,
      toneMapping: 'bogus',
      antiAliasing: 'taa',
      msaaSamples: 3,
      shadowQuality: 'ultra',
      maxFrameRate: -10,
    });
    expect(s.renderScale).toBe(2);
    expect(s.bloomIntensity).toBe(0);
    expect(s.toneMapping).toBe('agx');
    expect(s.antiAliasing).toBe('taa');
    // Only 2 / 4 / 8 are legal MSAA sample counts; 3 rounds to the default 4.
    expect(s.msaaSamples).toBe(4);
    expect(s.shadowQuality).toBe('ultra');
    expect(s.maxFrameRate).toBe(0);
  });

  it('normalizes the nested grade and cinematic blocks', () => {
    const s = normalizeRenderEngineSettings({
      grade: { saturation: 99, exposure: 'x' },
      cinematic: { samples: 100000, bounces: 0, denoise: 'bogus' },
    });
    expect(s.grade.saturation).toBe(2);
    expect(s.grade.exposure).toBe(0);
    expect(s.cinematic.samples).toBe(4096);
    expect(s.cinematic.bounces).toBe(1);
    expect(s.cinematic.denoise).toBe('atrous');
  });

  it('drops unknown keys', () => {
    const s = normalizeRenderEngineSettings({ enabled: true, hackerMode: true });
    expect('hackerMode' in s).toBe(false);
    expect(s.enabled).toBe(true);
  });

  it('the store patches, normalizes, and resets', () => {
    const store = new RenderEngineSettingsStore({ quality: 'cinematic' });
    expect(store.get().quality).toBe('cinematic');
    const patched = store.patch({ renderScale: 0.4, toneMapping: 'aces' });
    expect(patched.renderScale).toBe(0.5);
    expect(patched.toneMapping).toBe('aces');
    store.reset();
    expect(store.get()).toEqual(DEFAULT_RENDER_ENGINE_SETTINGS);
  });

  it('notifies subscribers on patch', () => {
    const store = new RenderEngineSettingsStore({});
    let calls = 0;
    const unsub = store.subscribe(() => {
      calls += 1;
    });
    store.patch({ bloom: false });
    store.patch({ bloom: true });
    unsub();
    store.patch({ bloom: false });
    expect(calls).toBe(2);
  });
});

/* -------------------------------------------------------------- metrics --- */

describe('metrics', () => {
  it('averages frame times and derives FPS', () => {
    const metrics = new FrameMetrics();
    for (let i = 0; i < 10; i += 1) metrics.push(10);
    expect(metrics.avgFrameMs).toBeCloseTo(10, 5);
    expect(metrics.fps).toBeCloseTo(100, 5);
    expect(metrics.count).toBe(10);
  });

  it('ignores non-sense samples', () => {
    const metrics = new FrameMetrics();
    metrics.push(Number.NaN);
    metrics.push(-5);
    metrics.push(0);
    expect(metrics.count).toBe(0);
    expect(metrics.fps).toBe(0);
    expect(metrics.p95FrameMs).toBe(0);
  });

  it('reports the p95 stutter, not the average', () => {
    const metrics = new FrameMetrics();
    for (let i = 0; i < 95; i += 1) metrics.push(10);
    for (let i = 0; i < 5; i += 1) metrics.push(50);
    expect(metrics.p95FrameMs).toBeGreaterThanOrEqual(50);
  });

  it('formats bytes for the HUD', () => {
    expect(formatBytes(0)).toBe('—');
    expect(formatBytes(1024)).toBe('1 KB');
    // Large units keep one decimal for stable HUD width.
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(1536 * 1024 * 1024)).toBe('1.5 GB');
  });

  it('estimates VRAM monotonically', () => {
    const one = estimateVramBytes(null, DEFAULT_RENDER_ENGINE_SETTINGS, 1);
    const two = estimateVramBytes(null, DEFAULT_RENDER_ENGINE_SETTINGS, 2);
    const scaled = estimateVramBytes(null, { ...DEFAULT_RENDER_ENGINE_SETTINGS, renderScale: 2 }, 1);
    expect(one).toBeGreaterThan(0);
    expect(two).toBeGreaterThan(one);
    expect(scaled).toBeGreaterThan(one);
    expect(Number.isInteger(one)).toBe(true);
  });
});

/* ------------------------------------------------------- half encoding --- */

describe('half-float encoding', () => {
  it('encodes values for rgba16float uploads', () => {
    expect(toHalfFloat(0)).toBe(0);
    expect(toHalfFloat(1)).toBe(0x3c00);
    expect(toHalfFloat(2)).toBe(0x4000);
    expect(toHalfFloat(-1)).toBe(0xbc00);
    // Overflow saturates at the half-float max.
    expect(toHalfFloat(1e12)).toBe(0x7bff);
  });

  it('round-trips representative HDR values through Math', () => {
    const decode = (h: number): number => {
      const s = (h & 0x8000) >> 15;
      const e = (h & 0x7c00) >> 10;
      const f = h & 0x03ff;
      if (e === 0) return (s ? -1 : 1) * Math.pow(2, -14) * (f / Math.pow(2, 10));
      if (e === 0x1f) return f ? NaN : s ? -Infinity : Infinity;
      return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / Math.pow(2, 10));
    };
    for (const value of [0.001, 0.5, 1, 1.5, 3.25, 12, 100]) {
      expect(decode(toHalfFloat(value))).toBeCloseTo(value, 3);
    }
  });
});

/* -------------------------------------------------- BVH in a real scene --- */

describe('bvh + flattener integration', () => {
  it('ray casts agree between the BVH layout and brute force on the calibration scene', () => {
    const scene = buildCalibrationScene();
    const flat = flattenCinematicScene(scene);
    // Rebuild the world-space triangle list the BVH indexes into.
    const positions = positionsFromFlat(flat);
    const problems = validateBvh(flat.bvh, positions, flat.triCount);
    expect(problems).toEqual([]);

    // Cast a ray down the camera axis — the studio must be in front of it.
    const basis = cameraBasis(scene.camera);
    const hit = intersectSceneBruteForce(
      positions,
      flat.triCount,
      basis.position,
      basis.forward,
    );
    expect(hit).toBeGreaterThan(0);
    expect(Number.isFinite(hit)).toBe(true);
  });

  it('every BVH node either indexes children or a triangle range', () => {
    const positions = randomTriangles(50, 97);
    const bvh: FlattenedBvh = buildBvh(positions, 50, 2);
    for (let n = 0; n < bvh.nodeCount; n += 1) {
      const leftFirst = bvh.nodes[n * 8 + 3];
      const count = bvh.nodes[n * 8 + 7];
      if (count > 0) {
        expect(leftFirst + count).toBeLessThanOrEqual(bvh.indices.length);
      } else {
        const left = leftFirst;
        expect(left + 1).toBeLessThan(bvh.nodeCount);
      }
    }
  });
});
