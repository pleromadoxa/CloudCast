import type { AnalyserFrame } from '../hooks/useMediaStreamAnalyser';

type VisualizerAccent = 'green' | 'red' | 'neutral';

const ACCENT = {
  green: {
    primary: '#22d3ee',
    secondary: '#34d399',
    glow: 'rgba(0, 200, 100, 0.45)',
    bar: ['#064e3b', '#059669', '#34d399', '#6ee7b7'],
  },
  red: {
    primary: '#e11d48',
    secondary: '#fb7185',
    glow: 'rgba(225, 29, 72, 0.5)',
    bar: ['#450a0a', '#991b1b', '#e11d48', '#fb7185'],
  },
  neutral: {
    primary: '#94a3b8',
    secondary: '#cbd5e1',
    glow: 'rgba(148, 163, 184, 0.35)',
    bar: ['#1e293b', '#475569', '#94a3b8', '#e2e8f0'],
  },
} as const;

function bandGradient(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  accent: (typeof ACCENT)[VisualizerAccent],
  intensity: number,
) {
  const g = ctx.createLinearGradient(x, y + h, x, y);
  const alpha = Math.round((0.35 + intensity * 0.65) * 255)
    .toString(16)
    .padStart(2, '0');
  g.addColorStop(0, accent.bar[0] + alpha);
  g.addColorStop(0.45, accent.bar[1]);
  g.addColorStop(0.75, accent.bar[2]);
  g.addColorStop(1, accent.bar[3]);
  return g;
}

export function drawVisualizerFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  frame: AnalyserFrame,
  accent: VisualizerAccent,
  enabled: boolean,
  phase: number,
  masterEnergy = 1,
) {
  const colors = ACCENT[accent];
  const active = enabled && frame.active;
  const midY = h * 0.55;
  const spectrumH = h * 0.38;
  const waveH = h * 0.42;

  ctx.clearRect(0, 0, w, h);

  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0c1628');
  bg.addColorStop(0.55, '#071018');
  bg.addColorStop(1, '#030508');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
  for (let y = 0; y < h; y += 14) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  if (active) {
    ctx.fillStyle = colors.glow;
    ctx.globalAlpha = 0.06 + Math.sin(phase * 2) * 0.02;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  const barCount = frame.spectrum.length;
  const gap = 1.5;
  const barW = (w - 16 - gap * (barCount - 1)) / barCount;

  for (let i = 0; i < barCount; i++) {
    const value = frame.spectrum[i] * (active ? masterEnergy : 0.12);
    const barH = Math.max(2, value * spectrumH);
    const x = 8 + i * (barW + gap);
    const y = midY - barH;

    ctx.fillStyle = bandGradient(ctx, x, y, barH, colors, value);
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = active ? 6 : 0;
    ctx.fillRect(x, y, barW, barH);
  }
  ctx.shadowBlur = 0;

  const wavePoints: { x: number; y: number }[] = [];
  for (let i = 0; i < frame.waveform.length; i++) {
    const x = 8 + (i / (frame.waveform.length - 1)) * (w - 16);
    const amp = active ? (frame.waveform[i] - 0.5) * 2 : 0;
    const y = h * 0.28 + amp * waveH * 0.4;
    wavePoints.push({ x, y });
  }

  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = active ? 1.75 : 1;
  ctx.globalAlpha = active ? 0.85 : 0.25;
  ctx.beginPath();
  wavePoints.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.stroke();
  ctx.globalAlpha = 1;
}
