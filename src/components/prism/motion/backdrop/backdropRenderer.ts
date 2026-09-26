/**
 * Backdrop renderer for the 3D motion graphics stage.
 *
 * Primary path is **WebGPU**: a single fullscreen-triangle pipeline runs the
 * WGSL program in `shaders.ts` (procedural galaxy / nebula / star field /
 * lit 3D globe / data grid / aurora / smoke, or a real video-or-photo plate).
 * When the browser has no WebGPU (or validation fails) it drops back to a
 * Canvas2D renderer that draws the same plates in a lighter, gradient-based
 * form so the feature still works everywhere.
 *
 * The renderer owns its own canvas: MotionGraphicsStage stacks it *under* the
 * transparent three.js canvas, and PrismOutputCapture composites both into the
 * program feed.
 */
import { BACKDROP_WGSL } from './shaders';
import { getDeviceManager } from '../../../../lib/renderEngine/deviceManager';
import { asBindGroupLayout } from '../../../../types/webgpuCompat';

/**
 * WebGPU usage flags. TypeScript's DOM lib ships the flag *types* but not the
 * runtime enums, so they are spelled out here (values from the WebGPU spec).
 */
const GPU_USAGE = {
  bufferCopyDst: 0x0008,
  bufferUniform: 0x0040,
  textureCopyDst: 0x0002,
  textureBinding: 0x0004,
  textureRenderAttachment: 0x0010,
} as const;

export interface BackdropParams {
  /** Shader mode — see BACKDROP_MODE in motionBackgrounds.ts. */
  mode: number;
  /** Accent colour, 0–1 per channel. */
  accent: [number, number, number];
  intensity: number;
  saturation: number;
  parallax: number;
  vignette: number;
  grain: number;
  zoom: number;
}

export type BackdropSourceSpec = { kind: 'video' | 'image'; src: string } | null;

export interface BackdropRenderer {
  readonly api: 'webgpu' | 'canvas';
  readonly canvas: HTMLCanvasElement;
  /** True once a plate (video / photo) is decoded and sampled. */
  readonly hasMedia: boolean;
  setSource(source: BackdropSourceSpec): void;
  render(time: number, params: BackdropParams): void;
  resize(width: number, height: number): void;
  destroy(): void;
}

interface LoadedMedia {
  /** Source the GPU / 2D context can sample every frame. */
  source: TexImageSource & CanvasImageSource;
  width: number;
  height: number;
  aspect: number;
  video?: HTMLVideoElement;
  release(): void;
}

/** Cap plate resolution — motion plates are graded, blurred and cropped anyway. */
const MAX_PLATE = 2560;

function loadMedia(spec: Exclude<BackdropSourceSpec, null>): Promise<LoadedMedia> {
  if (spec.kind === 'video') {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.crossOrigin = 'anonymous';
      const fail = (reason: string) => {
        video.removeAttribute('src');
        video.load();
        reject(new Error(reason));
      };
      video.addEventListener('error', () => fail(`video failed: ${spec.src}`), { once: true });
      video.addEventListener(
        'loadeddata',
        () => {
          if (video.videoWidth < 2 || video.videoHeight < 2) {
            fail(`video has no frames: ${spec.src}`);
            return;
          }
          void video.play().catch(() => undefined);
          resolve({
            source: video,
            width: video.videoWidth,
            height: video.videoHeight,
            aspect: video.videoWidth / video.videoHeight,
            video,
            release: () => {
              video.pause();
              video.removeAttribute('src');
              video.load();
            },
          });
        },
        { once: true },
      );
      video.src = spec.src;
      video.load();
    });
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.addEventListener('error', () => reject(new Error(`image failed: ${spec.src}`)), {
      once: true,
    });
    img.addEventListener(
      'load',
      () => {
        void (async () => {
          try {
            const w = img.naturalWidth;
            const h = img.naturalHeight;
            if (w < 2 || h < 2) throw new Error(`image is empty: ${spec.src}`);
            if (w <= MAX_PLATE && h <= MAX_PLATE) {
              const bitmap = await createImageBitmap(img);
              resolve({
                source: bitmap,
                width: w,
                height: h,
                aspect: w / h,
                release: () => bitmap.close(),
              });
              return;
            }
            const scale = MAX_PLATE / Math.max(w, h);
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(w * scale);
            canvas.height = Math.round(h * scale);
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('2d context unavailable');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve({
              source: canvas,
              width: canvas.width,
              height: canvas.height,
              aspect: canvas.width / canvas.height,
              release: () => {
                canvas.width = 0;
                canvas.height = 0;
              },
            });
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        })();
      },
      { once: true },
    );
    img.src = spec.src;
  });
}

/* --------------------------------------------------------------- WebGPU --- */

class WebGPUBackdrop implements BackdropRenderer {
  readonly api = 'webgpu' as const;
  readonly canvas: HTMLCanvasElement;
  hasMedia = false;

  private device: GPUDevice;
  private context: GPUCanvasContext;
  private pipeline: GPURenderPipeline;
  private uniforms: GPUBuffer;
  private sampler: GPUSampler;
  private placeholder: GPUTexture;
  private texture: GPUTexture;
  private bindGroup: GPUBindGroup;
  private media: LoadedMedia | null = null;
  private mediaToken = 0;
  private lastVideoTime = -1;
  private destroyed = false;
  private readonly floats = new Float32Array(16);

  private constructor(
    canvas: HTMLCanvasElement,
    device: GPUDevice,
    context: GPUCanvasContext,
    pipeline: GPURenderPipeline,
    uniforms: GPUBuffer,
    sampler: GPUSampler,
    placeholder: GPUTexture,
  ) {
    this.canvas = canvas;
    this.device = device;
    this.context = context;
    this.pipeline = pipeline;
    this.uniforms = uniforms;
    this.sampler = sampler;
    this.placeholder = placeholder;
    this.texture = placeholder;
    this.bindGroup = this.makeBindGroup(placeholder);
  }

  static async create(canvas: HTMLCanvasElement, format: GPUTextureFormat): Promise<WebGPUBackdrop> {
    if (typeof navigator === 'undefined' || !navigator.gpu) {
      throw new Error('WebGPU unavailable');
    }
    // The backdrop draws on the render engine's shared GPUDevice so every GPU
    // surface in the app shares one queue, one memory budget and one
    // device-loss recovery path. The manager handles adapter selection,
    // feature negotiation and auto-recovery.
    const device = await getDeviceManager().acquire();

    // Compile and validate the shader *before* claiming the canvas. Once
    // getContext('webgpu') succeeds the element can never hand out a 2d
    // context again, so a late WGSL failure would leave no fallback at all.
    device.pushErrorScope('validation');
    const module = device.createShaderModule({ code: BACKDROP_WGSL });
    const pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module, entryPoint: 'vs' },
      fragment: { module, entryPoint: 'fs', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    });
    const pipelineError = await device.popErrorScope();
    if (pipelineError) {
      throw new Error(`WGSL validation failed: ${pipelineError.message}`);
    }

    const context = canvas.getContext('webgpu') as GPUCanvasContext | null;
    if (!context) {
      throw new Error('No WebGPU canvas context');
    }
    // If configure throws the error propagates; the canvas is already claimed
    // but the caller falls back cleanly and the shared device is untouched.
    context.configure({ device, format, alphaMode: 'premultiplied' });

    const uniforms = device.createBuffer({
      size: 64,
      usage: GPU_USAGE.bufferUniform | GPU_USAGE.bufferCopyDst,
    });
    const sampler = device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });
    const placeholder = device.createTexture({
      size: [1, 1, 1],
      format: 'rgba8unorm',
      usage:
        GPU_USAGE.textureBinding |
        GPU_USAGE.textureCopyDst |
        GPU_USAGE.textureRenderAttachment,
    });
    device.queue.writeTexture(
      { texture: placeholder },
      new Uint8Array([8, 9, 16, 255]),
      { bytesPerRow: 4, rowsPerImage: 1 },
      [1, 1, 1],
    );

    return new WebGPUBackdrop(canvas, device, context, pipeline, uniforms, sampler, placeholder);
  }

  private makeBindGroup(texture: GPUTexture): GPUBindGroup {
    return this.device.createBindGroup({
      layout: asBindGroupLayout(this.pipeline.getBindGroupLayout(0)),
      entries: [
        { binding: 0, resource: { buffer: this.uniforms } },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: texture.createView() },
      ],
    });
  }

  setSource(source: BackdropSourceSpec): void {
    const token = ++this.mediaToken;
    const previous = this.media;
    this.media = null;
    this.hasMedia = false;
    previous?.release();

    if (!source) {
      this.swapTexture(this.placeholder);
      return;
    }

    void loadMedia(source)
      .then((media) => {
        if (this.destroyed || token !== this.mediaToken) {
          media.release();
          return;
        }
        this.media = media;
        this.hasMedia = true;
        const width = Math.min(media.width, MAX_PLATE);
        const height = Math.min(media.height, MAX_PLATE);
        const texture = this.device.createTexture({
          size: [width, height, 1],
          format: 'rgba8unorm',
          usage:
            GPU_USAGE.textureBinding |
            GPU_USAGE.textureCopyDst |
            GPU_USAGE.textureRenderAttachment,
        });
        this.swapTexture(texture);
        if (!media.video) {
          this.device.queue.copyExternalImageToTexture(
            { source: media.source as GPUCopyExternalImageSource },
            { texture },
            [width, height],
          );
        }
        this.lastVideoTime = -1;
      })
      .catch(() => {
        /* plate unavailable — the procedural plate keeps running */
      });
  }

  private swapTexture(texture: GPUTexture): void {
    if (this.texture !== this.placeholder && this.texture !== texture) this.texture.destroy();
    this.texture = texture;
    this.bindGroup = this.makeBindGroup(texture);
  }

  resize(width: number, height: number): void {
    const w = Math.max(2, Math.round(width));
    const h = Math.max(2, Math.round(height));
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
  }

  render(time: number, params: BackdropParams): void {
    if (this.destroyed) return;
    const media = this.media;
    const video = media?.video;
    if (video && media && video.readyState >= 2 && video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = video.currentTime;
      const width = Math.min(media.width, MAX_PLATE);
      const height = Math.min(media.height, MAX_PLATE);
      try {
        this.device.queue.copyExternalImageToTexture(
          { source: video },
          { texture: this.texture },
          [width, height],
        );
      } catch {
        /* frame not ready yet — the next frame retries */
      }
    }

    const f = this.floats;
    f[0] = this.canvas.width;
    f[1] = this.canvas.height;
    f[2] = time;
    f[3] = params.mode;
    f[4] = params.accent[0];
    f[5] = params.accent[1];
    f[6] = params.accent[2];
    f[7] = params.intensity;
    f[8] = 1;
    f[9] = params.saturation;
    f[10] = params.parallax;
    f[11] = params.vignette;
    f[12] = params.grain;
    f[13] = media ? 1 : 0;
    f[14] = media ? media.aspect : 16 / 9;
    f[15] = params.zoom;
    this.device.queue.writeBuffer(this.uniforms, 0, f);

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(3);
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.mediaToken++;
    this.media?.release();
    this.media = null;
    if (this.texture !== this.placeholder) this.texture.destroy();
    this.placeholder.destroy();
    this.uniforms.destroy();
    this.context.unconfigure();
    // The GPUDevice is the render engine's shared device — only this
    // surface's resources are released here, never the device itself.
  }
}

/* --------------------------------------------------------------- Canvas --- */

/** Deterministic star list for the Canvas2D fallback. */
function makeStars(count: number) {
  let seed = 20260926;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  return Array.from({ length: count }, () => ({
    x: rand(),
    y: rand(),
    r: 0.4 + rand() * 1.6,
    p: rand() * Math.PI * 2,
    d: 0.4 + rand() * 1.4,
  }));
}

class CanvasBackdrop implements BackdropRenderer {
  readonly api = 'canvas' as const;
  readonly canvas: HTMLCanvasElement;
  hasMedia = false;

  private ctx: CanvasRenderingContext2D;
  private media: LoadedMedia | null = null;
  private mediaToken = 0;
  private stars = makeStars(420);
  private noise: HTMLCanvasElement | null = null;
  private destroyed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2d context unavailable');
    this.ctx = ctx;
  }

  setSource(source: BackdropSourceSpec): void {
    const token = ++this.mediaToken;
    const previous = this.media;
    this.media = null;
    this.hasMedia = false;
    previous?.release();
    if (!source) return;
    void loadMedia(source)
      .then((media) => {
        if (this.destroyed || token !== this.mediaToken) {
          media.release();
          return;
        }
        this.media = media;
        this.hasMedia = true;
      })
      .catch(() => {
        /* plate unavailable — gradients and stars carry the frame */
      });
  }

  resize(width: number, height: number): void {
    const w = Math.max(2, Math.round(width));
    const h = Math.max(2, Math.round(height));
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
  }

  private ensureNoise(): HTMLCanvasElement {
    if (this.noise) return this.noise;
    const size = 160;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const image = ctx.createImageData(size, size);
      for (let i = 0; i < image.data.length; i += 4) {
        const v = Math.floor(Math.random() * 255);
        image.data[i] = v;
        image.data[i + 1] = v;
        image.data[i + 2] = v;
        image.data[i + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);
    }
    this.noise = canvas;
    return canvas;
  }

  private paintStars(time: number, accent: [number, number, number], amount: number) {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;
    for (const star of this.stars) {
      const tw = 0.45 + 0.55 * Math.sin(time * star.d + star.p);
      const alpha = Math.max(0, tw * amount);
      if (alpha <= 0.02) continue;
      const x = ((star.x + time * 0.004 * star.d) % 1.05) * w;
      const y = star.y * h;
      ctx.fillStyle = `rgba(${Math.round(210 + accent[0] * 45)},${Math.round(218 + accent[1] * 37)},255,${alpha.toFixed(3)})`;
      ctx.fillRect(x, y, star.r, star.r);
    }
  }

  private paintProcedural(time: number, params: BackdropParams) {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;
    const [r, g, b] = params.accent;
    const tint = `${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)}`;

    const base = ctx.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, '#04050c');
    base.addColorStop(1, '#070a15');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);

    // Accent-driven glow, repositioned per frame so plates feel alive.
    const cx = w * (0.5 + 0.12 * Math.sin(time * 0.11));
    const cy = h * (0.46 + 0.08 * Math.cos(time * 0.09));
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.62);
    const strength = params.mode === 1 ? 0.5 : params.mode === 6 ? 0.36 : 0.42;
    glow.addColorStop(0, `rgba(${tint},${strength})`);
    glow.addColorStop(0.45, `rgba(${tint},${strength * 0.24})`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    if (params.mode === 5) {
      // Perspective floor lines.
      ctx.strokeStyle = `rgba(${tint},0.5)`;
      ctx.lineWidth = 1;
      const horizon = h * 0.46;
      for (let i = -14; i <= 14; i++) {
        const x = w * 0.5 + i * (w / 9);
        ctx.beginPath();
        ctx.moveTo(w * 0.5 + i * 6, horizon);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let i = 1; i < 16; i++) {
        const z = i / 16;
        const y = horizon + (h - horizon) * z * z;
        ctx.globalAlpha = 0.18 + z * 0.4;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    if (params.mode === 4) {
      // Globe disc with rim light.
      const radius = Math.min(w, h) * 0.36;
      const sphere = ctx.createRadialGradient(
        cx - radius * 0.35,
        cy - radius * 0.3,
        radius * 0.1,
        cx,
        cy,
        radius,
      );
      sphere.addColorStop(0, `rgba(${tint},0.85)`);
      sphere.addColorStop(0.6, `rgba(${tint},0.25)`);
      sphere.addColorStop(1, 'rgba(4,8,18,0.95)');
      ctx.fillStyle = sphere;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(${tint},0.65)`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (params.mode === 6) {
      // Aurora band.
      const band = ctx.createLinearGradient(0, h * 0.2, 0, h * 0.75);
      band.addColorStop(0, 'rgba(0,0,0,0)');
      band.addColorStop(0.5, `rgba(${tint},0.35)`);
      band.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = band;
      ctx.fillRect(0, h * 0.2, w, h * 0.55);
    }

    ctx.globalCompositeOperation = 'source-over';
    this.paintStars(time, params.accent, 0.85);
  }

  render(time: number, params: BackdropParams): void {
    if (this.destroyed) return;
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;
    if (w < 2 || h < 2) return;

    const media = this.media;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
    ctx.fillStyle = '#04050c';
    ctx.fillRect(0, 0, w, h);

    if (media && params.mode === 0) {
      const zoom = Math.max(0.05, params.zoom) * (1 + 0.05 * Math.sin(time * 0.06) * params.parallax);
      const scale = Math.max(w / media.width, h / media.height) * zoom;
      const dw = media.width * scale;
      const dh = media.height * scale;
      const dx = (w - dw) / 2 + Math.sin(time * 0.031) * w * 0.014 * params.parallax;
      const dy = (h - dh) / 2 + Math.cos(time * 0.024) * h * 0.014 * params.parallax;
      ctx.filter = `saturate(${params.saturation.toFixed(2)}) brightness(${Math.min(2, 0.35 + params.intensity * 0.75).toFixed(2)})`;
      ctx.drawImage(media.source, dx, dy, dw, dh);
      ctx.filter = 'none';
      this.paintStars(time, params.accent, 0.12);
    } else {
      ctx.filter = `saturate(${params.saturation.toFixed(2)})`;
      this.paintProcedural(time, params);
      ctx.filter = 'none';
    }

    // Accent wash keeps the plate on-palette.
    const [r, g, b] = params.accent;
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},0.22)`;
    ctx.fillRect(0, 0, w, h);

    if (params.vignette > 0.001) {
      ctx.globalCompositeOperation = 'source-over';
      const vg = ctx.createRadialGradient(
        w / 2,
        h / 2,
        Math.min(w, h) * 0.28,
        w / 2,
        h / 2,
        Math.max(w, h) * 0.78,
      );
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, `rgba(0,0,0,${Math.min(0.95, params.vignette * 0.85).toFixed(3)})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
    }

    if (params.grain > 0.001) {
      const noise = this.ensureNoise();
      const pattern = ctx.createPattern(noise, 'repeat');
      if (pattern) {
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = Math.min(0.6, params.grain * 2.4);
        ctx.save();
        ctx.translate(-Math.floor(Math.random() * 160), -Math.floor(Math.random() * 160));
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, w + 160, h + 160);
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.mediaToken++;
    this.media?.release();
    this.media = null;
    this.noise = null;
  }
}

/* --------------------------------------------------------------- factory --- */

export type BackdropApiPreference = 'auto' | 'webgpu' | 'canvas';

/**
 * Creates the best renderer available for this browser. `preference` pins the
 * implementation (the `?backdrop=canvas` debug flag uses it to test the
 * fallback path).
 */
export async function createBackdropRenderer(
  canvas: HTMLCanvasElement,
  preference: BackdropApiPreference = 'auto',
): Promise<BackdropRenderer> {
  if (preference !== 'canvas' && typeof navigator !== 'undefined' && navigator.gpu) {
    try {
      const format = navigator.gpu.getPreferredCanvasFormat();
      return await WebGPUBackdrop.create(canvas, format);
    } catch (error) {
      if (preference === 'webgpu') {
        throw new Error('WebGPU backdrop requested but unavailable', { cause: error });
      }
      console.warn('[motion backdrop] WebGPU path unavailable, using the Canvas2D plate:', error);
    }
  } else if (preference === 'webgpu') {
    throw new Error('WebGPU backdrop requested but unavailable');
  }
  return new CanvasBackdrop(canvas);
}

/** Reports which API the current browser would pick (used by the HUD badge). */
export function detectBackdropApi(): 'webgpu' | 'canvas' {
  return typeof navigator !== 'undefined' && navigator.gpu ? 'webgpu' : 'canvas';
}
