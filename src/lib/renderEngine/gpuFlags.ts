/**
 * WebGPU usage / stage flag values.
 *
 * TypeScript's DOM lib ships the *types* for WebGPU but not the runtime enum
 * objects (`GPUBufferUsage`, `GPUTextureUsage`, `GPUShaderStage`, …), so the
 * spec values are spelled out here (same approach as the motion backdrop
 * renderer). Kept in one place so every kernel in the engine agrees.
 */

export const BUFFER_USAGE = {
  mapRead: 0x0001,
  mapWrite: 0x0002,
  copySrc: 0x0004,
  copyDst: 0x0008,
  index: 0x0010,
  vertex: 0x0020,
  uniform: 0x0040,
  storage: 0x0080,
  indirect: 0x0100,
  queryResolve: 0x0200,
} as const;

export const TEXTURE_USAGE = {
  copySrc: 0x0001,
  copyDst: 0x0002,
  textureBinding: 0x0004,
  storageBinding: 0x0008,
  renderAttachment: 0x0010,
} as const;

export const SHADER_STAGE = {
  vertex: 0x0001,
  fragment: 0x0002,
  compute: 0x0004,
} as const;

export const MAP_MODE = {
  read: 0x0001,
} as const;

export const QUERY_TYPE_TIMESTAMP = 'timestamp' as const;

/**
 * The complete standardized `GPUFeatureName` set (WebGPU spec, 2026 revision).
 * The engine probes the intersection of this list with the adapter's features
 * and requests everything useful — kernels can then rely on `device.features`.
 */
export const KNOWN_WEBGPU_FEATURES = [
  'core-features-and-limits',
  'depth-clip-control',
  'depth32float-stencil8',
  'texture-compression-bc',
  'texture-compression-bc-sliced-3d',
  'texture-compression-etc2',
  'texture-compression-astc',
  'texture-compression-astc-sliced-3d',
  'timestamp-query',
  'indirect-first-instance',
  'shader-f16',
  'rg11b10ufloat-renderable',
  'bgra8unorm-storage',
  'float32-filterable',
  'float32-blendable',
  'clip-distances',
  'dual-source-blending',
  'subgroups',
  'subgroup-size-control',
  'texture-formats-tier1',
  'texture-formats-tier2',
  'primitive-index',
  'texture-component-swizzle',
] as const;

export type KnownWebGpuFeature = (typeof KNOWN_WEBGPU_FEATURES)[number];

/**
 * Features the engine will always request when the adapter offers them.
 * Each one is consumed by a specific kernel:
 * - `timestamp-query`      → GPU kernel timing in the metrics HUD
 * - `float32-filterable`   → path-tracer accumulation / HDR sampling
 * - `shader-f16`           → half-precision kernel variants
 * - `subgroups`            → fast reductions in bloom / denoiser kernels
 * - `texture-compression-*`→ compressed material & environment textures
 * - `bgra8unorm-storage`   → direct storage writes to preferred canvas format
 * - `rg11b10ufloat-renderable` → cheaper HDR render targets
 */
export const DESIRED_WEBGPU_FEATURES: readonly string[] = [
  'timestamp-query',
  'float32-filterable',
  'float32-blendable',
  'shader-f16',
  'subgroups',
  'subgroup-size-control',
  'texture-compression-bc',
  'texture-compression-etc2',
  'texture-compression-astc',
  'bgra8unorm-storage',
  'rg11b10ufloat-renderable',
  'depth-clip-control',
  'depth32float-stencil8',
  'indirect-first-instance',
  'texture-formats-tier1',
  'texture-formats-tier2',
  'texture-component-swizzle',
  'primitive-index',
];

/** Limit keys the engine reads for its capability report. */
export const TRACKED_LIMITS = [
  'maxTextureDimension2D',
  'maxTextureDimension3D',
  'maxTextureArrayLayers',
  'maxBindGroups',
  'maxBindGroupsPlusVertexBuffers',
  'maxBindingsPerBindGroup',
  'maxDynamicUniformBuffersPerPipelineLayout',
  'maxSampledTexturesPerShaderStage',
  'maxSamplersPerShaderStage',
  'maxStorageBuffersPerShaderStage',
  'maxStorageTexturesPerShaderStage',
  'maxUniformBuffersPerShaderStage',
  'maxUniformBufferBindingSize',
  'maxStorageBufferBindingSize',
  'minUniformBufferOffsetAlignment',
  'minStorageBufferOffsetAlignment',
  'maxVertexBuffers',
  'maxBufferSize',
  'maxVertexAttributes',
  'maxInterStageShaderVariables',
  'maxColorAttachments',
  'maxColorAttachmentBytesPerSample',
  'maxComputeWorkgroupStorageSize',
  'maxComputeInvocationsPerWorkgroup',
  'maxComputeWorkgroupSizeX',
  'maxComputeWorkgroupSizeY',
  'maxComputeWorkgroupSizeZ',
  'maxComputeWorkgroupsPerDimension',
] as const;

/** Read a limit value defensively — browsers differ in which keys exist. */
export function readLimit(limits: unknown, key: string): number {
  const value = (limits as Record<string, unknown> | undefined)?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Requested limits for `adapter.requestDevice`. We ask for large-but-sane
 * ceilings so heavy kernels (path tracer buffers, 8K plates) never hit the
 * baseline minimums, while never requesting more than the adapter has.
 */
export function requestedLimits(adapterLimits: unknown): Record<string, number> {
  const wanted: Array<[string, number]> = [
    ['maxTextureDimension2D', 8192],
    ['maxTextureDimension3D', 2048],
    ['maxTextureArrayLayers', 256],
    ['maxBufferSize', 512 * 1024 * 1024],
    ['maxStorageBufferBindingSize', 256 * 1024 * 1024],
    ['maxUniformBufferBindingSize', 64 * 1024],
    ['maxStorageBuffersPerShaderStage', 12],
    ['maxSampledTexturesPerShaderStage', 16],
    ['maxColorAttachments', 8],
  ];
  const out: Record<string, number> = {};
  for (const [key, ask] of wanted) {
    const have = readLimit(adapterLimits, key);
    // Requesting above the adapter's max fails device creation — clamp to it.
    out[key] = have > 0 ? Math.min(ask, have) : ask;
  }
  return out;
}
