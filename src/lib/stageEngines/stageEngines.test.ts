import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STAGE_ENGINE,
  DEFAULT_STAGE_ENGINE_SETTINGS,
  fallbackFor,
  getStageEngine,
  interactiveStageEngines,
  listStageEngines,
  normalizeStageEngineSettings,
  probeStageEngines,
  resolveActiveEngine,
  stageEngineHas,
  STAGE_ENGINE_ORDER,
} from './index';
import type { StageEngineAvailability, StageProbeInput } from './index';

const DESKTOP: StageProbeInput = {
  webgpu: true,
  webgl2: true,
  webrtc: true,
  hardwareAdapter: true,
  deviceMemoryGiB: 16,
  isMobile: false,
  unrealConfigured: true,
};

const LEGACY: StageProbeInput = {
  webgpu: false,
  webgl2: true,
  webrtc: true,
  hardwareAdapter: false,
  deviceMemoryGiB: 4,
  isMobile: false,
  unrealConfigured: false,
};

const WEBGPU_ONLY: StageProbeInput = {
  webgpu: true,
  webgl2: false,
  webrtc: false,
  hardwareAdapter: true,
  deviceMemoryGiB: 8,
  isMobile: true,
  unrealConfigured: false,
};

describe('stage engine registry', () => {
  it('exposes every engine in presentation order', () => {
    expect(STAGE_ENGINE_ORDER).toHaveLength(4);
    expect(listStageEngines().map((e) => e.id)).toEqual(STAGE_ENGINE_ORDER);
  });

  it('describes each engine completely', () => {
    for (const engine of listStageEngines()) {
      expect(engine.name.length).toBeGreaterThan(0);
      expect(engine.tagline.length).toBeGreaterThan(0);
      expect(engine.description.length).toBeGreaterThan(40);
      expect(engine.capabilities.length).toBeGreaterThan(0);
      expect(engine.requires.length).toBeGreaterThan(0);
      expect(engine.docsUrl).toMatch(/^https:\/\//);
    }
  });

  it('keeps the interactive set to real stage renderers', () => {
    const interactive = interactiveStageEngines().map((e) => e.id);
    expect(interactive).toEqual(['prism-three', 'prism-babylon', 'unreal-pixelstream']);
  });

  it('reports capabilities honestly', () => {
    expect(stageEngineHas('prism-three', 'ibl-hdr')).toBe(true);
    expect(stageEngineHas('prism-babylon', 'pbr')).toBe(true);
    expect(stageEngineHas('unreal-pixelstream', 'webrtc')).toBe(true);
    expect(stageEngineHas('wgsl-native', 'path-tracing')).toBe(true);
    expect(stageEngineHas('wgsl-native', 'webrtc')).toBe(false);
  });

  it('falls back to the other browser engine', () => {
    expect(fallbackFor('prism-three')).toBe('prism-babylon');
    expect(fallbackFor('prism-babylon')).toBe('prism-three');
    expect(getStageEngine(DEFAULT_STAGE_ENGINE).id).toBe(DEFAULT_STAGE_ENGINE);
  });
});

describe('stage engine settings', () => {
  it('normalizes a corrupt payload into a usable configuration', () => {
    const normalized = normalizeStageEngineSettings({
      engine: 'not-an-engine' as never,
      babylon: { msaaSamples: 3, environmentIntensity: 99, antiAliasing: 'ssaa' as never },
      unreal: { resolution: '8k' as never, quality: 'ultra' as never, signallingUrl: 42 as never },
    });
    expect(normalized.engine).toBe(DEFAULT_STAGE_ENGINE);
    expect(normalized.babylon.msaaSamples).toBe(4);
    expect(normalized.babylon.environmentIntensity).toBe(4);
    expect(normalized.babylon.antiAliasing).toBe('msaa');
    expect(normalized.unreal.resolution).toBe('1920x1080');
    expect(normalized.unreal.quality).toBe('epic');
    expect(normalized.unreal.signallingUrl).toBe('ws://72.61.95.36:8091');
  });

  it('never lets the fallback equal the primary engine', () => {
    const normalized = normalizeStageEngineSettings({
      engine: 'prism-babylon',
      fallbackEngine: 'prism-babylon',
    });
    expect(normalized.fallbackEngine).toBe('prism-three');
  });

  it('clamps numeric tuning into physical ranges', () => {
    const normalized = normalizeStageEngineSettings({
      babylon: { bloomIntensity: -5, exposure: 12, contrast: 0, shadowMapSize: 123 },
    });
    expect(normalized.babylon.bloomIntensity).toBe(0);
    expect(normalized.babylon.exposure).toBe(4);
    expect(normalized.babylon.contrast).toBe(0.5);
    expect(normalized.babylon.shadowMapSize).toBe(2048);
  });

  it('round-trips through defaults without loss', () => {
    const normalized = normalizeStageEngineSettings(DEFAULT_STAGE_ENGINE_SETTINGS);
    expect(normalized).toEqual(DEFAULT_STAGE_ENGINE_SETTINGS);
  });
});

describe('stage engine probe', () => {
  it('enables the WebGL engines and reports the WebGPU preference', async () => {
    const results = await probeStageEngines(undefined, DESKTOP);
    const byId = new Map(results.map((r) => [r.id, r]));
    expect(byId.get('prism-three')?.available).toBe(true);
    expect(byId.get('prism-babylon')?.available).toBe(true);
    expect(byId.get('unreal-pixelstream')?.available).toBe(true);
    expect(byId.get('wgsl-native')?.available).toBe(true);
    expect(results.filter((r) => r.recommended)).toHaveLength(1);
  });

  it('disables the kernel engine without WebGPU', async () => {
    const results = await probeStageEngines(undefined, LEGACY);
    const byId = new Map(results.map((r) => [r.id, r]));
    expect(byId.get('wgsl-native')?.available).toBe(false);
    expect(byId.get('wgsl-native')?.reason).toMatch(/WebGPU/);
    expect(byId.get('prism-three')?.available).toBe(true);
  });

  it('requires a configured signalling URL for Unreal', async () => {
    const unconfigured = await probeStageEngines(undefined, {
      ...DESKTOP,
      unrealConfigured: false,
    });
    const unreal = unconfigured.find((r) => r.id === 'unreal-pixelstream');
    expect(unreal?.available).toBe(false);
    expect(unreal?.reason).toMatch(/signalling/i);
  });

  it('survives a device with no GPU path at all', async () => {
    const results = await probeStageEngines(undefined, {
      ...LEGACY,
      webgl2: false,
      webrtc: false,
    });
    expect(results.every((r) => !r.available)).toBe(true);
  });

  it('recommends the better-scoring interactive engine', async () => {
    const results = await probeStageEngines(undefined, WEBGPU_ONLY);
    const recommended = results.find((r) => r.recommended);
    expect(recommended?.id === 'prism-three' || recommended?.id === 'prism-babylon').toBe(true);
    expect(results.find((r) => r.id === 'prism-babylon')?.headroomScore).toBeGreaterThan(0);
  });
});

describe('resolveActiveEngine', () => {
  const available: StageEngineAvailability[] = [
    { id: 'prism-three', available: true, reason: null, recommended: true, headroomScore: 90 },
    { id: 'prism-babylon', available: true, reason: null, recommended: false, headroomScore: 88 },
    { id: 'unreal-pixelstream', available: false, reason: 'needs host', recommended: false, headroomScore: 0 },
    { id: 'wgsl-native', available: false, reason: 'needs WebGPU', recommended: false, headroomScore: 0 },
  ];

  it('honours the operator choice when it can run', () => {
    expect(resolveActiveEngine('prism-babylon', 'prism-three', true, available)).toBe('prism-babylon');
  });

  it('falls back automatically when the choice cannot run', () => {
    expect(resolveActiveEngine('unreal-pixelstream', 'prism-three', true, available)).toBe('prism-three');
  });

  it('keeps the operator choice when auto-fallback is off', () => {
    expect(resolveActiveEngine('unreal-pixelstream', 'prism-three', false, available)).toBe(
      'unreal-pixelstream',
    );
  });
});
