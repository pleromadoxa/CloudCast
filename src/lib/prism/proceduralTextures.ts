import * as THREE from 'three';

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

function woodGrain(seed: number, base: string, grain: string) {
  const { canvas, ctx } = makeCanvas(512, 512);
  const rnd = seeded(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 2) {
    const wave = Math.sin(y * 0.02 + rnd() * 2) * 8;
    ctx.strokeStyle = grain;
    ctx.globalAlpha = 0.15 + rnd() * 0.2;
    ctx.lineWidth = 1 + rnd() * 2;
    ctx.beginPath();
    ctx.moveTo(wave, y);
    ctx.bezierCurveTo(128 + wave, y + 4, 384 + wave, y - 4, 512 + wave, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return canvas;
}

function fabricWeave(seed: number, base: string, thread: string) {
  const { canvas, ctx } = makeCanvas(256, 256);
  const rnd = seeded(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 4) {
    for (let y = 0; y < 256; y += 4) {
      ctx.fillStyle = rnd() > 0.5 ? thread : base;
      ctx.globalAlpha = 0.35 + rnd() * 0.25;
      ctx.fillRect(x, y, 3, 3);
    }
  }
  ctx.globalAlpha = 1;
  return canvas;
}

function carpetPattern(seed: number, base: string, accent: string) {
  const { canvas, ctx } = makeCanvas(256, 256);
  const rnd = seeded(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 8) {
    for (let y = 0; y < 256; y += 8) {
      ctx.fillStyle = rnd() > 0.7 ? accent : base;
      ctx.globalAlpha = 0.4 + rnd() * 0.3;
      ctx.fillRect(x + rnd() * 2, y + rnd() * 2, 6, 6);
    }
  }
  ctx.globalAlpha = 1;
  return canvas;
}

function noiseWall(seed: number, color: string) {
  const { canvas, ctx } = makeCanvas(256, 256);
  const rnd = seeded(seed);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8000; i++) {
    const x = rnd() * 256;
    const y = rnd() * 256;
    const v = rnd() * 20 - 10;
    ctx.fillStyle = `rgb(${Math.max(0, Math.min(255, parseInt(color.slice(1, 3), 16) + v))},${Math.max(0, Math.min(255, parseInt(color.slice(3, 5), 16) + v))},${Math.max(0, Math.min(255, parseInt(color.slice(5, 7), 16) + v))})`;
    ctx.fillRect(x, y, 1, 1);
  }
  return canvas;
}

function marbleSwirl(seed: number) {
  const { canvas, ctx } = makeCanvas(512, 512);
  const rnd = seeded(seed);
  ctx.fillStyle = '#e7e5e4';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = `rgba(120,113,108,${0.08 + rnd() * 0.12})`;
    ctx.lineWidth = 2 + rnd() * 6;
    ctx.beginPath();
    ctx.moveTo(rnd() * 512, rnd() * 512);
    for (let j = 0; j < 6; j++) {
      ctx.lineTo(rnd() * 512, rnd() * 512);
    }
    ctx.stroke();
  }
  return canvas;
}

function brickWall(seed: number) {
  const { canvas, ctx } = makeCanvas(256, 256);
  const rnd = seeded(seed);
  ctx.fillStyle = '#78716c';
  ctx.fillRect(0, 0, 256, 256);
  const brickH = 16;
  const brickW = 48;
  for (let row = 0; row < 256 / brickH; row++) {
    const offset = row % 2 === 0 ? 0 : brickW / 2;
    for (let col = -1; col < 256 / brickW + 1; col++) {
      const shade = 140 + Math.floor(rnd() * 40);
      ctx.fillStyle = `rgb(${shade},${shade - 15},${shade - 25})`;
      ctx.fillRect(col * brickW + offset, row * brickH, brickW - 2, brickH - 2);
    }
  }
  return canvas;
}

function brushedMetal() {
  const { canvas, ctx } = makeCanvas(256, 256);
  ctx.fillStyle = '#a8a29e';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y++) {
    ctx.strokeStyle = `rgba(255,255,255,${0.05 + (y % 3) * 0.02})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  return canvas;
}

function tileFloor(seed: number) {
  const { canvas, ctx } = makeCanvas(256, 256);
  const rnd = seeded(seed);
  ctx.fillStyle = '#d6d3d1';
  ctx.fillRect(0, 0, 256, 256);
  const t = 32;
  for (let x = 0; x < 256; x += t) {
    for (let y = 0; y < 256; y += t) {
      const v = rnd() * 15;
      ctx.fillStyle = `rgb(${214 + v},${211 + v},${209 + v})`;
      ctx.fillRect(x + 1, y + 1, t - 2, t - 2);
    }
  }
  return canvas;
}

function wallDecal(seed: number) {
  const { canvas, ctx } = makeCanvas(256, 256);
  const rnd = seeded(seed);
  ctx.clearRect(0, 0, 256, 256);
  const colors = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b'];
  const c = colors[seed % colors.length];
  ctx.strokeStyle = c;
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.85;
  if (seed % 3 === 0) {
    ctx.beginPath();
    ctx.arc(128, 128, 80, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(128, 128, 40, 0, Math.PI * 2);
    ctx.stroke();
  } else if (seed % 3 === 1) {
    for (let i = 0; i < 5; i++) {
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
      return woodGrain(seed, '#92400e', '#78350f');
    case 'wood_walnut':
      return woodGrain(seed + 7, '#44403c', '#292524');
    case 'fabric_linen':
      return fabricWeave(seed, '#78716c', '#a8a29e');
    case 'fabric_velvet':
      return fabricWeave(seed + 3, '#4c1d95', '#6d28d9');
    case 'leather':
      return fabricWeave(seed + 11, '#78350f', '#92400e');
    case 'carpet':
      return carpetPattern(seed, '#44403c', '#57534e');
    case 'concrete':
      return noiseWall(seed, '#71717a');
    case 'marble':
      return marbleSwirl(seed);
    case 'wall_paint':
      return noiseWall(seed, '#e7e5e4');
    case 'wall_brick':
      return brickWall(seed);
    case 'metal_brushed':
      return brushedMetal();
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
      return noiseWall(seed, '#71717a');
  }
}

export function getProceduralTexture(kind: ProceduralTextureKind, seed = 0): THREE.CanvasTexture {
  const key = `${kind}:${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const canvas = buildCanvas(kind, seed);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (kind.includes('wood') || kind === 'tile' || kind === 'carpet' || kind === 'fabric_linen' || kind === 'fabric_velvet' || kind === 'leather') {
    tex.repeat.set(kind === 'carpet' ? 2 : 3, kind === 'carpet' ? 2 : 3);
  }
  cache.set(key, tex);
  return tex;
}
