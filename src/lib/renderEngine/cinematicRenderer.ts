/**
 * Cinematic renderer — the engine's offline tier.
 *
 * Drives the WGSL path tracer to convergence, denoises with the SVGF-style
 * à-trous filter, then runs the image through the same PostKernel grade the
 * realtime path uses (AgX / ACES display transform, bloom, vignette, grain).
 * Produces pixel readbacks / PNG blobs for captured artifacts — photoreal
 * stills of the app's scenes, the calibration studio, or anything with a
 * triangle soup.
 *
 * Rendering is progressive and interruptible: one sample per pixel per
 * dispatch, so the caller can show live previews and abort mid-render.
 */
import { BUFFER_USAGE, MAP_MODE, TEXTURE_USAGE } from './gpuFlags';
import { asBindGroupLayout } from '../../types/webgpuCompat';
import type { DenoiserMode, RenderEngineSettings } from './types';
import { PostKernel } from './kernels/postKernel';
import { RESOLVE_WGSL, ATROUS_WGSL } from './kernels/wgslDenoise';
import { PATH_TRACE_WGSL } from './kernels/wgslPathTrace';
import { buildEnvironmentCdf, cameraBasis, flattenCinematicScene, proceduralEnvironment } from './pathTracer/scene';
import type { CinematicScene } from './pathTracer/scene';

export interface CinematicRenderOptions {
  width: number;
  height: number;
  samples: number;
  bounces: number;
  denoise: DenoiserMode;
  envIntensity: number;
  settings: RenderEngineSettings;
  onProgress?: (samplesDone: number, samplesTarget: number) => void;
  abortSignal?: { aborted: boolean };
  /** Samples accumulated per GPU dispatch (latency/throughput knob). */
  samplesPerDispatch?: number;
}

export interface CinematicResult {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  samples: number;
  elapsedMs: number;
}

/** f32 → f32 in the half-float encoding, for rgba16float uploads. */
export function toHalfFloat(value: number): number {
  const floatView = new Float32Array(1);
  const int32View = new Int32Array(floatView.buffer);
  floatView[0] = value;
  const x = int32View[0];
  const bits = (x >> 16) & 0x8000;
  let m = (x >> 12) & 0x07ff;
  const e = (x >> 23) & 0xff;
  if (e < 103) return bits;
  // Overflow saturates at the half-float max rather than producing ±Inf:
  // one Inf texel would poison the path tracer's accumulation forever.
  if (e > 142) return bits | 0x7bff;
  if (e < 113) {
    m |= 0x0800;
    return bits | ((m >> (114 - e)) + ((m >> (113 - e)) & 1));
  }
  return bits | ((e - 112) << 10) + (m >> 1) + ((m >> 0) & 1);
}

export class CinematicRenderer {
  private pipelineTrace: GPUComputePipeline | null = null;
  private pipelineResolve: GPUComputePipeline | null = null;
  private pipelineAtrous: GPUComputePipeline | null = null;
  private built = false;
  private readonly device: GPUDevice;
  private readonly postKernel: PostKernel;

  constructor(device: GPUDevice, postKernel: PostKernel) {
    this.device = device;
    this.postKernel = postKernel;
  }

  async init(): Promise<string[]> {
    if (this.built) return [];
    const messages: string[] = [];
    this.device.pushErrorScope('validation');
    try {
      const compute = (code: string, label: string) =>
        this.device.createComputePipeline({
          layout: 'auto',
          label,
          compute: { module: this.device.createShaderModule({ code, label }), entryPoint: 'cs_main' },
        });
      this.pipelineTrace = compute(PATH_TRACE_WGSL, 'path-trace');
      this.pipelineResolve = compute(RESOLVE_WGSL, 'path-resolve');
      this.pipelineAtrous = compute(ATROUS_WGSL, 'path-atrous');
    } catch (err) {
      messages.push(err instanceof Error ? err.message : 'path tracer pipeline creation failed');
    }
    const error = await this.device.popErrorScope();
    if (error) messages.push(`[cinematic] ${error.message}`);
    this.built = true;
    return messages;
  }

  /**
   * Render a scene to display-referred 8-bit pixels (sRGB).
   */
  async render(scene: CinematicScene, options: CinematicRenderOptions): Promise<CinematicResult> {
    if (!this.pipelineTrace || !this.pipelineResolve || !this.pipelineAtrous) {
      await this.init();
    }
    const started = Date.now();
    const { width, height } = options;
    const flat = flattenCinematicScene(scene);
    const env = scene.environment ?? proceduralEnvironment();
    const envCdf = buildEnvironmentCdf(env);
    const basis = cameraBasis(scene.camera);

    const device = this.device;
    const mkStorage = (data: Float32Array | Uint32Array, label: string) => {
      const buffer = device.createBuffer({
        size: Math.max(4, data.byteLength),
        usage: BUFFER_USAGE.storage | BUFFER_USAGE.copyDst,
        label,
      });
      device.queue.writeBuffer(buffer, 0, data.buffer, data.byteOffset, data.byteLength);
      return buffer;
    };

    const triVertices = mkStorage(flat.triVertices, 'tri-vertices');
    const triEdges = mkStorage(flat.triEdges, 'tri-edges');
    const triNormals = mkStorage(flat.triNormals, 'tri-normals');
    const materials = mkStorage(flat.materials, 'materials');
    const bvhNodes = mkStorage(flat.bvh.nodes, 'bvh-nodes');

    // BVH leaf indices with the emissive list appended (WGSL reads it there).
    const triIndices = new Uint32Array(flat.bvh.indices.length + flat.emissiveTris.length);
    triIndices.set(flat.bvh.indices, 0);
    triIndices.set(flat.emissiveTris, flat.bvh.indices.length);
    const triIndexBuffer = mkStorage(triIndices, 'tri-indices');

    const pixelCount = width * height;
    const accum = device.createBuffer({
      size: pixelCount * 32,
      usage: BUFFER_USAGE.storage | BUFFER_USAGE.copyDst,
      label: 'path-accum',
    });
    const gbuffer = device.createBuffer({
      size: pixelCount * 16,
      usage: BUFFER_USAGE.storage | BUFFER_USAGE.copyDst,
      label: 'path-gbuffer',
    });

    // ---- Environment textures ---------------------------------------------
    const envPixels = new Uint16Array(env.width * env.height * 4);
    for (let i = 0; i < env.width * env.height; i += 1) {
      envPixels[i * 4] = toHalfFloat(env.pixels[i * 3] * options.envIntensity);
      envPixels[i * 4 + 1] = toHalfFloat(env.pixels[i * 3 + 1] * options.envIntensity);
      envPixels[i * 4 + 2] = toHalfFloat(env.pixels[i * 3 + 2] * options.envIntensity);
      envPixels[i * 4 + 3] = toHalfFloat(1);
    }
    const envTexture = device.createTexture({
      size: { width: env.width, height: env.height },
      format: 'rgba16float',
      usage: TEXTURE_USAGE.textureBinding | TEXTURE_USAGE.copyDst,
      label: 'env',
    });
    device.queue.writeTexture(
      { texture: envTexture },
      envPixels,
      { bytesPerRow: env.width * 8, rowsPerImage: env.height },
      { width: env.width, height: env.height },
    );

    const cdfTexture = (data: Float32Array, w: number, h: number, label: string) => {
      const texture = device.createTexture({
        size: { width: w, height: h },
        format: 'r32float',
        usage: TEXTURE_USAGE.textureBinding | TEXTURE_USAGE.copyDst,
        label,
      });
      device.queue.writeTexture(
        { texture },
        data,
        { bytesPerRow: w * 4, rowsPerImage: h },
        { width: w, height: h },
      );
      return texture;
    };
    const cdfRows = cdfTexture(envCdf.rows, env.width, env.height, 'env-cdf-rows');
    const cdfMarg = cdfTexture(envCdf.marginal, env.height, 1, 'env-cdf-marg');
    const envPdf = cdfTexture(envCdf.pdf, env.width, env.height, 'env-pdf');

    const envSampler = device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'repeat',
      addressModeV: 'clamp-to-edge',
    });

    // ---- Resolve / denoise targets ----------------------------------------
    const mkRw = (label: string) =>
      device.createTexture({
        size: { width, height },
        format: 'rgba16float',
        usage: TEXTURE_USAGE.textureBinding | TEXTURE_USAGE.storageBinding,
        label,
      });
    const colorTex = mkRw('path-color');
    const auxTex = mkRw('path-aux');
    const normalTex = mkRw('path-normal');
    const denoisePing = mkRw('path-denoise-a');
    const denoisePong = mkRw('path-denoise-b');

    // ---- Accumulation loop -------------------------------------------------
    const samplesPerDispatch = Math.max(1, options.samplesPerDispatch ?? 2);
    const dispatches = Math.max(1, Math.ceil(options.samples / samplesPerDispatch));
    const uniformBuffer = device.createBuffer({
      size: 96,
      usage: BUFFER_USAGE.uniform | BUFFER_USAGE.copyDst,
      label: 'path-uniforms',
    });
    const uniformData = new Float32Array(24);
    const uniformU32 = new Uint32Array(uniformData.buffer);
    uniformData[0] = basis.position[0];
    uniformData[1] = basis.position[1];
    uniformData[2] = basis.position[2];
    uniformData[3] = basis.tanHalfFov;
    uniformData[4] = basis.right[0];
    uniformData[5] = basis.right[1];
    uniformData[6] = basis.right[2];
    uniformData[7] = width;
    uniformData[8] = basis.up[0];
    uniformData[9] = basis.up[1];
    uniformData[10] = basis.up[2];
    uniformData[11] = height;
    uniformData[12] = basis.forward[0];
    uniformData[13] = basis.forward[1];
    uniformData[14] = basis.forward[2];
    uniformData[15] = 0; // frame
    uniformData[16] = 1; // env intensity baked into texture already
    uniformU32[17] = Math.max(1, options.bounces);
    uniformU32[18] = samplesPerDispatch;
    uniformU32[19] = flat.triCount;
    uniformU32[20] = flat.emissiveTris.length;
    uniformU32[21] = env.width;
    uniformU32[22] = env.height;
    uniformU32[23] = 1; // reset accum on first frame

    const traceBindGroup = device.createBindGroup({
      layout: asBindGroupLayout(this.pipelineTrace!.getBindGroupLayout(0)),
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: { buffer: triVertices } },
        { binding: 2, resource: { buffer: triEdges } },
        { binding: 3, resource: { buffer: triNormals } },
        { binding: 4, resource: { buffer: materials } },
        { binding: 5, resource: { buffer: bvhNodes } },
        { binding: 6, resource: { buffer: triIndexBuffer } },
        { binding: 7, resource: envTexture.createView() },
        { binding: 8, resource: envSampler },
        { binding: 9, resource: cdfRows.createView() },
        { binding: 10, resource: cdfMarg.createView() },
        { binding: 11, resource: envPdf.createView() },
        { binding: 12, resource: { buffer: accum } },
        { binding: 13, resource: { buffer: gbuffer } },
      ],
    });

    const groupsX = Math.ceil(width / 8);
    const groupsY = Math.ceil(height / 8);

    for (let frame = 0; frame < dispatches; frame += 1) {
      if (options.abortSignal?.aborted) break;
      uniformData[15] = frame;
      uniformU32[23] = frame === 0 ? 1 : 0;
      device.queue.writeBuffer(uniformBuffer, 0, uniformData);

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(this.pipelineTrace!);
      pass.setBindGroup(0, traceBindGroup);
      pass.dispatchWorkgroups(groupsX, groupsY);
      pass.end();
      device.queue.submit([encoder.finish()]);

      const done = Math.min((frame + 1) * samplesPerDispatch, options.samples);
      options.onProgress?.(done, options.samples);
      // Yield to the browser between dispatches — keeps the UI responsive and
      // lets the swapchain breathe during long renders.
      if (frame < dispatches - 1) await nextTick();
    }

    // ---- Resolve → G-buffer textures --------------------------------------
    const resolveBuffer = device.createBuffer({
      size: 16,
      usage: BUFFER_USAGE.uniform | BUFFER_USAGE.copyDst,
    });
    const resolveData = new Float32Array(4);
    resolveData[0] = width;
    resolveData[1] = height;
    device.queue.writeBuffer(resolveBuffer, 0, resolveData);
    const resolveBind = device.createBindGroup({
      layout: asBindGroupLayout(this.pipelineResolve!.getBindGroupLayout(0)),
      entries: [
        { binding: 0, resource: { buffer: resolveBuffer } },
        { binding: 1, resource: { buffer: accum } },
        { binding: 2, resource: { buffer: gbuffer } },
        { binding: 3, resource: colorTex.createView() },
        { binding: 4, resource: auxTex.createView() },
        { binding: 5, resource: normalTex.createView() },
      ],
    });
    {
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(this.pipelineResolve!);
      pass.setBindGroup(0, resolveBind);
      pass.dispatchWorkgroups(groupsX, groupsY);
      pass.end();
      device.queue.submit([encoder.finish()]);
    }

    // ---- À-trous denoise ---------------------------------------------------
    if (options.denoise === 'atrous') {
      let read = colorTex;
      let write = denoisePing;
      for (let step = 0; step < 3; step += 1) {
        const uniform = device.createBuffer({ size: 32, usage: BUFFER_USAGE.uniform | BUFFER_USAGE.copyDst });
        const data = new Float32Array(8);
        data[0] = width;
        data[1] = height;
        data[2] = 1 << step; // step size doubles each iteration
        data[3] = 2.4; // phi color
        data[4] = 1.2; // phi depth
        data[5] = 24; // phi normal
        device.queue.writeBuffer(uniform, 0, data);
        const bind = device.createBindGroup({
          layout: asBindGroupLayout(this.pipelineAtrous!.getBindGroupLayout(0)),
          entries: [
            { binding: 0, resource: { buffer: uniform } },
            { binding: 1, resource: read.createView() },
            { binding: 2, resource: auxTex.createView() },
            { binding: 3, resource: normalTex.createView() },
            { binding: 4, resource: envSampler },
            { binding: 5, resource: write.createView() },
          ],
        });
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setPipeline(this.pipelineAtrous!);
        pass.setBindGroup(0, bind);
        pass.dispatchWorkgroups(groupsX, groupsY);
        pass.end();
        device.queue.submit([encoder.finish()]);
        read = write;
        write = write === denoisePing ? denoisePong : denoisePing;
      }
      // Final grade reads `read` (last written).
      return this.gradeAndReadback(read, width, height, options, started);
    }

    return this.gradeAndReadback(colorTex, width, height, options, started);
  }

  /**
   * Runs the denoised HDR image through the engine's PostKernel grade and
   * reads back display-referred sRGB pixels.
   */
  private async gradeAndReadback(
    hdrTexture: GPUTexture,
    width: number,
    height: number,
    options: CinematicRenderOptions,
    started: number,
  ): Promise<CinematicResult> {
    const device = this.device;
    await this.postKernel.init();
    this.postKernel.resize(width, height);

    const ldrTexture = device.createTexture({
      size: { width, height },
      format: 'rgba8unorm',
      usage: TEXTURE_USAGE.renderAttachment | TEXTURE_USAGE.copySrc,
      label: 'cinematic-ldr',
    });

    // The PostKernel presents through a render pass — target the offscreen
    // LDR texture, then copy rows out for the pixel readback.
    this.postKernel.render(
      { color: hdrTexture },
      { view: ldrTexture.createView(), format: 'rgba8unorm' },
      options.settings,
      0,
    );

    const bytesPerRow = Math.ceil((width * 4) / 256) * 256;
    const readback = device.createBuffer({
      size: bytesPerRow * height,
      usage: BUFFER_USAGE.copyDst | BUFFER_USAGE.mapRead,
    });
    const encoder = device.createCommandEncoder();
    encoder.copyTextureToBuffer(
      { texture: ldrTexture },
      { buffer: readback, bytesPerRow, rowsPerImage: height },
      { width, height },
    );
    device.queue.submit([encoder.finish()]);

    await readback.mapAsync(MAP_MODE.read);
    const mapped = new Uint8Array(readback.getMappedRange());
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      pixels.set(mapped.subarray(y * bytesPerRow, y * bytesPerRow + width * 4), y * width * 4);
    }
    readback.unmap();
    readback.destroy();

    return {
      pixels,
      width,
      height,
      samples: options.samples,
      elapsedMs: Date.now() - started,
    };
  }
}

function nextTick(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}
