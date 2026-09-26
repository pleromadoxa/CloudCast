import * as THREE from 'three';

/**
 * Procedural PBR texture studio for the photoreal sets.
 *
 * Every surface (wood, fabric, leather, marble, concrete, brick, metal, tile)
 * is generated at runtime as a colour map PLUS a derived normal map (Sobel
 * height → tangent-space normals) so light breaks across grain, weave, veins
 * and grout exactly like it does on the real material. No downloads, no
 * storage — deterministic per seed, cached per session.
 */

export type ProceduralTextureKind =
  | 'wood_oak'
  | 'wood_walnut'
  | 'fabric_linen'
  | 'fabric_velvet'
  | 'leather'
  | 'carpet'
  | 'concrete'
  | 'marble'
  | 'wall_paint'
  | 'wall_brick'
  | 'metal_brushed'
  | 'tile'
  | 'screen_glow'
  | 'wall_decal';

const cache = new Map<string, THREE.CanvasTexture>();
const normalCache = new Map<string, THREE.DataTexture>();

function seeded(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function makeCanvas(w: number, h: number) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d')! };
}

/** Layered value noise — cheap, tileable-enough micro variation. */
function speckle(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  count: number,
  rnd: () => number,
  colors: string[],
  sizeMin = 1,
  sizeMax = 3,
) {
  for (let i = 0; i < count; i += 1) {
    ctx.fillStyle = colors[Math.floor(rnd() * colors.length)];
    ctx.globalAlpha = 0.08 + rnd() * 0.22;
    const s = sizeMin + rnd() * (sizeMax - sizeMin);
    ctx.fillRect(rnd() * w, rnd() * h, s, s);
  }
  ctx.globalAlpha = 1;
}

/* --------------------------------------------------------------- wood */

function woodGrain(seed: number, base: string, grain: string, knotColor: string) {
  const { canvas, ctx } = makeCanvas(512, 512);
  const rnd = seeded(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);

  // Growth rings — curved bands with light/dark heartwood variation.
  for (let ring = 0; ring < 26; ring += 1) {
    const y0 = ring * 21 + rnd() * 8;
    const bend = 14 + rnd() * 22;
    ctx.strokeStyle = grain;
    ctx.globalAlpha = 0.14 + rnd() * 0.22;
    ctx.lineWidth = 1.5 + rnd() * 5;
    ctx.beginPath();
    ctx.moveTo(-10, y0);
    ctx.bezierCurveTo(150, y0 - bend, 360, y0 + bend * 0.6, 522, y0 - bend * 0.3);
    ctx.stroke();
  }
  // Fine pore grain — long thin fibres.
  for (let i = 0; i < 260; i += 1) {
    const y = rnd() * 512;
    ctx.strokeStyle = rnd() > 0.5 ? grain : base;
    ctx.globalAlpha = 0.06 + rnd() * 0.12;
    ctx.lineWidth = 0.6 + rnd() * 1.1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(170, y + rnd() * 10 - 5, 340, y + rnd() * 10 - 5, 512, y + rnd() * 8 - 4);
    ctx.stroke();
  }
  // Knots — two per board area at most, with concentric rings.
  const knots = 1 + Math.floor(rnd() * 2);
  for (let k = 0; k < knots; k += 1) {
    const cx = 80 + rnd() * 352;
    const cy = 80 + rnd() * 352;
    for (let r = 22; r > 3; r -= 2.4) {
      ctx.strokeStyle = knotColor;
      ctx.globalAlpha = 0.1 + rnd() * 0.18;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 1.6, r, rnd() * 0.6 - 0.3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  return canvas;
}

/* ------------------------------------------------------------- fabric */

function fabricWeave(seed: number, base: string, thread: string, sheen: string) {
  const { canvas, ctx } = makeCanvas(256, 256);
  const rnd = seeded(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  // Over-under weave: warp and weft threads with directional shading.
  const step = 5;
  for (let x = 0; x < 256; x += step) {
    for (let y = 0; y < 256; y += step) {
      const warpOver = (x / step + y / step) % 2 === 0;
      ctx.fillStyle = warpOver ? thread : base;
      ctx.globalAlpha = 0.5 + rnd() * 0.3;
      // Thread sliver with a lit top edge and a shadowed bottom edge.
      ctx.fillRect(x, y, step - 1, step - 1);
      ctx.fillStyle = sheen;
      ctx.globalAlpha = 0.1 + rnd() * 0.12;
      if (warpOver) ctx.fillRect(x, y, step - 1, 1);
      else ctx.fillRect(x, y, 1, step - 1);
    }
  }
  // Slub fibres — irregular thicker yarns.
  for (let i = 0; i < 60; i += 1) {
    ctx.strokeStyle = thread;
    ctx.globalAlpha = 0.12 + rnd() * 0.18;
    ctx.lineWidth = 1 + rnd() * 2;
    const horizontal = rnd() > 0.5;
    ctx.beginPath();
    if (horizontal) {
      const y = rnd() * 256;
      ctx.moveTo(0, y);
      ctx.lineTo(256, y + rnd() * 6 - 3);
    } else {
      const x = rnd() * 256;
      ctx.moveTo(x, 0);
      ctx.lineTo(x + rnd() * 6 - 3, 256);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return canvas;
}

function leatherGrain(seed: number, base: string, cell: string) {
  const { canvas, ctx } = makeCanvas(256, 256);
  const rnd = seeded(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  // Irregular hide cells — rounded blobs with darker creases between them.
  for (let i = 0; i < 420; i += 1) {
    const x = rnd() * 256;
    const y = rnd() * 256;
    const r = 4 + rnd() * 9;
    ctx.fillStyle = cell;
    ctx.globalAlpha = 0.1 + rnd() * 0.16;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.6 + rnd() * 0.5), rnd() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
    // crease highlight along the cell rim
    ctx.strokeStyle = base;
    ctx.globalAlpha = 0.12;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Pore speckle.
  speckle(ctx, 256, 256, 2400, rnd, [base, cell], 0.5, 1.5);
  return canvas;
}

function carpetPattern(seed: number, base: string, accent: string) {
  const { canvas, ctx } = makeCanvas(256, 256);
  const rnd = seeded(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  // Dense fibre pile — thousands of short tufts with catch-light tips.
  for (let i = 0; i < 5200; i += 1) {
    const x = rnd() * 256;
    const y = rnd() * 256;
    ctx.strokeStyle = rnd() > 0.82 ? accent : base;
    ctx.globalAlpha = 0.18 + rnd() * 0.3;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + rnd() * 2 - 1, y - 1.5 - rnd() * 2.5);
    ctx.stroke();
  }
  // Broad tonal bands — the vacuumed sheen of a real carpet.
  for (let i = 0; i < 8; i += 1) {
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.05 + rnd() * 0.05;
    ctx.fillRect(0, i * 32 + rnd() * 12, 256, 14 + rnd() * 12);
  }
  ctx.globalAlpha = 1;
  return canvas;
}

/* ------------------------------------------------------------ mineral */

function noiseWall(seed: number, color: string) {
  const { canvas, ctx } = makeCanvas(256, 256);
  const rnd = seeded(seed);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 256);
  const r0 = parseInt(color.slice(1, 3), 16);
  const g0 = parseInt(color.slice(3, 5), 16);
  const b0 = parseInt(color.slice(5, 7), 16);
  // Broad mottling first (roller texture), then fine grit.
  for (let i = 0; i < 90; i += 1) {
    const v = rnd() * 18 - 9;
    ctx.fillStyle = `rgb(${Math.max(0, Math.min(255, r0 + v))},${Math.max(0, Math.min(255, g0 + v))},${Math.max(0, Math.min(255, b0 + v))})`;
    ctx.globalAlpha = 0.12 + rnd() * 0.12;
    ctx.beginPath();
    ctx.ellipse(rnd() * 256, rnd() * 256, 12 + rnd() * 34, 10 + rnd() * 26, rnd() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Fine mineral tooth — kept very low-contrast so walls read as smooth
  // plaster at broadcast distance instead of sandpaper grit.
  for (let i = 0; i < 3200; i += 1) {
    const v = rnd() * 10 - 5;
    ctx.fillStyle = `rgb(${Math.max(0, Math.min(255, r0 + v))},${Math.max(0, Math.min(255, g0 + v))},${Math.max(0, Math.min(255, b0 + v))})`;
    ctx.globalAlpha = 0.3 + rnd() * 0.25;
    ctx.fillRect(rnd() * 256, rnd() * 256, 1, 1);
  }
  ctx.globalAlpha = 1;
  return canvas;
}

function marbleSwirl(seed: number) {
  const { canvas, ctx } = makeCanvas(512, 512);
  const rnd = seeded(seed);
  // Warm stone base with cloudy mineral variation.
  const base = ctx.createLinearGradient(0, 0, 512, 512);
  base.addColorStop(0, '#efeceb');
  base.addColorStop(0.5, '#e2dfdc');
  base.addColorStop(1, '#f2f0ee');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  // Cloudy blooms.
  for (let i = 0; i < 26; i += 1) {
    ctx.fillStyle = `rgba(163,155,148,${0.04 + rnd() * 0.07})`;
    ctx.beginPath();
    ctx.ellipse(rnd() * 512, rnd() * 512, 30 + rnd() * 110, 20 + rnd() * 80, rnd() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // Vein systems — a primary fracture network plus hairline capillaries.
  const vein = (width: number, alpha: number, steps: number) => {
    ctx.strokeStyle = `rgba(104,96,89,${alpha})`;
    ctx.lineWidth = width;
    ctx.beginPath();
    let x = rnd() * 512;
    let y = rnd() * 512;
    ctx.moveTo(x, y);
    for (let j = 0; j < steps; j += 1) {
      x += (rnd() - 0.5) * 130;
      y += (rnd() - 0.5) * 130;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  for (let i = 0; i < 7; i += 1) vein(2.5 + rnd() * 6, 0.12 + rnd() * 0.14, 8);
  for (let i = 0; i < 34; i += 1) vein(0.6 + rnd() * 1.4, 0.07 + rnd() * 0.1, 6);
  // Quartz flecks.
  speckle(ctx, 512, 512, 700, rnd, ['#ffffff', '#c9c2bb'], 0.5, 2);
  return canvas;
}

function brickWall(seed: number) {
  const { canvas, ctx } = makeCanvas(256, 256);
  const rnd = seeded(seed);
  // Mortar bed.
  ctx.fillStyle = '#a8a29e';
  ctx.fillRect(0, 0, 256, 256);
  const brickH = 16;
  const brickW = 48;
  for (let row = 0; row < 256 / brickH; row += 1) {
    const offset = row % 2 === 0 ? 0 : brickW / 2;
    for (let col = -1; col < 256 / brickW + 1; col += 1) {
      const shade = 132 + Math.floor(rnd() * 42);
      const r = shade + 18;
      const g = shade - 12;
      const b = shade - 30;
      ctx.fillStyle = `rgb(${r},${Math.max(0, g)},${Math.max(0, b)})`;
      ctx.fillRect(col * brickW + offset, row * brickH, brickW - 2, brickH - 2);
      // Brick face texture + lit top edge / shadowed bottom edge.
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(col * brickW + offset, row * brickH, brickW - 2, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(col * brickW + offset, row * brickH + brickH - 3, brickW - 2, 1);
      for (let i = 0; i < 24; i += 1) {
        ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)';
        ctx.fillRect(col * brickW + offset + rnd() * (brickW - 3), row * brickH + rnd() * (brickH - 3), 1.5, 1.5);
      }
    }
  }
  return canvas;
}

function brushedMetal(seed: number) {
  const { canvas, ctx } = makeCanvas(256, 256);
  const rnd = seeded(seed);
  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, '#8f8b86');
  grad.addColorStop(0.5, '#b0aca7');
  grad.addColorStop(1, '#8f8b86');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  // Anisotropic scratches — thousands of fine horizontal streaks.
  for (let y = 0; y < 256; y += 1) {
    ctx.strokeStyle = rnd() > 0.5 ? `rgba(255,255,255,${0.03 + rnd() * 0.08})` : `rgba(0,0,0,${0.03 + rnd() * 0.07})`;
    ctx.lineWidth = 0.5 + rnd();
    ctx.beginPath();
    ctx.moveTo(0, y + rnd() * 0.6);
    ctx.lineTo(256, y + rnd() * 0.6);
    ctx.stroke();
  }
  for (let i = 0; i < 160; i += 1) {
    const y = rnd() * 256;
    ctx.strokeStyle = `rgba(255,255,255,${0.05 + rnd() * 0.1})`;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(rnd() * 256, y);
    ctx.lineTo(rnd() * 256, y + rnd() * 2 - 1);
    ctx.stroke();
  }
  return canvas;
}

function tileFloor(seed: number) {
  const { canvas, ctx } = makeCanvas(256, 256);
  const rnd = seeded(seed);
  // Dark grout bed.
  ctx.fillStyle = '#8f8b86';
  ctx.fillRect(0, 0, 256, 256);
  const t = 32;
  for (let x = 0; x < 256; x += t) {
    for (let y = 0; y < 256; y += t) {
      const v = rnd() * 14;
      const g = ctx.createLinearGradient(x, y, x + t, y + t);
      g.addColorStop(0, `rgb(${216 + v},${213 + v},${210 + v})`);
      g.addColorStop(1, `rgb(${198 + v},${195 + v},${192 + v})`);
      ctx.fillStyle = g;
      ctx.fillRect(x + 1, y + 1, t - 2, t - 2);
      // Subtle stone veining on the tile face + bevel highlight.
      ctx.strokeStyle = 'rgba(140,134,128,0.16)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x + 4 + rnd() * 8, y + 2);
      ctx.bezierCurveTo(x + 10, y + 14, x + 22, y + 16, x + t - 3, y + t - 4);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(x + 1, y + 1, t - 2, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(x + 1, y + t - 2, t - 2, 1);
    }
  }
  return canvas;
}

function wallDecal(seed: number) {
  const { canvas, ctx } = makeCanvas(256, 256);
  const rnd = seeded(seed);
  ctx.clearRect(0, 0, 256, 256);
  // Muted gallery tones — decal art should read as tasteful set dressing,
  // not glowing neon graphics.
  const colors = ['#a8a29e', '#b08d57', '#7d9c8f', '#b46a4d'];
  const c = colors[seed % colors.length];
  ctx.strokeStyle = c;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.55;
  if (seed % 3 === 0) {
    ctx.beginPath();
    ctx.arc(128, 128, 80, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(128, 128, 40, 0, Math.PI * 2);
    ctx.stroke();
  } else if (seed % 3 === 1) {
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      ctx.moveTo(40 + i * 40, 40);
      ctx.lineTo(40 + i * 40 + rnd() * 20, 216);
      ctx.stroke();
    }
  } else {
    ctx.font = 'bold 72px sans-serif';
    ctx.fillStyle = c;
    ctx.textAlign = 'center';
    ctx.fillText('LIVE', 128, 150);
  }
  ctx.globalAlpha = 1;
  return canvas;
}

function buildCanvas(kind: ProceduralTextureKind, seed: number): HTMLCanvasElement {
  switch (kind) {
    case 'wood_oak':
      return woodGrain(seed, '#a06a3f', '#7c4c26', '#5f3a1c');
    case 'wood_walnut':
      return woodGrain(seed + 7, '#4b3a30', '#2f2219', '#20150e');
    case 'fabric_linen':
      return fabricWeave(seed, '#8d8680', '#b5aea7', '#d6d1cb');
    case 'fabric_velvet':
      return fabricWeave(seed + 3, '#4c1d95', '#6d28d9', '#a78bfa');
    case 'leather':
      return leatherGrain(seed + 11, '#7c4a24', '#5d3417');
    case 'carpet':
      return carpetPattern(seed, '#4a4640', '#625c54');
    case 'concrete':
      return noiseWall(seed, '#78767a');
    case 'marble':
      return marbleSwirl(seed);
    case 'wall_paint':
      return noiseWall(seed, '#e9e7e4');
    case 'wall_brick':
      return brickWall(seed);
    case 'metal_brushed':
      return brushedMetal(seed);
    case 'tile':
      return tileFloor(seed);
    case 'screen_glow': {
      const { canvas, ctx } = makeCanvas(256, 128);
      const grad = ctx.createLinearGradient(0, 0, 256, 128);
      grad.addColorStop(0, '#1e293b');
      grad.addColorStop(0.5, '#334155');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 128);
      ctx.fillStyle = 'rgba(56,189,248,0.15)';
      ctx.fillRect(20, 20, 80, 40);
      ctx.fillStyle = 'rgba(248,113,113,0.12)';
      ctx.fillRect(120, 30, 100, 50);
      return canvas;
    }
    case 'wall_decal':
      return wallDecal(seed);
    default:
      return noiseWall(seed, '#78767a');
  }
}

/** Colour map generation is skipped entirely for flat emissive-style kinds. */
const FLAT_KINDS: ProceduralTextureKind[] = ['screen_glow', 'wall_decal'];

export function getProceduralTexture(kind: ProceduralTextureKind, seed = 0): THREE.CanvasTexture {
  const key = `${kind}:${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const canvas = buildCanvas(kind, seed);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  applyKindRepeat(tex, kind);
  cache.set(key, tex);
  return tex;
}

/** UV tiling per material family — shared by colour and normal maps. */
function applyKindRepeat(tex: THREE.Texture, kind: ProceduralTextureKind): void {
  if (kind.includes('wood') || kind === 'tile' || kind === 'carpet' || kind === 'fabric_linen' || kind === 'fabric_velvet' || kind === 'leather') {
    // Fabrics tile tight so the weave reads as thread, not dots at set distance.
    const r = kind.includes('fabric') ? 7 : kind === 'carpet' ? 3 : 3;
    tex.repeat.set(r, r);
  } else if (kind === 'wall_paint' || kind === 'concrete' || kind === 'wall_brick') {
    tex.repeat.set(4, 2);
  }
}

/**
 * Derives a tangent-space normal map from the material's height (its
 * luminance) with a Sobel filter — this is what makes grain, weave, veins,
 * bricks and grout catch light like the real surface.
 */
const roughnessCache = new Map<string, THREE.DataTexture>();

/**
 * Micro-roughness variation derived from the texture grain — denser/lighter
 * texels read as smoother (polished grain, marble veins) and dark/porous texels
 * as rougher. Green channel carries the roughness value (three.js samples
 * roughnessMap from green), mean-preserving so the material's scalar stays
 * meaningful.
 */
export function getProceduralRoughness(
  kind: ProceduralTextureKind,
  seed = 0,
  baseRoughness = 0.55,
): THREE.DataTexture | null {
  if (FLAT_KINDS.includes(kind)) return null;
  const key = `${kind}:${seed}:${baseRoughness}`;
  const hit = roughnessCache.get(key);
  if (hit) return hit;

  const canvas = buildCanvas(kind, seed);
  const { width, height } = canvas;
  const src = canvas.getContext('2d')!.getImageData(0, 0, width, height).data;
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const o = i * 4;
    const lum = (src[o] * 0.299 + src[o + 1] * 0.587 + src[o + 2] * 0.114) / 255;
    // mean-preserving swing: bright/dense texels a touch smoother, dark/porous rougher
    const rough = Math.min(1, Math.max(0.05, baseRoughness * (0.82 + 0.36 * (1 - lum))));
    const v = Math.round(rough * 255);
    data[o] = v;
    data[o + 1] = v;
    data[o + 2] = v;
    data[o + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  // Linear + mipmapped filtering is essential: DataTexture defaults to NEAREST,
  // which shimmers into a dotted grid whenever the surface is minified.
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 16;
  applyKindRepeat(tex, kind);
  tex.needsUpdate = true;
  roughnessCache.set(key, tex);
  return tex;
}

export function getProceduralNormal(kind: ProceduralTextureKind, seed = 0, strength = 1.1): THREE.DataTexture | null {
  if (FLAT_KINDS.includes(kind)) return null;
  const key = `${kind}:${seed}:${strength}`;
  const hit = normalCache.get(key);
  if (hit) return hit;

  const canvas = buildCanvas(kind, seed);
  const { width, height } = canvas;
  const src = canvas.getContext('2d')!.getImageData(0, 0, width, height).data;

  const lum = new Float32Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const o = i * 4;
    lum[i] = (src[o] * 0.299 + src[o + 1] * 0.587 + src[o + 2] * 0.114) / 255;
  }

  const at = (x: number, y: number) => lum[((y + height) % height) * width + ((x + width) % width)];
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      // Sobel gradients.
      const gx =
        at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) -
        (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const gy =
        at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) -
        (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      // Normal = normalize(-gx, -gy, 1/strength) packed to RGB.
      let nx = -gx * strength;
      let ny = -gy * strength;
      const nz = 1;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= len;
      ny /= len;
      const o = (y * width + x) * 4;
      data[o] = Math.round((nx * 0.5 + 0.5) * 255);
      data[o + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[o + 2] = Math.round((nz / len) * 0.5 * 255 + 127.5);
      data[o + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  // Same filtering fix as the roughness map — NEAREST sampling here is what
  // made fabric and plaster sparkle with aliasing dots under minification.
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 16;
  applyKindRepeat(tex, kind);
  tex.needsUpdate = true;
  normalCache.set(key, tex);
  return tex;
}
