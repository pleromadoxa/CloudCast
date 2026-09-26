/**
 * Prism Babylon — procedural PBR texture bank.
 *
 * Every texture here is generated on a 2D canvas at runtime and handed to
 * Babylon as a `DynamicTexture`, so the stage ships zero image assets and still
 * gets a genuine metallic/roughness response.
 *
 * Channel layout follows the glTF metallic-roughness convention that Babylon's
 * `PBRMaterial.metallicTexture` expects:
 *
 *   R = ambient occlusion   G = roughness   B = metallic
 *
 * Normal maps are derived from a height field with a Sobel-style operator so
 * highlights break up across surface detail instead of sliding across a flat
 * plane — the single biggest tell between "3D" and "photoreal".
 */
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { Scene } from '@babylonjs/core/scene';

export interface ProceduralPbrMaps {
  albedo: DynamicTexture;
  /** R = ambient occlusion, G = roughness, B = metallic (glTF ORM). */
  orm: DynamicTexture;
  normal: DynamicTexture;
}

export type ProceduralPbrKind =
  | 'brushed_aluminium'
  | 'polished_chrome'
  | 'black_anodized'
  | 'brass'
  | 'lacquered_walnut'
  | 'lacquered_oak'
  | 'upholstery'
  | 'leather'
  | 'marble'
  | 'carpet'
  | 'painted_wall'
  | 'black_fabric'
  | 'glass_frost'
  | 'screen_dead';

const TEXTURE_SIZE = 512;

/** Which channel a painter is filling. */
type Channel = 'albedo' | 'ao' | 'roughness' | 'normal';

interface Surface {
  /** Base colour + decorative grain for the albedo pass. */
  albedo: (ctx: CanvasRenderingContext2D, size: number, rng: () => number) => void;
  /** Roughness 0 (mirror) … 255 (chalk). */
  roughness: (ctx: CanvasRenderingContext2D, size: number, rng: () => number) => void;
  /** Ambient occlusion 0 (occluded) … 255 (open). */
  ao?: (ctx: CanvasRenderingContext2D, size: number, rng: () => number) => void;
  /** Height field painted greyscale; converted to a normal map. */
  height: (ctx: CanvasRenderingContext2D, size: number, rng: () => number) => void;
  /** Metallic 0 … 255, constant across the surface. */
  metal: number;
  /** Strength of the derived normal map. */
  normalScale?: number;
}

/* ------------------------------------------------------------- helpers --- */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(kind: string): number {
  let h = 2166136261;
  for (let i = 0; i < kind.length; i += 1) {
    h ^= kind.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function flat(ctx: CanvasRenderingContext2D, size: number, value: number): void {
  const v = Math.max(0, Math.min(255, Math.round(value)));
  ctx.fillStyle = `rgb(${v},${v},${v})`;
  ctx.fillRect(0, 0, size, size);
}

function noise(
  ctx: CanvasRenderingContext2D,
  size: number,
  rng: () => number,
  base: number,
  amount: number,
): void {
  const image = ctx.createImageData(size, size);
  const b = Math.max(0, Math.min(255, base));
  for (let i = 0; i < image.data.length; i += 4) {
    const v = Math.max(0, Math.min(255, b + (rng() - 0.5) * amount));
    image.data[i] = v;
    image.data[i + 1] = v;
    image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}

function streaks(
  ctx: CanvasRenderingContext2D,
  size: number,
  rng: () => number,
  base: number,
  amount: number,
  alpha = 0.5,
): void {
  noise(ctx, size, rng, base, amount);
  ctx.globalAlpha = alpha;
  for (let y = 0; y < size; y += 1) {
    const v = Math.max(0, Math.min(255, base + (rng() - 0.5) * amount * 2.2));
    ctx.strokeStyle = `rgb(${v},${v},${v})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + rng() * 2);
    ctx.lineTo(size, y + rng() * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/* ----------------------------------------------------------- the surfaces --- */

const SURFACES: Record<ProceduralPbrKind, Surface> = {
  /**
   * Brushed aluminium. Directionally varied roughness is what makes a metal
   * plate read as *metal* rather than grey plastic — the highlight smears into
   * a band along the grain instead of sitting as a round specular dot.
   */
  brushed_aluminium: {
    metal: 255,
    normalScale: 1.1,
    albedo: (ctx, size, rng) => {
      streaks(ctx, size, rng, 178, 22, 0.5);
    },
    roughness: (ctx, size, rng) => {
      streaks(ctx, size, rng, 116, 46, 0.55);
    },
    height: (ctx, size, rng) => {
      flat(ctx, size, 128);
      ctx.globalAlpha = 0.6;
      for (let y = 0; y < size; y += 1) {
        const v = 118 + rng() * 20;
        ctx.strokeStyle = `rgb(${v},${v},${v})`;
        ctx.beginPath();
        ctx.moveTo(0, y + rng() * 2);
        ctx.lineTo(size, y + rng() * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
  },

  /** Mirror-grade chrome — near-zero roughness with faint machining rings. */
  polished_chrome: {
    metal: 255,
    normalScale: 0.5,
    albedo: (ctx, size, rng) => noise(ctx, size, rng, 236, 8),
    roughness: (ctx, size, rng) => noise(ctx, size, rng, 20, 12),
    height: (ctx, size, rng) => {
      flat(ctx, size, 128);
      for (let r = 4; r < size * 1.5; r += 24 + rng() * 12) {
        ctx.strokeStyle = `rgba(${122 + rng() * 12},${122 + rng() * 12},128,0.4)`;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    },
  },

  /** Black anodized aluminium — dark, satin, fine grain. */
  black_anodized: {
    metal: 255,
    normalScale: 1.4,
    albedo: (ctx, size, rng) => {
      noise(ctx, size, rng, 27, 12);
      ctx.globalAlpha = 0.35;
      for (let y = 0; y < size; y += 2) {
        ctx.strokeStyle = 'rgba(62,64,70,0.6)';
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
    roughness: (ctx, size, rng) => noise(ctx, size, rng, 98, 26),
    height: (ctx, size, rng) => noise(ctx, size, rng, 128, 30),
  },

  /**
   * Brass. A metal tints its own reflections, so the warm F0 colour lives in
   * the albedo map while `metallic` stays at 1.0.
   */
  brass: {
    metal: 255,
    normalScale: 1.1,
    albedo: (ctx, size, rng) => {
      noise(ctx, size, rng, 0, 0);
      const image = ctx.getImageData(0, 0, size, size);
      for (let y = 0; y < size; y += 1) {
        const grain = (rng() - 0.5) * 16;
        for (let x = 0; x < size; x += 1) {
          const i = (x + y * size) * 4;
          image.data[i] = 188 + grain + (rng() - 0.5) * 6;
          image.data[i + 1] = 143 + grain + (rng() - 0.5) * 6;
          image.data[i + 2] = 72 + grain + (rng() - 0.5) * 6;
        }
      }
      ctx.putImageData(image, 0, 0);
    },
    roughness: (ctx, size, rng) => streaks(ctx, size, rng, 66, 38, 0.5),
    height: (ctx, size, rng) => streaks(ctx, size, rng, 128, 22, 0.5),
  },

  lacquered_walnut: woodSurface('#33200f', '#6d4326', '#1d0f06', 78),
  lacquered_oak: woodSurface('#a97b48', '#dcbb8c', '#7a5027', 92),

  /** Woven upholstery — high roughness, soft sheen applied at the material. */
  upholstery: {
    metal: 0,
    normalScale: 1.6,
    albedo: (ctx, size, rng) => {
      noise(ctx, size, rng, 62, 18);
      const step = 6;
      for (let y = 0; y < size; y += step) {
        for (let x = 0; x < size; x += step) {
          const on = (x / step + y / step) % 2 === 0;
          ctx.fillStyle = on ? 'rgba(96,102,122,0.5)' : 'rgba(38,42,54,0.5)';
          ctx.fillRect(x, y, step, step);
        }
      }
    },
    roughness: (ctx, size, rng) => noise(ctx, size, rng, 212, 30),
    height: (ctx, size) => {
      flat(ctx, size, 128);
      const step = 6;
      for (let y = 0; y < size; y += step) {
        for (let x = 0; x < size; x += step) {
          const on = (x / step + y / step) % 2 === 0;
          const v = on ? 150 : 106;
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.fillRect(x, y, step, step);
        }
      }
    },
  },

  /** Full-grain leather — irregular cells, matte with polished high points. */
  leather: {
    metal: 0,
    normalScale: 2.2,
    albedo: (ctx, size, rng) => {
      noise(ctx, size, rng, 46, 20);
      drawCells(ctx, size, rng, (v) => `rgba(${v},${Math.round(v * 0.72)},${Math.round(v * 0.58)},0.55)`, 26);
    },
    roughness: (ctx, size, rng) => {
      noise(ctx, size, rng, 152, 38);
      drawCells(ctx, size, rng, (v) => `rgb(${v},${v},${v})`, 26);
    },
    height: (ctx, size, rng) => {
      flat(ctx, size, 128);
      drawCells(ctx, size, rng, (v) => `rgb(${v},${v},${v})`, 26);
    },
  },

  /** Polished stone — veined, glossy, cool. */
  marble: {
    metal: 0,
    normalScale: 0.7,
    albedo: (ctx, size, rng) => {
      noise(ctx, size, rng, 230, 12);
      for (let i = 0; i < 26; i += 1) {
        ctx.strokeStyle = `rgba(${118 + rng() * 60},${116 + rng() * 55},${114 + rng() * 55},${0.12 + rng() * 0.3})`;
        ctx.lineWidth = 0.6 + rng() * 3.2;
        ctx.beginPath();
        let x = rng() * size;
        let y = rng() * size;
        ctx.moveTo(x, y);
        for (let s = 0; s < 22; s += 1) {
          x += (rng() - 0.5) * 70;
          y += (rng() - 0.5) * 70;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    },
    roughness: (ctx, size, rng) => noise(ctx, size, rng, 46, 22),
    height: (ctx, size, rng) => noise(ctx, size, rng, 128, 10),
  },

  carpet: {
    metal: 0,
    normalScale: 1.8,
    albedo: (ctx, size, rng) => {
      noise(ctx, size, rng, 42, 32);
      for (let i = 0; i < 2600; i += 1) {
        ctx.fillStyle = `rgba(${62 + rng() * 60},${64 + rng() * 60},${80 + rng() * 60},0.5)`;
        ctx.fillRect(rng() * size, rng() * size, 2, 2);
      }
    },
    roughness: (ctx, size, rng) => noise(ctx, size, rng, 232, 24),
    height: (ctx, size, rng) => noise(ctx, size, rng, 128, 52),
  },

  painted_wall: {
    metal: 0,
    normalScale: 0.9,
    albedo: (ctx, size, rng) => {
      noise(ctx, size, rng, 212, 10);
      for (let i = 0; i < 200; i += 1) {
        ctx.fillStyle = `rgba(255,255,255,${rng() * 0.05})`;
        ctx.beginPath();
        ctx.arc(rng() * size, rng() * size, 8 + rng() * 40, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    roughness: (ctx, size, rng) => noise(ctx, size, rng, 228, 18),
    height: (ctx, size, rng) => noise(ctx, size, rng, 128, 22),
  },

  black_fabric: {
    metal: 0,
    normalScale: 1.2,
    albedo: (ctx, size, rng) => {
      noise(ctx, size, rng, 19, 10);
      for (let i = 0; i < 1800; i += 1) {
        ctx.fillStyle = `rgba(255,255,255,${rng() * 0.05})`;
        ctx.fillRect(rng() * size, rng() * size, 3, 1);
      }
    },
    roughness: (ctx, size, rng) => noise(ctx, size, rng, 224, 22),
    height: (ctx, size, rng) => noise(ctx, size, rng, 128, 26),
  },

  /** Frosted glass — high roughness, no colour. */
  glass_frost: {
    metal: 0,
    normalScale: 1.1,
    albedo: (ctx, size, rng) => noise(ctx, size, rng, 216, 16),
    roughness: (ctx, size, rng) => noise(ctx, size, rng, 118, 30),
    height: (ctx, size, rng) => noise(ctx, size, rng, 128, 20),
  },

  /** A dark panel that reads as an unpowered display. */
  screen_dead: {
    metal: 0,
    normalScale: 0.3,
    albedo: (ctx, size, rng) => noise(ctx, size, rng, 13, 6),
    roughness: (ctx, size, rng) => noise(ctx, size, rng, 34, 12),
    height: (ctx, size) => flat(ctx, size, 128),
  },
};

function woodSurface(
  dark: string,
  light: string,
  groove: string,
  roughness: number,
): Surface {
  const grain = (ctx: CanvasRenderingContext2D, size: number, rng: () => number, color: (v: number) => string) => {
    for (let y = 0; y < size; y += 3 + rng() * 6) {
      ctx.strokeStyle = color(0);
      ctx.lineWidth = 1 + rng() * 2.4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(size * 0.3, y + (rng() - 0.5) * 12, size * 0.7, y + (rng() - 0.5) * 12, size, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };
  return {
    metal: 0,
    normalScale: 1.2,
    albedo: (ctx, size, rng) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, size);
      gradient.addColorStop(0, dark);
      gradient.addColorStop(0.5, light);
      gradient.addColorStop(1, dark);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
      ctx.globalAlpha = 0.18 + rng() * 0.3;
      grain(ctx, size, rng, () => (rng() > 0.5 ? groove : light));
    },
    // Lacquer is a clear coat: the base wood is fairly rough but the coat is
    // applied at the material level, so this map only carries the grain.
    roughness: (ctx, size, rng) => {
      noise(ctx, size, rng, roughness, 22);
      ctx.globalAlpha = 0.45;
      grain(ctx, size, rng, () => `rgb(${Math.round(66 + rng() * 60)},${Math.round(66 + rng() * 60)},${Math.round(66 + rng() * 60)})`);
    },
    height: (ctx, size, rng) => {
      flat(ctx, size, 128);
      ctx.globalAlpha = 0.8;
      grain(ctx, size, rng, () => `rgb(${Math.round(118 + rng() * 22)},${Math.round(118 + rng() * 22)},128)`);
    },
  };
}

function drawCells(
  ctx: CanvasRenderingContext2D,
  size: number,
  rng: () => number,
  color: (v: number) => string,
  radius: number,
): void {
  for (let i = 0; i < 420; i += 1) {
    const x = rng() * size;
    const y = rng() * size;
    const r = radius * (0.5 + rng());
    ctx.fillStyle = color(110 + rng() * 90);
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) {
      const px = x + Math.cos(a) * r * (0.7 + rng() * 0.5);
      const py = y + Math.sin(a) * r * (0.7 + rng() * 0.5);
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
}

/* ------------------------------------------------------------ builders --- */

function newTexture(scene: Scene, name: string): DynamicTexture {
  const texture = new DynamicTexture(name, { width: TEXTURE_SIZE, height: TEXTURE_SIZE }, scene, true);
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  texture.anisotropicFilteringLevel = 8;
  return texture;
}

function paintChannel(
  texture: DynamicTexture,
  channel: Channel,
  surface: Surface,
  seed: number,
  srgb: boolean,
): void {
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  const rng = mulberry32(seed);
  const size = TEXTURE_SIZE;
  if (channel === 'albedo') surface.albedo(ctx, size, rng);
  else if (channel === 'roughness') surface.roughness(ctx, size, rng);
  else if (channel === 'ao') paintAo(surface, ctx, size, rng);
  texture.update(srgb);
}

function paintAo(
  surface: Surface,
  ctx: CanvasRenderingContext2D,
  size: number,
  rng: () => number,
): void {
  if (surface.ao) surface.ao(ctx, size, rng);
  else flat(ctx, size, 255);
}

function buildNormalMap(scene: Scene, name: string, surface: Surface, seed: number): DynamicTexture {
  const size = TEXTURE_SIZE;
  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = size;
  heightCanvas.height = size;
  const hctx = heightCanvas.getContext('2d');
  const texture = newTexture(scene, name);
  const out = texture.getContext() as CanvasRenderingContext2D;

  if (!hctx) {
    out.fillStyle = 'rgb(128,128,255)';
    out.fillRect(0, 0, size, size);
    texture.update(false);
    return texture;
  }

  surface.height(hctx, size, mulberry32(seed));
  const src = hctx.getImageData(0, 0, size, size);
  const dst = out.createImageData(size, size);
  const scale = (surface.normalScale ?? 1.6) * 2.4;

  const heightAt = (x: number, y: number): number =>
    src.data[((x & (size - 1)) + ((y & (size - 1)) * size)) * 4] / 255;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (heightAt(x + 1, y) - heightAt(x - 1, y)) * scale;
      const dy = (heightAt(x, y + 1) - heightAt(x, y - 1)) * scale;
      const invLen = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const i = (x + y * size) * 4;
      dst.data[i] = (-dx * invLen * 0.5 + 0.5) * 255;
      dst.data[i + 1] = (-dy * invLen * 0.5 + 0.5) * 255;
      dst.data[i + 2] = (invLen * 0.5 + 0.5) * 255;
      dst.data[i + 3] = 255;
    }
  }
  out.putImageData(dst, 0, 0);
  texture.update(false);
  return texture;
}

/** Composes the ORM texture: R = AO, G = roughness, B = metallic. */
function buildOrmMap(scene: Scene, name: string, surface: Surface, seed: number): DynamicTexture {
  const size = TEXTURE_SIZE;
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const aoCanvas = document.createElement('canvas');
  aoCanvas.width = size;
  aoCanvas.height = size;

  const texture = newTexture(scene, name);
  const out = texture.getContext() as CanvasRenderingContext2D;

  const rctx = roughCanvas.getContext('2d');
  const actx = aoCanvas.getContext('2d');
  if (!rctx || !actx) {
    out.fillStyle = `rgb(255,128,${surface.metal})`;
    out.fillRect(0, 0, size, size);
    texture.update(false);
    return texture;
  }

  surface.roughness(rctx, size, mulberry32(seed));
  (surface.ao ?? ((c, s) => flat(c, s, 255)))(actx, size, mulberry32(seed + 7919));

  const rough = rctx.getImageData(0, 0, size, size).data;
  const ao = actx.getImageData(0, 0, size, size).data;
  const dst = out.createImageData(size, size);
  for (let i = 0; i < dst.data.length; i += 4) {
    dst.data[i] = ao[i];
    dst.data[i + 1] = rough[i + 1];
    dst.data[i + 2] = surface.metal;
    dst.data[i + 3] = 255;
  }
  out.putImageData(dst, 0, 0);
  texture.update(false);
  return texture;
}

function buildMaps(scene: Scene, kind: ProceduralPbrKind): ProceduralPbrMaps {
  const surface = SURFACES[kind];
  const seed = hashSeed(kind);
  const albedo = newTexture(scene, `${kind}-albedo`);
  paintChannel(albedo, 'albedo', surface, seed, true);
  return {
    albedo,
    orm: buildOrmMap(scene, `${kind}-orm`, surface, seed),
    normal: buildNormalMap(scene, `${kind}-normal`, surface, seed),
  };
}

/* --------------------------------------------------------------- cache --- */

const cache = new Map<string, ProceduralPbrMaps>();

/** Cached per scene+kind so ten chrome legs share one texture set. */
export function getPbrMaps(scene: Scene, kind: ProceduralPbrKind): ProceduralPbrMaps {
  const key = `${scene.uid}:${kind}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const maps = buildMaps(scene, kind);
  cache.set(key, maps);
  return maps;
}

export function disposePbrMaps(scene: Scene): void {
  for (const [key, maps] of cache) {
    if (!key.startsWith(`${scene.uid}:`)) continue;
    maps.albedo.dispose();
    maps.orm.dispose();
    maps.normal.dispose();
    cache.delete(key);
  }
}

/** Emissive plate texture (LED panels, set glow). */
export function makeEmissiveTexture(
  scene: Scene,
  name: string,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
): DynamicTexture {
  const texture = newTexture(scene, name);
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  draw(ctx, TEXTURE_SIZE);
  texture.update(true);
  return texture;
}
