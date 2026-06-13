import type { DisplayBackground, DisplaySlide } from '../types/displayFeed';
import {
  DISPLAY_CANVAS_HEIGHT,
  DISPLAY_CANVAS_WIDTH,
  DISPLAY_SCRIPTURE_REFERENCE_PX,
  DISPLAY_SCRIPTURE_TEXT_PX,
  DISPLAY_SCRIPTURE_TRANSLATION_PX,
  DISPLAY_TEXT_SIZE_PX,
} from './displayCanvas';
import { CHROMA_KEY_GREEN, chromaKeyGreenRgb } from './chromaKeyColor';
import { DISPLAY_BACKGROUND_PRESETS } from './displayBackgrounds';

function parseCssColor(css: string): [number, number, number] {
  const trimmed = css.trim();
  if (trimmed.startsWith('#')) {
    const h = trimmed.replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const n = parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgbMatch = trimmed.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])];
  return [10, 10, 10];
}

function presetSolidColor(presetId: string | undefined): [number, number, number] {
  const preset = DISPLAY_BACKGROUND_PRESETS.find((p) => p.id === presetId);
  if (!preset) return [15, 23, 42];
  if (preset.css.startsWith('#')) return parseCssColor(preset.css);
  const hex = preset.css.match(/#[0-9a-fA-F]{3,8}/);
  return hex ? parseCssColor(hex[0]) : [15, 23, 42];
}

function fillBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  bg: DisplayBackground | undefined,
  keyMode: boolean,
): void {
  if (keyMode) {
    const [r, g, b] = chromaKeyGreenRgb();
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(0, 0, w, h);
    return;
  }

  if (!bg) {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);
    return;
  }

  if (bg.kind === 'color' && bg.color) {
    const [r, g, b] = parseCssColor(bg.color);
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(0, 0, w, h);
    return;
  }

  if (bg.kind === 'image' && bg.imageUrl) {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);
    return;
  }

  const [r, g, b] = presetSolidColor(bg.presetId);
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.fillRect(0, 0, w, h);
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const ir = img.naturalWidth / img.naturalHeight;
  const dr = w / h;
  let sw = w;
  let sh = h;
  let sx = x;
  let sy = y;
  if (ir > dr) {
    sw = h * ir;
    sx = x - (sw - w) / 2;
  } else {
    sh = w / ir;
    sy = y - (sh - h) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh);
}

function loadCachedImage(url: string, cache: Map<string, HTMLImageElement>): HTMLImageElement | null {
  const existing = cache.get(url);
  if (existing?.complete && existing.naturalWidth > 0) return existing;
  if (!existing) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    cache.set(url, img);
  }
  const loaded = cache.get(url);
  return loaded?.complete && loaded.naturalWidth > 0 ? loaded : null;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function drawTextBlock(
  ctx: CanvasRenderingContext2D,
  slide: DisplaySlide,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  const padX = 96;
  const padY = 48;
  let cursorY = y + padY;

  const fields = slide.fields.filter((f) => f.visible && f.value.trim());
  for (const field of fields) {
    const size = DISPLAY_TEXT_SIZE_PX[field.size];
    ctx.font = `600 ${size}px system-ui, sans-serif`;
    ctx.fillStyle = field.color ?? '#ffffff';
    ctx.textAlign = field.align === 'left' ? 'left' : field.align === 'right' ? 'right' : 'center';
    const textX =
      field.align === 'left' ? x + padX : field.align === 'right' ? x + w - padX : x + w / 2;
    const lines = wrapText(ctx, field.value, w - padX * 2);
    for (const line of lines) {
      ctx.fillText(line, textX, cursorY + size);
      cursorY += size * 1.35;
    }
    cursorY += 12;
  }

  if (slide.type === 'scripture' && slide.scripture && fields.length === 0) {
    ctx.textAlign = 'center';
    ctx.font = `700 ${DISPLAY_SCRIPTURE_REFERENCE_PX}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(slide.scripture.reference, x + w / 2, cursorY + DISPLAY_SCRIPTURE_REFERENCE_PX);
    cursorY += DISPLAY_SCRIPTURE_REFERENCE_PX * 1.5;

    ctx.font = `italic 600 ${DISPLAY_SCRIPTURE_TEXT_PX}px Georgia, serif`;
    ctx.fillStyle = '#ffffff';
    const lines = wrapText(ctx, slide.scripture.text, w - padX * 2);
    for (const line of lines) {
      ctx.fillText(line, x + w / 2, cursorY + DISPLAY_SCRIPTURE_TEXT_PX);
      cursorY += DISPLAY_SCRIPTURE_TEXT_PX * 1.3;
    }

    if (slide.scripture.translation) {
      ctx.font = `${DISPLAY_SCRIPTURE_TRANSLATION_PX}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText(slide.scripture.translation, x + w / 2, cursorY + DISPLAY_SCRIPTURE_TRANSLATION_PX * 1.2);
    }
  }

  ctx.restore();
}

function getBannerHeight(slide: DisplaySlide): number {
  if (slide.layout === 'lower-third') return slide.bannerHeight ?? 22;
  if (slide.layout === 'banner-bottom' || slide.layout === 'banner-top') return slide.bannerHeight ?? 30;
  return 30;
}

/** Paints a Regal Display slide to a 1920×1080 canvas with exact chroma green in KEY areas. */
export function paintDisplaySlideToCanvas(
  ctx: CanvasRenderingContext2D,
  slide: DisplaySlide | null,
  holdBackground: DisplayBackground | undefined,
  keyMode: boolean,
  imageCache: Map<string, HTMLImageElement>,
): void {
  const w = DISPLAY_CANVAS_WIDTH;
  const h = DISPLAY_CANVAS_HEIGHT;
  ctx.clearRect(0, 0, w, h);

  if (!slide) {
    if (keyMode) {
      const [r, g, b] = chromaKeyGreenRgb();
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(0, 0, w, h);
    } else {
      fillBackground(ctx, w, h, holdBackground, false);
      ctx.textAlign = 'center';
      ctx.font = '600 48px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText('Welcome', w / 2, h / 2);
      ctx.font = '24px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillText('HOLD', w / 2, h / 2 + 56);
    }
    return;
  }

  const layout = slide.layout ?? 'full';
  const isBannerBottom = layout === 'banner-bottom' || layout === 'lower-third';
  const isBannerTop = layout === 'banner-top';
  const bannerHeight = getBannerHeight(slide);
  const bannerPx = (bannerHeight / 100) * h;
  const clearPx = h - bannerPx;

  if (isBannerBottom || isBannerTop) {
    const clearY = isBannerBottom ? 0 : bannerPx;
    const bannerY = isBannerBottom ? clearPx : 0;

    if (keyMode) {
      const [kr, kg, kb] = chromaKeyGreenRgb();
      ctx.fillStyle = `rgb(${kr}, ${kg}, ${kb})`;
      ctx.fillRect(0, clearY, w, clearPx);
    } else {
      ctx.save();
      ctx.translate(0, clearY);
      fillBackground(ctx, w, clearPx, slide.background, false);
      ctx.restore();
    }

    const bannerBg = slide.background;
    if (bannerBg.kind === 'image' && bannerBg.imageUrl) {
      const img = loadCachedImage(bannerBg.imageUrl, imageCache);
      if (img) drawImageCover(ctx, img, 0, bannerY, w, bannerPx);
      else {
        ctx.save();
        ctx.translate(0, bannerY);
        fillBackground(ctx, w, bannerPx, bannerBg, false);
        ctx.restore();
      }
    } else {
      ctx.save();
      ctx.translate(0, bannerY);
      fillBackground(ctx, w, bannerPx, bannerBg, false);
      ctx.restore();
    }

    if ((bannerBg.overlayOpacity ?? 0) > 0 && !keyMode) {
      ctx.fillStyle = `rgba(0,0,0,${(bannerBg.overlayOpacity ?? 0) / 100})`;
      ctx.fillRect(0, bannerY, w, bannerPx);
    }

    drawTextBlock(ctx, slide, 0, bannerY, w, bannerPx);
    return;
  }

  const bg = slide.background;
  if (bg.kind === 'image' && bg.imageUrl && !keyMode) {
    const img = loadCachedImage(bg.imageUrl, imageCache);
    if (img) drawImageCover(ctx, img, 0, 0, w, h);
    else fillBackground(ctx, w, h, bg, false);
  } else {
    fillBackground(ctx, w, h, keyMode ? { kind: 'color', color: CHROMA_KEY_GREEN, overlayOpacity: 0 } : bg, keyMode);
  }

  const overlayOpacity = bg.overlayOpacity ?? 0;
  if (overlayOpacity > 0 && !keyMode) {
    ctx.fillStyle = `rgba(0,0,0,${overlayOpacity / 100})`;
    ctx.fillRect(0, 0, w, h);
  }

  if (slide.foregroundImageUrl) {
    const fg = loadCachedImage(slide.foregroundImageUrl, imageCache);
    if (fg) {
      const maxW = 720;
      const maxH = 320;
      const scale = Math.min(maxW / fg.naturalWidth, maxH / fg.naturalHeight, 1);
      const fw = fg.naturalWidth * scale;
      const fh = fg.naturalHeight * scale;
      ctx.drawImage(fg, (w - fw) / 2, h * 0.15, fw, fh);
    }
  }

  drawTextBlock(ctx, slide, 0, 0, w, h);
}
