import type { ChromaBackgroundId } from '../types/chromaBackgrounds';
import { DEFAULT_CHROMA_BACKGROUND_ID } from '../types/chromaBackgrounds';

function fillLinear(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: [number, string][],
) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [pos, color] of stops) g.addColorStop(pos, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function fillRadial(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cx: number,
  cy: number,
  r: number,
  inner: string,
  outer: string,
) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function resolveChromaBackgroundId(id: string | undefined): ChromaBackgroundId {
  const valid = new Set<string>([
    'plain-white', 'plain-black', 'plain-studio-gray', 'plain-soft-blue',
    'gradient-sunset', 'gradient-ocean', 'gradient-purple-haze', 'gradient-broadcast',
    'gradient-emerald', 'gradient-midnight',
    'anim-gradient-flow', 'anim-aurora', 'anim-broadcast-pulse', 'anim-neon-wave', 'anim-deep-mesh',
  ]);
  return valid.has(id ?? '') ? (id as ChromaBackgroundId) : DEFAULT_CHROMA_BACKGROUND_ID;
}

/** Paint a chroma fill background into `ctx` (full canvas). `timeMs` drives animations. */
export function renderChromaBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  id: ChromaBackgroundId,
  timeMs = 0,
): void {
  const t = timeMs / 1000;

  switch (id) {
    case 'plain-white':
      ctx.fillStyle = '#f4f4f5';
      ctx.fillRect(0, 0, w, h);
      break;
    case 'plain-black':
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, w, h);
      break;
    case 'plain-studio-gray':
      ctx.fillStyle = '#3f3f46';
      ctx.fillRect(0, 0, w, h);
      break;
    case 'plain-soft-blue':
      ctx.fillStyle = '#dbeafe';
      ctx.fillRect(0, 0, w, h);
      break;

    case 'gradient-sunset':
      fillLinear(ctx, w, h, 0, 0, w, h, [
        [0, '#f97316'],
        [0.45, '#ec4899'],
        [1, '#581c87'],
      ]);
      break;
    case 'gradient-ocean':
      fillLinear(ctx, w, h, 0, h, w, 0, [
        [0, '#0c4a6e'],
        [0.5, '#0369a1'],
        [1, '#22d3ee'],
      ]);
      break;
    case 'gradient-purple-haze':
      fillLinear(ctx, w, h, 0, 0, w, h, [
        [0, '#312e81'],
        [0.5, '#7c3aed'],
        [1, '#f0abfc'],
      ]);
      break;
    case 'gradient-broadcast':
      fillLinear(ctx, w, h, 0, 0, w, h, [
        [0, '#0f0f12'],
        [0.55, '#1a1a22'],
        [1, '#3b0a0a'],
      ]);
      fillRadial(ctx, w, h, w * 0.85, h * 0.15, w * 0.45, 'rgba(224,32,32,0.35)', 'rgba(224,32,32,0)');
      break;
    case 'gradient-emerald':
      fillLinear(ctx, w, h, 0, h, w, 0, [
        [0, '#064e3b'],
        [0.5, '#059669'],
        [1, '#6ee7b7'],
      ]);
      break;
    case 'gradient-midnight':
      fillLinear(ctx, w, h, 0, 0, 0, h, [
        [0, '#020617'],
        [0.5, '#1e1b4b'],
        [1, '#0f172a'],
      ]);
      break;

    case 'anim-gradient-flow': {
      const shift = (t * 0.08) % 1;
      fillLinear(ctx, w, h, w * shift, 0, w * (shift + 1), h, [
        [0, '#0ea5e9'],
        [0.35, '#8b5cf6'],
        [0.7, '#ec4899'],
        [1, '#f59e0b'],
      ]);
      break;
    }
    case 'anim-aurora': {
      ctx.fillStyle = '#0b1020';
      ctx.fillRect(0, 0, w, h);
      const blobs: [number, number, number, string][] = [
        [0.3 + Math.sin(t * 0.4) * 0.15, 0.35 + Math.cos(t * 0.3) * 0.1, w * 0.55, 'rgba(34,211,238,0.45)'],
        [0.7 + Math.cos(t * 0.35) * 0.12, 0.55 + Math.sin(t * 0.25) * 0.1, w * 0.5, 'rgba(167,139,250,0.4)'],
        [0.5 + Math.sin(t * 0.2) * 0.2, 0.75 + Math.cos(t * 0.45) * 0.08, w * 0.45, 'rgba(52,211,153,0.35)'],
      ];
      for (const [nx, ny, r, color] of blobs) {
        fillRadial(ctx, w, h, w * nx, h * ny, r, color, 'rgba(0,0,0,0)');
      }
      break;
    }
    case 'anim-broadcast-pulse': {
      const pulse = 0.5 + Math.sin(t * 2) * 0.5;
      ctx.fillStyle = '#111116';
      ctx.fillRect(0, 0, w, h);
      fillRadial(
        ctx,
        w,
        h,
        w * 0.5,
        h * 0.5,
        w * (0.35 + pulse * 0.2),
        `rgba(224,32,32,${0.25 + pulse * 0.2})`,
        'rgba(224,32,32,0)',
      );
      fillLinear(ctx, w, h, 0, 0, w, h, [
        [0, 'rgba(15,15,18,0.9)'],
        [1, `rgba(60,10,10,${0.35 + pulse * 0.15})`],
      ]);
      break;
    }
    case 'anim-neon-wave': {
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 4; i++) {
        const phase = t * 0.6 + i * 1.2;
        const yBase = h * (0.25 + i * 0.18) + Math.sin(phase) * h * 0.08;
        const g = ctx.createLinearGradient(0, yBase - 40, 0, yBase + 40);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(0.5, i % 2 === 0 ? 'rgba(236,72,153,0.5)' : 'rgba(34,211,238,0.45)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      break;
    }
    case 'anim-deep-mesh': {
      ctx.fillStyle = '#0c0a14';
      ctx.fillRect(0, 0, w, h);
      const points = [
        [0.2, 0.3], [0.8, 0.25], [0.5, 0.7], [0.15, 0.8], [0.85, 0.75],
      ];
      for (let i = 0; i < points.length; i++) {
        const [bx, by] = points[i];
        const x = w * (bx + Math.sin(t * 0.5 + i) * 0.06);
        const y = h * (by + Math.cos(t * 0.4 + i * 1.3) * 0.06);
        const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#3b82f6'];
        fillRadial(ctx, w, h, x, y, w * 0.42, `${colors[i]}88`, 'rgba(0,0,0,0)');
      }
      break;
    }
    default:
      ctx.fillStyle = '#1a1a22';
      ctx.fillRect(0, 0, w, h);
  }
}
