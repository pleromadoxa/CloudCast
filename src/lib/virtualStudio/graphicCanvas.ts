import type { StudioGraphicContent, StudioScreenForm, StudioScreenSource } from './types';
import { suggestedTextureSize } from './screenSources';

/**
 * Procedural broadcast graphics rendered into a 2D canvas, which the stage then
 * uploads as a texture. This is how scorebugs, lower thirds, logos and slates
 * land on physical screens inside the 3D set without any external assets.
 */

const FONT_STACK =
  '"Helvetica Neue", Helvetica, Arial, "Segoe UI", system-ui, sans-serif';

export interface GraphicCanvasHandle {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

export function createGraphicCanvas(
  form: StudioScreenForm,
  /** Physical surface aspect — keeps procedural graphics undistorted. */
  aspect?: number,
): GraphicCanvasHandle {
  const { width, height } = suggestedTextureSize(form, aspect);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable for studio graphic');
  return { canvas, ctx, width, height };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  basePx: number,
  weight = 700,
): number {
  let size = basePx;
  ctx.font = `${weight} ${size}px ${FONT_STACK}`;
  while (size > 8 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${FONT_STACK}`;
  }
  return size;
}

/**
 * Wraps `text` to `maxWidth` (up to `maxLines` lines) and draws it with the
 * current font at `x, y` using left/top alignment. The last line is
 * ellipsized when the text overflows.
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): void {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  let overflow = false;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) {
        overflow = true;
        break;
      }
    } else {
      line = candidate;
    }
  }
  if (overflow) {
    // Ellipsize the final line so it always fits the measure width.
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = `${last.trimEnd()}…`;
  } else if (line) {
    lines.push(line);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  lines.forEach((row, i) => ctx.fillText(row, x, y + i * lineHeight));
}

/* ------------------------------------------------- photographic plates */

/** Deterministic PRNG so procedural scenes don't flicker between redraws. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Dusk city skyline — the hero "view" behind studio windows. Gradient sky,
 * layered tower silhouettes with lit windows and a reflective waterfront.
 */
function drawSkyline(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const horizon = height * 0.72;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#0a1633');
  sky.addColorStop(0.45, '#274a7d');
  sky.addColorStop(0.82, '#c96f3f');
  sky.addColorStop(1, '#e8a05c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, horizon);
  // water / plaza
  const water = ctx.createLinearGradient(0, horizon, 0, height);
  water.addColorStop(0, '#8a5a3c');
  water.addColorStop(0.25, '#1d2b47');
  water.addColorStop(1, '#0a1226');
  ctx.fillStyle = water;
  ctx.fillRect(0, horizon, width, height - horizon);

  const rand = lcg(20260926);
  // stars in the upper sky
  for (let i = 0; i < 90; i += 1) {
    const x = rand() * width;
    const y = rand() * horizon * 0.45;
    ctx.fillStyle = `rgba(255,255,255,${0.12 + rand() * 0.35})`;
    ctx.fillRect(x, y, 1.6, 1.6);
  }

  type Tower = { x: number; w: number; h: number; tone: string; lit: string; win: number };
  const towers: Tower[] = [];
  const layers = [
    { count: 16, hMin: 0.18, hMax: 0.4, tone: '#22314e', lit: 'rgba(255,210,150,0.5)', alpha: 0.85 },
    { count: 12, hMin: 0.3, hMax: 0.62, tone: '#131e33', lit: 'rgba(255,214,160,0.85)', alpha: 1 },
    { count: 7, hMin: 0.42, hMax: 0.82, tone: '#0a1122', lit: 'rgba(255,226,180,0.95)', alpha: 1 },
  ];
  for (const layer of layers) {
    let x = -width * 0.02;
    while (x < width) {
      const w = (0.035 + rand() * 0.075) * width;
      const h = (layer.hMin + rand() * (layer.hMax - layer.hMin)) * horizon;
      towers.push({ x, w, h, tone: layer.tone, lit: layer.lit, win: 0.55 + rand() * 0.45 });
      x += w * (0.72 + rand() * 0.5);
    }
    for (const t of towers.slice(-Math.ceil(layer.count))) {
      ctx.globalAlpha = layer.alpha;
      ctx.fillStyle = t.tone;
      ctx.fillRect(t.x, horizon - t.h, t.w, t.h);
      // crown / antenna on the tallest
      if (t.h > horizon * 0.55) {
        ctx.fillRect(t.x + t.w * 0.45, horizon - t.h - t.w * 0.5, t.w * 0.1, t.w * 0.5);
      }
      // lit window grid
      const winW = Math.max(1.5, t.w * 0.075);
      const gapX = winW * 1.9;
      const gapY = winW * 2.6;
      for (let wy = horizon - t.h + gapY; wy < horizon - gapY * 0.6; wy += gapY) {
        for (let wx = t.x + gapX; wx < t.x + t.w - gapX * 0.6; wx += gapX) {
          if (rand() < t.win * 0.62) {
            ctx.fillStyle = rand() < 0.82 ? t.lit : 'rgba(160,210,255,0.7)';
            ctx.fillRect(wx, wy, winW, winW * 1.5);
          }
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // warm reflections streaking into the water
  ctx.save();
  ctx.globalAlpha = 0.22;
  for (const t of towers) {
    if (rand() < 0.5) continue;
    const grad = ctx.createLinearGradient(0, horizon, 0, height);
    grad.addColorStop(0, t.lit);
    grad.addColorStop(1, 'rgba(255,200,150,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(t.x + t.w * 0.2, horizon, t.w * 0.6, (height - horizon) * (0.3 + rand() * 0.55));
  }
  ctx.restore();
  // horizon haze
  const haze = ctx.createLinearGradient(0, horizon - height * 0.06, 0, horizon + height * 0.02);
  haze.addColorStop(0, 'rgba(255,170,110,0)');
  haze.addColorStop(1, 'rgba(255,180,120,0.4)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizon - height * 0.06, width, height * 0.08);
}

/** Golden curved-glass architecture — the hero plate on flagship video walls. */
function drawArchitecture(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const sky = ctx.createLinearGradient(0, 0, width * 0.35, height);
  sky.addColorStop(0, '#12233f');
  sky.addColorStop(0.5, '#2c4a72');
  sky.addColorStop(1, '#7fa3c4');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  const rand = lcg(77123);
  // sweeping golden glass ribbons (curved tower façades)
  for (let band = 0; band < 5; band += 1) {
    const x0 = width * (0.18 + band * 0.16) + rand() * width * 0.05;
    const top = height * (0.04 + rand() * 0.12);
    const bottom = height * (0.88 + rand() * 0.1);
    const w = width * (0.1 + rand() * 0.12);
    const grad = ctx.createLinearGradient(x0, top, x0 + w, bottom);
    grad.addColorStop(0, '#ffe6a8');
    grad.addColorStop(0.32, '#e8a33f');
    grad.addColorStop(0.7, '#8a5216');
    grad.addColorStop(1, '#3a2208');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x0, top);
    ctx.quadraticCurveTo(x0 + w * 1.25, (top + bottom) / 2, x0 + w * 0.55, bottom);
    ctx.lineTo(x0 + w * 0.18, bottom);
    ctx.quadraticCurveTo(x0 + w * 0.75, (top + bottom) / 2, x0 - w * 0.18, top);
    ctx.closePath();
    ctx.fill();
    // glass floor-lines
    ctx.strokeStyle = 'rgba(255,236,190,0.35)';
    ctx.lineWidth = Math.max(1, width * 0.0016);
    for (let i = 1; i < 26; i += 1) {
      const y = top + ((bottom - top) * i) / 26;
      ctx.beginPath();
      ctx.moveTo(x0 - w * 0.1 + i * 1.2, y);
      ctx.lineTo(x0 + w * 0.62 + i * 1.2, y);
      ctx.stroke();
    }
  }
  // sky-reflecting pool at the base
  const pool = ctx.createLinearGradient(0, height * 0.82, 0, height);
  pool.addColorStop(0, 'rgba(240,190,120,0.55)');
  pool.addColorStop(1, 'rgba(20,30,50,0.9)');
  ctx.fillStyle = pool;
  ctx.fillRect(0, height * 0.82, width, height * 0.18);
  // sun flare
  const flare = ctx.createRadialGradient(width * 0.78, height * 0.2, 2, width * 0.78, height * 0.2, width * 0.35);
  flare.addColorStop(0, 'rgba(255,225,170,0.55)');
  flare.addColorStop(1, 'rgba(255,225,170,0)');
  ctx.fillStyle = flare;
  ctx.fillRect(0, 0, width, height);
}

/** Floodlit stadium bowl — hero plate for sports sets. Horizontal banding so
 *  the composition reads correctly on any surface aspect (5:1 curved walls,
 *  2.6:1 backdrops, 16:9 jumbotrons). */
function drawStadium(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  // night sky
  const sky = ctx.createLinearGradient(0, 0, 0, height * 0.5);
  sky.addColorStop(0, '#0a1220');
  sky.addColorStop(1, '#22375c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  const rand = lcg(424242);

  // floodlight towers with wide halos
  for (const fx of [0.12, 0.5, 0.88]) {
    const x = width * fx;
    const y = height * 0.12;
    const glow = ctx.createRadialGradient(x, y, 2, x, y, width * 0.18);
    glow.addColorStop(0, 'rgba(245,250,255,1)');
    glow.addColorStop(0.12, 'rgba(210,228,255,0.55)');
    glow.addColorStop(1, 'rgba(190,215,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - width * 0.2, y - width * 0.18, width * 0.4, width * 0.36);
    ctx.fillStyle = '#f6faff';
    for (let i = -2; i <= 2; i += 1) {
      for (let j = -1; j <= 1; j += 1) {
        ctx.beginPath();
        ctx.arc(x + i * width * 0.018, y + j * height * 0.038, width * 0.007, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // tiered stands as horizontal bands — dense crowd speckle
  const standTop = height * 0.34;
  const standBottom = height * 0.72;
  const bands = 5;
  for (let b = 0; b < bands; b += 1) {
    const y0 = standTop + ((standBottom - standTop) * b) / bands;
    const h = (standBottom - standTop) / bands;
    ctx.fillStyle = b % 2 === 0 ? '#2f4670' : '#26395c';
    ctx.fillRect(0, y0, width, h);
    // bright edge line on each tier
    ctx.fillStyle = 'rgba(190,210,255,0.28)';
    ctx.fillRect(0, y0, width, Math.max(1, height * 0.004));
    // crowd
    const count = Math.round((width * h) / 900);
    for (let i = 0; i < count; i += 1) {
      const px = rand() * width;
      const py = y0 + rand() * h * 0.92;
      ctx.fillStyle = `rgba(${215 + rand() * 40},${218 + rand() * 37},${228 + rand() * 27},${0.25 + rand() * 0.6})`;
      const s = width * 0.0022 + rand() * width * 0.0022;
      ctx.fillRect(px, py, s, s);
    }
  }

  // advertising ribbon above the pitch
  const ribbonY = standBottom;
  const ribbonH = height * 0.055;
  ctx.fillStyle = '#101a2e';
  ctx.fillRect(0, ribbonY, width, ribbonH);
  for (let i = 0; i < 14; i += 1) {
    ctx.fillStyle = i % 3 === 0 ? '#c8102e' : i % 3 === 1 ? '#e8eefc' : '#2b6cd4';
    ctx.globalAlpha = 0.75;
    ctx.fillRect((width * i) / 14 + width * 0.004, ribbonY + ribbonH * 0.22, width / 14 - width * 0.008, ribbonH * 0.56);
    ctx.globalAlpha = 1;
  }

  // pitch
  const pitchTop = ribbonY + ribbonH;
  const pitch = ctx.createLinearGradient(0, pitchTop, 0, height);
  pitch.addColorStop(0, '#43915a');
  pitch.addColorStop(1, '#2c6f42');
  ctx.fillStyle = pitch;
  ctx.fillRect(0, pitchTop, width, height - pitchTop);
  // mow stripes
  for (let i = 0; i < 8; i += 1) {
    if (i % 2 === 0) continue;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect((width * i) / 8, pitchTop, width / 8, height - pitchTop);
  }
  // markings
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = Math.max(1, width * 0.0028);
  ctx.beginPath();
  ctx.moveTo(0, pitchTop + (height - pitchTop) * 0.22);
  ctx.lineTo(width, pitchTop + (height - pitchTop) * 0.22);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(width / 2, pitchTop + (height - pitchTop) * 0.55, width * 0.16, (height - pitchTop) * 0.3, 0, 0, Math.PI * 2);
  ctx.stroke();

  // atmosphere: light haze from the towers
  const haze = ctx.createLinearGradient(0, height * 0.1, 0, height * 0.55);
  haze.addColorStop(0, 'rgba(180,205,255,0.18)');
  haze.addColorStop(1, 'rgba(180,205,255,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, width, height * 0.55);
}

/** Warm out-of-focus bokeh wash — talk-show / worship backdrop content. */
function drawStageGlow(ctx: CanvasRenderingContext2D, width: number, height: number, accent = '#f59e0b'): void {
  const base = ctx.createRadialGradient(width / 2, height * 0.42, 10, width / 2, height * 0.42, width * 0.7);
  base.addColorStop(0, accent);
  base.addColorStop(0.45, '#3a2410');
  base.addColorStop(1, '#0b0806');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);
  const rand = lcg(31337);
  for (let i = 0; i < 26; i += 1) {
    const x = rand() * width;
    const y = rand() * height;
    const r = (0.02 + rand() * 0.12) * width;
    const a = 0.05 + rand() * 0.16;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,210,150,${a})`);
    g.addColorStop(0.7, `rgba(255,190,120,${a * 0.4})`);
    g.addColorStop(1, 'rgba(255,190,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Paint the content onto an existing handle. Clears the canvas first. */
export function drawStudioGraphic(
  handle: GraphicCanvasHandle,
  content: StudioGraphicContent,
  /** Animation clock in seconds — drives the news crawl scroll and live clocks. */
  tSeconds = 0,
): void {
  const { ctx, width, height } = handle;
  const accent = content.accent ?? '#e11d48';
  const background = content.background ?? '#0b1020';
  const foreground = content.foreground ?? '#ffffff';

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  switch (content.style) {
    case 'solid': {
      // plain colour field — usable as a fallback / test pattern
      break;
    }
    case 'slate': {
      ctx.fillStyle = foreground;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitFont(ctx, content.text ?? 'OFF AIR', width * 0.8, Math.round(height * 0.22));
      ctx.fillText(content.text ?? 'OFF AIR', width / 2, height / 2 - height * 0.06);
      if (content.subtext) {
        ctx.globalAlpha = 0.7;
        fitFont(ctx, content.subtext, width * 0.7, Math.round(height * 0.08), 500);
        ctx.fillText(content.subtext, width / 2, height / 2 + height * 0.14);
        ctx.globalAlpha = 1;
      }
      break;
    }
    case 'logo': {
      const cx = width / 2;
      const cy = height / 2;
      const r = Math.min(width, height) * 0.3;
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = foreground;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = (content.text ?? 'CC').slice(0, 3).toUpperCase();
      fitFont(ctx, label, r * 1.6, Math.round(r * 0.9));
      ctx.fillText(label, cx, cy + r * 0.04);
      break;
    }
    case 'lower-third': {
      const barH = Math.round(height * 0.34);
      const y = height - barH - Math.round(height * 0.08);
      const pad = Math.round(width * 0.04);
      ctx.fillStyle = 'rgba(5, 8, 18, 0.88)';
      roundRect(ctx, pad, y, width - pad * 2, barH, Math.round(barH * 0.12));
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.fillRect(pad, y, Math.round(barH * 0.16), barH);
      ctx.fillStyle = foreground;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const textX = pad + Math.round(barH * 0.3);
      const headline = content.text ?? '';
      const size = fitFont(ctx, headline, width - textX - pad, Math.round(barH * 0.46));
      ctx.fillText(headline, textX, y + barH * (content.subtext ? 0.34 : 0.5));
      if (content.subtext) {
        ctx.globalAlpha = 0.75;
        fitFont(ctx, content.subtext, width - textX - pad, Math.round(size * 0.62), 500);
        ctx.fillText(content.subtext, textX, y + barH * 0.74);
        ctx.globalAlpha = 1;
      }
      break;
    }
    case 'scorebug': {
      const bugH = Math.round(height * 0.5);
      const y = Math.round(height * 0.06);
      const pad = Math.round(width * 0.03);
      ctx.fillStyle = 'rgba(4, 6, 14, 0.92)';
      roundRect(ctx, pad, y, width - pad * 2, bugH, Math.round(bugH * 0.18));
      ctx.fill();
      ctx.fillStyle = accent;
      roundRect(ctx, pad, y, Math.round(bugH * 0.9), bugH, Math.round(bugH * 0.18));
      ctx.fill();
      ctx.fillStyle = foreground;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const cx = pad + bugH * 0.45;
      fitFont(ctx, content.text ?? 'HOME', bugH * 0.7, Math.round(bugH * 0.4));
      ctx.fillText((content.text ?? 'HOME').slice(0, 3).toUpperCase(), cx, y + bugH / 2);
      ctx.textAlign = 'left';
      const teamX = pad + bugH * 1.1;
      fitFont(ctx, content.subtext ?? '', width - teamX - pad, Math.round(bugH * 0.42));
      ctx.fillText(content.subtext ?? '', teamX, y + bugH * 0.5);
      if (content.detail) {
        ctx.textAlign = 'right';
        ctx.globalAlpha = 0.85;
        fitFont(ctx, content.detail, bugH * 1.6, Math.round(bugH * 0.34), 600);
        ctx.fillText(content.detail, width - pad - bugH * 0.2, y + bugH * 0.5);
        ctx.globalAlpha = 1;
      }
      break;
    }
    case 'breaking': {
      // Full-bleed breaking news canvas: crimson tag, headline, bottom strap.
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, '#070a12');
      bg.addColorStop(1, '#111a2c');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      const pad = Math.round(width * 0.05);
      // BREAKING tag (top-left) with a pulsing dot when animated.
      const tagH = Math.round(height * 0.115);
      const tagW = Math.round(width * 0.30);
      const tagY = Math.round(height * 0.12);
      ctx.fillStyle = '#c8102e';
      roundRect(ctx, pad, tagY, tagW, tagH, Math.round(tagH * 0.18));
      ctx.fill();
      const dotR = tagH * 0.12;
      const pulse = content.animated ? 0.65 + 0.35 * Math.abs(Math.sin(tSeconds * 2.2)) : 1;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pad + tagH * 0.42, tagY + tagH / 2, dotR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      fitFont(ctx, 'BREAKING NEWS', tagW * 0.72, Math.round(tagH * 0.44), 800);
      ctx.fillText('BREAKING NEWS', pad + tagH * 0.75, tagY + tagH / 2);

      // Headline block (up to 3 lines).
      const headline = content.text ?? 'BREAKING STORY';
      const headMaxW = width - pad * 2;
      const headSize = fitFont(ctx, headline, headMaxW / 2.2, Math.round(height * 0.15), 800);
      ctx.fillStyle = foreground;
      ctx.textBaseline = 'top';
      const headY = tagY + tagH + Math.round(height * 0.08);
      wrapText(ctx, headline, pad, headY, headMaxW, headSize * 1.12, 3);

      if (content.subtext) {
        ctx.globalAlpha = 0.82;
        fitFont(ctx, content.subtext, headMaxW, Math.round(headSize * 0.58), 500);
        ctx.fillText(content.subtext, pad, headY + headSize * 2.6);
        ctx.globalAlpha = 1;
      }

      // Bottom strap — full-width crimson band with attribution + live time.
      const strapH = Math.round(height * 0.16);
      const strapY = height - strapH;
      ctx.fillStyle = '#c8102e';
      ctx.fillRect(0, strapY, width, strapH);
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      const strapLabel = content.name || content.source || content.footer || 'LIVE';
      fitFont(ctx, strapLabel, width * 0.6, Math.round(strapH * 0.42), 700);
      ctx.fillText(strapLabel.toUpperCase(), pad, strapY + strapH / 2);
      if (content.role) {
        ctx.textAlign = 'right';
        ctx.globalAlpha = 0.92;
        fitFont(ctx, content.role, width * 0.32, Math.round(strapH * 0.32), 500);
        ctx.fillText(content.role, width - pad, strapY + strapH / 2);
        ctx.globalAlpha = 1;
      }
      // Thin accent rule above the strap for that broadcast polish.
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.35;
      ctx.fillRect(0, strapY - 3, width, 3);
      ctx.globalAlpha = 1;
      break;
    }
    case 'crawler': {
      // News-channel canvas: channel bug, current headline, live crawl band.
      const bg = ctx.createLinearGradient(0, 0, width, height);
      bg.addColorStop(0, '#0a1226');
      bg.addColorStop(0.55, '#101c3a');
      bg.addColorStop(1, '#0a1226');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      const pad = Math.round(width * 0.045);

      // Channel bug top-left + LIVE pill top-right.
      const bugH = Math.round(height * 0.115);
      ctx.fillStyle = accent;
      roundRect(ctx, pad, pad, Math.round(width * 0.16), bugH, Math.round(bugH * 0.2));
      ctx.fill();
      ctx.fillStyle = foreground;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const bugLabel = (content.source ?? 'NEWS').slice(0, 8).toUpperCase();
      fitFont(ctx, bugLabel, width * 0.13, Math.round(bugH * 0.42), 800);
      ctx.fillText(bugLabel, pad + width * 0.08, pad + bugH / 2);

      const liveW = Math.round(width * 0.09);
      const liveH = Math.round(bugH * 0.62);
      ctx.fillStyle = '#c8102e';
      roundRect(ctx, width - pad - liveW, pad + (bugH - liveH) / 2, liveW, liveH, liveH / 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      fitFont(ctx, 'LIVE', liveW * 0.7, Math.round(liveH * 0.5), 800);
      ctx.fillText('LIVE', width - pad - liveW / 2, pad + bugH / 2);

      // Current headline — big, centered in the body area.
      const headline = content.text ?? content.items?.[0] ?? 'TOP STORIES';
      const bodyY = Math.round(height * 0.3);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = foreground;
      const headSize = fitFont(ctx, headline, width - pad * 2, Math.round(height * 0.13), 800);
      wrapText(ctx, headline, pad, bodyY, width - pad * 2, headSize * 1.12, 2);
      if (content.subtext) {
        ctx.globalAlpha = 0.78;
        fitFont(ctx, content.subtext, width - pad * 2, Math.round(headSize * 0.52), 500);
        ctx.fillText(content.subtext, pad, bodyY + headSize * 2.3);
        ctx.globalAlpha = 1;
      }

      // Crawl band: category rail + scrolling crawl.
      const railH = Math.round(height * 0.115);
      const crawlH = Math.round(height * 0.16);
      const railY = height - railH - crawlH;
      const crawlY = height - crawlH;
      ctx.fillStyle = '#c8102e';
      ctx.fillRect(0, railY, width, railH);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      fitFont(ctx, content.role ?? 'BREAKING', width * 0.4, Math.round(railH * 0.42), 800);
      ctx.fillText((content.role ?? 'BREAKING').toUpperCase(), pad, railY + railH / 2);

      ctx.fillStyle = 'rgba(4, 8, 20, 0.96)';
      ctx.fillRect(0, crawlY, width, crawlH);
      const items = content.items?.length ? content.items : [headline];
      const separator = '     •     ';
      const crawlText = items.map((t) => t.toUpperCase()).join(separator) + separator;
      fitFont(ctx, crawlText, width * 8, Math.round(crawlH * 0.42), 600);
      const unitWidth = ctx.measureText(crawlText).width;
      const speed = Math.max(24, width * 0.055); // px per second — newsroom pace
      const offset = unitWidth > 0 ? (tSeconds * speed) % unitWidth : 0;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, crawlY, width, crawlH);
      ctx.clip();
      ctx.fillStyle = foreground;
      let x = -offset;
      // Two-and-a-half copies guarantee seamless wrap at any offset.
      for (let copy = 0; copy < 3; copy += 1) {
        ctx.fillText(crawlText, x, crawlY + crawlH / 2);
        x += unitWidth;
      }
      ctx.restore();
      // Accent hairline between rail and crawl.
      ctx.fillStyle = accent;
      ctx.fillRect(0, crawlY - 2, width, 2);
      break;
    }
    case 'headline': {
      // Stacked TOP STORIES rundown — the "papers review" look.
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, '#0c1526');
      bg.addColorStop(1, '#0a0f1c');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      const pad = Math.round(width * 0.05);
      const headerH = Math.round(height * 0.15);
      ctx.fillStyle = accent;
      ctx.fillRect(0, 0, width, headerH);
      ctx.fillStyle = foreground;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const headerLabel = (content.text ?? 'TOP STORIES').toUpperCase();
      fitFont(ctx, headerLabel, width * 0.7, Math.round(headerH * 0.46), 800);
      ctx.fillText(headerLabel, pad, headerH / 2);
      if (content.source) {
        ctx.textAlign = 'right';
        ctx.globalAlpha = 0.92;
        fitFont(ctx, content.source.toUpperCase(), width * 0.26, Math.round(headerH * 0.3), 600);
        ctx.fillText(content.source.toUpperCase(), width - pad, headerH / 2);
        ctx.globalAlpha = 1;
      }

      const rows = (content.items?.length ? content.items : [content.subtext ?? '']).filter(Boolean).slice(0, 6);
      const rowH = (height - headerH - Math.round(height * 0.04)) / Math.max(1, rows.length);
      rows.forEach((row, i) => {
        const y = headerH + i * rowH;
        if (i % 2 === 1) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
          ctx.fillRect(0, y, width, rowH);
        }
        // Numbered chip.
        const chipSize = Math.round(rowH * 0.52);
        const chipY = y + (rowH - chipSize) / 2;
        ctx.fillStyle = i === 0 ? accent : 'rgba(255, 255, 255, 0.14)';
        roundRect(ctx, pad, chipY, chipSize, chipSize, Math.round(chipSize * 0.22));
        ctx.fill();
        ctx.fillStyle = foreground;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        fitFont(ctx, String(i + 1), chipSize * 0.8, Math.round(chipSize * 0.52), 800);
        ctx.fillText(String(i + 1), pad + chipSize / 2, y + rowH / 2);
        // Headline row.
        ctx.textAlign = 'left';
        const textX = pad + chipSize + Math.round(rowH * 0.28);
        fitFont(ctx, row, width - textX - pad, Math.round(rowH * 0.34), 600);
        ctx.fillText(row, textX, y + rowH / 2);
        // Rule under the row.
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fillRect(pad, y + rowH - 1, width - pad * 2, 1);
      });
      break;
    }
    case 'strap': {
      // Guest ident strap — name over role, accent rule, source chip.
      const pad = Math.round(width * 0.05);
      const boxH = Math.round(height * 0.32);
      const y = height - boxH - Math.round(height * 0.1);
      const boxW = width - pad * 2;
      ctx.fillStyle = 'rgba(6, 10, 22, 0.92)';
      roundRect(ctx, pad, y, boxW, boxH, Math.round(boxH * 0.12));
      ctx.fill();
      // Accent rule.
      const ruleW = Math.round(boxW * 0.012);
      ctx.fillStyle = accent;
      roundRect(ctx, pad, y, ruleW, boxH, ruleW / 2);
      ctx.fill();
      const textX = pad + ruleW + Math.round(boxW * 0.045);
      ctx.fillStyle = foreground;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const name = content.name ?? content.text ?? 'NAME';
      fitFont(ctx, name, boxW * 0.72, Math.round(boxH * 0.36), 800);
      ctx.fillText(name, textX, y + boxH * (content.role ? 0.36 : 0.5));
      if (content.role) {
        ctx.globalAlpha = 0.8;
        fitFont(ctx, content.role, boxW * 0.72, Math.round(boxH * 0.22), 500);
        ctx.fillText(content.role, textX, y + boxH * 0.7);
        ctx.globalAlpha = 1;
      }
      if (content.source) {
        // Right-side source chip.
        const chipH = Math.round(boxH * 0.3);
        const chipW = Math.round(boxW * 0.2);
        const chipX = pad + boxW - chipW - Math.round(boxW * 0.035);
        const chipY = y + (boxH - chipH) / 2;
        ctx.fillStyle = accent;
        roundRect(ctx, chipX, chipY, chipW, chipH, Math.round(chipH * 0.24));
        ctx.fill();
        ctx.fillStyle = foreground;
        ctx.textAlign = 'center';
        fitFont(ctx, content.source.toUpperCase(), chipW * 0.8, Math.round(chipH * 0.4), 700);
        ctx.fillText(content.source.toUpperCase(), chipX + chipW / 2, chipY + chipH / 2);
      }
      if (content.footer) {
        ctx.textAlign = 'left';
        ctx.globalAlpha = 0.72;
        fitFont(ctx, content.footer, boxW * 0.9, Math.round(boxH * 0.16), 500);
        ctx.fillText(content.footer, textX, y + boxH + Math.round(height * 0.05));
        ctx.globalAlpha = 1;
      }
      break;
    }
    case 'skyline': {
      drawSkyline(ctx, width, height);
      break;
    }
    case 'architecture': {
      drawArchitecture(ctx, width, height);
      break;
    }
    case 'stadium': {
      drawStadium(ctx, width, height);
      break;
    }
    case 'stage-glow': {
      drawStageGlow(ctx, width, height, accent);
      break;
    }
  }
}

/** Draw (or redraw) a graphic source, returning the canvas for texturing. */
export function renderGraphicSource(
  handle: GraphicCanvasHandle,
  content: StudioGraphicContent,
): HTMLCanvasElement {
  drawStudioGraphic(handle, content);
  return handle.canvas;
}

/** Convenience: build a graphic screen source with a headline. */
export function graphicSource(
  style: StudioGraphicContent['style'],
  text: string,
  extra: Omit<StudioGraphicContent, 'style' | 'text'> = {},
): StudioScreenSource {
  return { kind: 'graphic', content: { style, text, ...extra } };
}
