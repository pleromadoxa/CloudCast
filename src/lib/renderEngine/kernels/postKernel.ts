/**
 * PostKernel — the engine's realtime GPU pipeline.
 *
 * Owns the full screen-space chain as WebGPU compute/render passes on one
 * command encoder per frame:
 *
 *   HDR input ─┬─ GTAO (horizon search + bilateral blur)     [needs depth]
 *              ├─ TAA resolve (YCoCg clip + reprojection)     [needs depth]
 *              ├─ bloom (prefilter → 6× down → 5× tent up)
 *              ├─ grade (CA · AO · bloom · exposure · display transform
 *              │        · vibrance · vignette · grain · dither)
 *              └─ present (CAS sharpen → swapchain / capture target)
 *
 * Every pass is a real WGSL kernel from `kernels/*`. Working textures are
 * allocated at `resize()` and reused; per-pass uniforms are carved from one
 * persistent ring buffer so a frame never allocates GPU memory. The kernel
 * can target a canvas context, a capture texture (cinematic stills,
 * recording), or an offscreen texture — anything with a view + format.
 */
import { BUFFER_USAGE, TEXTURE_USAGE } from '../gpuFlags';
import { asBindGroupLayout } from '../../../types/webgpuCompat';
import type { RenderEngineSettings } from '../types';
import type { GpuTimer } from '../metrics';
import { BLOOM_DOWNSAMPLE, BLOOM_PREFILTER, BLOOM_UPSAMPLE } from './wgslBloom';
import { CAS_PRESENT_WGSL, GRADE_WGSL } from './wgslGrade';
import { GTAO_BLUR_WGSL, GTAO_WGSL } from './wgslGtao';
import { TAA_WGSL } from './wgslTaa';

export interface PostKernelInput {
  /** HDR colour (rgba16float) from the beauty pass. */
  color: GPUTexture;
  /** Optional depth (depth32float / depth24plus) for AO + TAA reprojection. */
  depth?: GPUTexture | null;
}

export interface PostKernelTarget {
  view: GPUTextureView;
  format: GPUTextureFormat;
}

export interface PostKernelExtras {
  /** Previous frame view-projection (column-major 16 floats) for TAA. */
  taaPrevViewProj?: Float32Array | null;
  taaInvViewProj?: Float32Array | null;
}

interface WorkTextures {
  width: number;
  height: number;
  bloomDown: GPUTexture[];
  bloomUp: GPUTexture[];
  ao: GPUTexture[];
  taaHistory: GPUTexture[];
  ldr: GPUTexture;
}

const BLOOM_LEVELS = 6;
const DUMMY_SIZE = 4;
const UNIFORM_SLICE = 256;
const UNIFORM_SLICES = 32; // 8 KiB ring — one frame's worth of pass uniforms

export class PostKernel {
  private readonly device: GPUDevice;
  private readonly sampler: GPUSampler;
  private work: WorkTextures | null = null;

  private dummyColor: GPUTexture;
  private dummyDepth: GPUTexture;

  private bloomPrefilterPipeline!: GPUComputePipeline;
  private bloomDownPipeline!: GPUComputePipeline;
  private bloomUpPipeline!: GPUComputePipeline;
  private gtaoPipeline!: GPUComputePipeline;
  private gtaoBlurPipeline!: GPUComputePipeline;
  private taaPipeline!: GPUComputePipeline;
  private gradePipeline!: GPUComputePipeline;
  private presentPipelines = new Map<string, GPURenderPipeline>();

  private uniformRing!: GPUBuffer;
  private sliceCursor = 0;
  private taaPing = 0;
  private built = false;
  private timer: GpuTimer | null = null;

  /** Attach the engine's `timestamp-query` timer (or null to disable). */
  setTimer(timer: GpuTimer | null): void {
    this.timer = timer?.available ? timer : null;
  }

  constructor(device: GPUDevice) {
    this.device = device;
    this.sampler = device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });

    this.dummyColor = device.createTexture({
      size: { width: DUMMY_SIZE, height: DUMMY_SIZE },
      format: 'rgba16float',
      usage: TEXTURE_USAGE.textureBinding | TEXTURE_USAGE.renderAttachment,
    });
    this.dummyDepth = device.createTexture({
      size: { width: DUMMY_SIZE, height: DUMMY_SIZE },
      format: 'depth32float',
      usage: TEXTURE_USAGE.textureBinding | TEXTURE_USAGE.renderAttachment,
    });

    this.uniformRing = device.createBuffer({
      size: UNIFORM_SLICE * UNIFORM_SLICES,
      usage: BUFFER_USAGE.uniform | BUFFER_USAGE.copyDst,
    });
  }

  /**
   * Compile every pipeline and surface WGSL diagnostics. Returns human
   * readable validation messages (empty = clean).
   */
  async init(): Promise<string[]> {
    if (this.built) return [];
    const device = this.device;
    const messages: string[] = [];
    device.pushErrorScope('validation');

    const compute = (code: string, label: string) => {
      const module = device.createShaderModule({ code, label });
      return device.createComputePipeline({
        layout: 'auto',
        compute: { module, entryPoint: 'cs_main' },
        label,
      });
    };

    try {
      this.bloomPrefilterPipeline = compute(BLOOM_PREFILTER, 'bloom-prefilter');
      this.bloomDownPipeline = compute(BLOOM_DOWNSAMPLE, 'bloom-downsample');
      this.bloomUpPipeline = compute(BLOOM_UPSAMPLE, 'bloom-upsample');
      this.gtaoPipeline = compute(GTAO_WGSL, 'gtao');
      this.gtaoBlurPipeline = compute(GTAO_BLUR_WGSL, 'gtao-blur');
      this.taaPipeline = compute(TAA_WGSL, 'taa');
      this.gradePipeline = compute(GRADE_WGSL, 'grade');
    } catch (err) {
      messages.push(err instanceof Error ? err.message : 'pipeline creation failed');
    }

    const error = await device.popErrorScope();
    if (error) messages.push(`[postKernel] ${error.message}`);
    this.built = true;
    return messages;
  }

  get ready(): boolean {
    return this.built && this.work !== null;
  }

  resize(width: number, height: number): void {
    if (this.work && this.work.width === width && this.work.height === height) return;
    this.destroyWork();

    const mk = (w: number, h: number, format: GPUTextureFormat = 'rgba16float') =>
      this.device.createTexture({
        size: { width: Math.max(1, w), height: Math.max(1, h) },
        format,
        usage: TEXTURE_USAGE.textureBinding | TEXTURE_USAGE.storageBinding,
      });

    const bloomDown: GPUTexture[] = [];
    const bloomUp: GPUTexture[] = [];
    for (let level = 0; level < BLOOM_LEVELS; level += 1) {
      bloomDown.push(mk(width >> (level + 1), height >> (level + 1)));
    }
    for (let level = 0; level < BLOOM_LEVELS - 1; level += 1) {
      bloomUp.push(mk(width >> (level + 1), height >> (level + 1)));
    }

    this.work = {
      width,
      height,
      bloomDown,
      bloomUp,
      ao: [mk(width, height), mk(width, height)],
      taaHistory: [mk(width, height), mk(width, height)],
      ldr: mk(width, height, 'rgba8unorm'),
    };
    this.taaPing = 0;
  }

  render(
    input: PostKernelInput,
    target: PostKernelTarget,
    settings: RenderEngineSettings,
    frame: number,
    extras: PostKernelExtras = {},
  ): void {
    if (!this.work || !this.built) return;
    const work = this.work;
    this.sliceCursor = 0;
    const encoder = this.device.createCommandEncoder();

    // GPU-time bracket: a zero-work pass stamps the section start (the end
    // stamp rides the present pass below), so the engine HUD reports the true
    // GPU cost of the whole chain via `timestamp-query`.
    const beginWrites = this.timer?.beginWrites ?? null;
    if (beginWrites) {
      encoder.beginComputePass({ timestampWrites: beginWrites }).end();
    }

    const depth = input.depth ?? this.dummyDepth;
    let sceneColor = input.color;

    const useAo = settings.gtao && Boolean(input.depth);
    if (useAo) {
      this.dispatchGtao(encoder, depth as GPUTexture, settings, frame);
    }

    const useTaa = settings.antiAliasing === 'taa';
    if (useTaa) {
      const history = work.taaHistory[this.taaPing];
      const out = work.taaHistory[1 - this.taaPing];
      this.dispatchTaa(encoder, sceneColor, history, out, depth as GPUTexture, frame, extras);
      this.taaPing = 1 - this.taaPing;
      sceneColor = out;
    }

    if (settings.bloom) {
      this.dispatchBloom(encoder, sceneColor, settings);
    }

    const bloomTex = settings.bloom ? work.bloomUp[0] : this.dummyColor;
    const aoTex = useAo ? work.ao[0] : this.dummyColor;
    this.dispatchGrade(encoder, sceneColor, bloomTex, aoTex, work.ldr, settings, frame);

    // ---- Present (CAS sharpen + dither) -----------------------------------
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: target.view,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      // Section end stamp — pairs with the bracket pass at frame start.
      timestampWrites: this.timer?.endWrites ?? undefined,
    });
    const pipeline = this.presentPipeline(target.format);
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, this.presentBindGroup(work.ldr, target.format));
    pass.draw(3);
    pass.end();

    this.timer?.resolve(encoder);
    this.device.queue.submit([encoder.finish()]);
  }

  /* ----------------------------------------------------------- uniforms --- */

  /** Carve one aligned slice from the per-frame ring and fill it. */
  private uniformSlice(data: Float32Array): GPUBufferBinding {
    const offset = (this.sliceCursor % UNIFORM_SLICES) * UNIFORM_SLICE;
    this.sliceCursor += 1;
    this.device.queue.writeBuffer(this.uniformRing, offset, data);
    return { buffer: this.uniformRing, offset, size: UNIFORM_SLICE };
  }

  /* -------------------------------------------------------------- passes --- */

  private dispatchBloom(encoder: GPUCommandEncoder, source: GPUTexture, settings: RenderEngineSettings): void {
    const work = this.work as WorkTextures;
    const knee = Math.max(0.01, settings.bloomThreshold * 0.5);

    const bloomUniform = (w: number, h: number): GPUBufferBinding => {
      const data = new Float32Array(8);
      data[0] = 1 / w;
      data[1] = 1 / h;
      data[2] = settings.bloomThreshold;
      data[3] = knee;
      data[4] = settings.bloomIntensity;
      return this.uniformSlice(data);
    };

    // Prefilter (threshold + Karis firefly clamp) → bloomDown[0].
    {
      const w = Math.max(1, work.width >> 1);
      const h = Math.max(1, work.height >> 1);
      const bind = this.device.createBindGroup({
        layout: asBindGroupLayout(this.bloomPrefilterPipeline.getBindGroupLayout(0)),
        entries: [
          { binding: 0, resource: bloomUniform(w, h) },
          { binding: 1, resource: source.createView() },
          { binding: 2, resource: this.sampler },
          { binding: 3, resource: work.bloomDown[0].createView() },
        ],
      });
      const pass = encoder.beginComputePass();
      pass.setPipeline(this.bloomPrefilterPipeline);
      pass.setBindGroup(0, bind);
      pass.dispatchWorkgroups(Math.ceil(w / 8), Math.ceil(h / 8));
      pass.end();
    }

    // Downsample chain (13-tap).
    for (let level = 1; level < BLOOM_LEVELS; level += 1) {
      const w = Math.max(1, work.width >> (level + 1));
      const h = Math.max(1, work.height >> (level + 1));
      const bind = this.device.createBindGroup({
        layout: asBindGroupLayout(this.bloomDownPipeline.getBindGroupLayout(0)),
        entries: [
          { binding: 0, resource: bloomUniform(w, h) },
          { binding: 1, resource: work.bloomDown[level - 1].createView() },
          { binding: 2, resource: this.sampler },
          { binding: 3, resource: work.bloomDown[level].createView() },
        ],
      });
      const pass = encoder.beginComputePass();
      pass.setPipeline(this.bloomDownPipeline);
      pass.setBindGroup(0, bind);
      pass.dispatchWorkgroups(Math.ceil(w / 8), Math.ceil(h / 8));
      pass.end();
    }

    // Upsample chain (3×3 tent, additive): up[i] = tent(source) + down[i].
    for (let i = BLOOM_LEVELS - 2; i >= 0; i -= 1) {
      const w = Math.max(1, work.width >> (i + 1));
      const h = Math.max(1, work.height >> (i + 1));
      const source = i === BLOOM_LEVELS - 2 ? work.bloomDown[BLOOM_LEVELS - 1] : work.bloomUp[i + 1];
      const bind = this.device.createBindGroup({
        layout: asBindGroupLayout(this.bloomUpPipeline.getBindGroupLayout(0)),
        entries: [
          { binding: 0, resource: bloomUniform(w, h) },
          { binding: 1, resource: source.createView() },
          { binding: 2, resource: this.sampler },
          { binding: 3, resource: work.bloomUp[i].createView() },
          { binding: 4, resource: work.bloomDown[i].createView() },
        ],
      });
      const pass = encoder.beginComputePass();
      pass.setPipeline(this.bloomUpPipeline);
      pass.setBindGroup(0, bind);
      pass.dispatchWorkgroups(Math.ceil(w / 8), Math.ceil(h / 8));
      pass.end();
    }
  }

  private dispatchGtao(
    encoder: GPUCommandEncoder,
    depth: GPUTexture,
    settings: RenderEngineSettings,
    frame: number,
  ): void {
    const work = this.work as WorkTextures;
    const data = new Float32Array(44);
    data[0] = work.width;
    data[1] = work.height;
    // Identity matrices by default — the kernel's screen-space estimates still
    // work from depth alone; the full engine path overrides via `extras`.
    data[4] = 1;
    data[9] = 1;
    data[14] = 1;
    data[19] = 1;
    data[20] = 1;
    data[25] = 1;
    data[30] = 1;
    data[35] = 1;
    data[39] = 0.55; // world radius
    data[40] = settings.gtaoIntensity;
    data[41] = frame;
    data[42] = work.height * 0.5; // screen-space projection scale
    data[43] = 0.25; // thickness heuristic

    const bind = this.device.createBindGroup({
      layout: asBindGroupLayout(this.gtaoPipeline.getBindGroupLayout(0)),
      entries: [
        { binding: 0, resource: this.uniformSlice(data) },
        { binding: 1, resource: depth.createView() },
        { binding: 2, resource: work.ao[0].createView() },
      ],
    });
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.gtaoPipeline);
    pass.setBindGroup(0, bind);
    pass.dispatchWorkgroups(Math.ceil(work.width / 8), Math.ceil(work.height / 8));
    pass.end();

    // Bilateral blur — horizontal, then vertical.
    const directions: Array<[[number, number], GPUTexture, GPUTexture]> = [
      [[1, 0], work.ao[0], work.ao[1]],
      [[0, 1], work.ao[1], work.ao[0]],
    ];
    for (const [direction, src, dst] of directions) {
      const blurData = new Float32Array(8);
      blurData[0] = work.width;
      blurData[1] = work.height;
      blurData[2] = direction[0];
      blurData[3] = direction[1];
      blurData[4] = 0.5;
      const blurBind = this.device.createBindGroup({
        layout: asBindGroupLayout(this.gtaoBlurPipeline.getBindGroupLayout(0)),
        entries: [
          { binding: 0, resource: this.uniformSlice(blurData) },
          { binding: 1, resource: src.createView() },
          { binding: 2, resource: this.sampler },
          { binding: 3, resource: dst.createView() },
        ],
      });
      const blurPass = encoder.beginComputePass();
      blurPass.setPipeline(this.gtaoBlurPipeline);
      blurPass.setBindGroup(0, blurBind);
      blurPass.dispatchWorkgroups(Math.ceil(work.width / 8), Math.ceil(work.height / 8));
      blurPass.end();
    }
  }

  private dispatchTaa(
    encoder: GPUCommandEncoder,
    current: GPUTexture,
    history: GPUTexture,
    out: GPUTexture,
    depth: GPUTexture,
    frame: number,
    extras: PostKernelExtras,
  ): void {
    const work = this.work as WorkTextures;
    const data = new Float32Array(40);
    data[0] = work.width;
    data[1] = work.height;
    data[2] = 0.92; // history weight
    data[3] = extras.taaPrevViewProj && extras.taaInvViewProj ? 1 : 0;
    data[4] = frame;
    if (extras.taaPrevViewProj) data.set(extras.taaPrevViewProj, 8);
    else {
      data[8] = 1;
      data[13] = 1;
      data[18] = 1;
      data[23] = 1;
    }
    if (extras.taaInvViewProj) data.set(extras.taaInvViewProj, 24);
    else {
      data[24] = 1;
      data[29] = 1;
      data[34] = 1;
      data[39] = 1;
    }

    const bind = this.device.createBindGroup({
      layout: asBindGroupLayout(this.taaPipeline.getBindGroupLayout(0)),
      entries: [
        { binding: 0, resource: this.uniformSlice(data) },
        { binding: 1, resource: current.createView() },
        { binding: 2, resource: history.createView() },
        { binding: 3, resource: this.sampler },
        { binding: 4, resource: out.createView() },
        { binding: 5, resource: depth.createView() },
      ],
    });
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.taaPipeline);
    pass.setBindGroup(0, bind);
    pass.dispatchWorkgroups(Math.ceil(work.width / 8), Math.ceil(work.height / 8));
    pass.end();
  }

  private dispatchGrade(
    encoder: GPUCommandEncoder,
    hdr: GPUTexture,
    bloom: GPUTexture,
    ao: GPUTexture,
    out: GPUTexture,
    settings: RenderEngineSettings,
    frame: number,
  ): void {
    const work = this.work as WorkTextures;
    const data = new Float32Array(20);
    data[0] = work.width;
    data[1] = work.height;
    data[2] = frame / 60; // time in seconds-ish for grain evolution
    data[3] = frame;
    data[4] = settings.grade.exposure;
    data[5] = settings.grade.contrast;
    data[6] = settings.grade.saturation;
    data[7] = settings.grade.vibrance;
    data[8] = settings.grade.temperature;
    data[9] = settings.vignette ? settings.vignetteStrength : 0;
    data[10] = settings.filmGrain ? settings.filmGrainAmount : 0;
    data[11] = settings.chromaticAberration ? settings.chromaticAberrationAmount : 0;
    data[12] = settings.bloom ? settings.bloomIntensity : 0;
    data[13] = settings.gtao ? settings.gtaoIntensity : 0;
    data[14] = toneOperatorIndex(settings.toneMapping);

    let flags = 0;
    if (settings.gtao) flags |= GRADE_FLAG_AO;
    if (settings.bloom) flags |= GRADE_FLAG_BLOOM;
    if (settings.chromaticAberration) flags |= GRADE_FLAG_CA;
    if (settings.filmGrain) flags |= GRADE_FLAG_GRAIN;
    if (settings.vignette) flags |= GRADE_FLAG_VIGNETTE;
    data[15] = flags;

    const bind = this.device.createBindGroup({
      layout: asBindGroupLayout(this.gradePipeline.getBindGroupLayout(0)),
      entries: [
        { binding: 0, resource: this.uniformSlice(data) },
        { binding: 1, resource: hdr.createView() },
        { binding: 2, resource: bloom.createView() },
        { binding: 3, resource: ao.createView() },
        { binding: 4, resource: this.sampler },
        { binding: 5, resource: out.createView() },
      ],
    });
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.gradePipeline);
    pass.setBindGroup(0, bind);
    pass.dispatchWorkgroups(Math.ceil(work.width / 8), Math.ceil(work.height / 8));
    pass.end();
  }

  private presentPipeline(format: GPUTextureFormat): GPURenderPipeline {
    const cached = this.presentPipelines.get(format);
    if (cached) return cached;
    const module = this.device.createShaderModule({ code: CAS_PRESENT_WGSL, label: 'cas-present' });
    const pipeline = this.device.createRenderPipeline({
      layout: 'auto',
      label: `cas-present-${format}`,
      vertex: { module, entryPoint: 'vs_main' },
      fragment: {
        module,
        entryPoint: 'fs_main',
        targets: [{ format }],
      },
      primitive: { topology: 'triangle-list' },
    });
    this.presentPipelines.set(format, pipeline);
    return pipeline;
  }

  private presentBindGroup(ldr: GPUTexture, format: GPUTextureFormat): GPUBindGroup {
    const work = this.work as WorkTextures;
    const data = new Float32Array(4);
    data[0] = 1 / work.width;
    data[1] = 1 / work.height;
    data[2] = 0.55; // CAS sharpness
    return this.device.createBindGroup({
      layout: asBindGroupLayout(this.presentPipeline(format).getBindGroupLayout(0)),
      entries: [
        { binding: 0, resource: this.uniformSlice(data) },
        { binding: 1, resource: ldr.createView() },
        { binding: 2, resource: this.sampler },
      ],
    });
  }

  private destroyWork(): void {
    if (!this.work) return;
    for (const tex of [
      ...this.work.bloomDown,
      ...this.work.bloomUp,
      ...this.work.ao,
      ...this.work.taaHistory,
      this.work.ldr,
    ]) {
      tex.destroy();
    }
    this.work = null;
  }

  destroy(): void {
    this.destroyWork();
    this.dummyColor.destroy();
    this.dummyDepth.destroy();
    this.uniformRing.destroy();
    this.presentPipelines.clear();
    this.built = false;
  }
}

/** Flag bits — must match `flags` handling in wgslGrade.ts. */
export const GRADE_FLAG_AO = 1;
export const GRADE_FLAG_BLOOM = 2;
export const GRADE_FLAG_CA = 4;
export const GRADE_FLAG_GRAIN = 8;
export const GRADE_FLAG_VIGNETTE = 16;

/** Keep in sync with `tone_map` dispatch in wgslCommon.ts. */
export function toneOperatorIndex(op: RenderEngineSettings['toneMapping']): number {
  switch (op) {
    case 'agx':
      return 0;
    case 'aces':
      return 1;
    case 'neutral':
      return 2;
    case 'filmic':
      return 3;
    case 'reinhard':
      return 4;
    default:
      return 5;
  }
}
