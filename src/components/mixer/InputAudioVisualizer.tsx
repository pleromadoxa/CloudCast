import { useEffect, useRef, useState } from 'react';
import { useMediaStreamAnalyser, type AnalyserFrame } from '../../hooks/useMediaStreamAnalyser';
import { useAnalyserNodeFrame } from '../../hooks/useAnalyserNodeFrame';
import { cn } from '../../lib/utils';
import { VUMeterBar } from './AudioMeters';

export type { AnalyserFrame };

export type VisualizerAccent = 'green' | 'red' | 'neutral';
export type VisualizerSize = 'xs' | 'sm' | 'md' | 'lg';
export type VisualizerLayout = 'stack' | 'strip';

interface InputAudioVisualizerProps {
  stream?: MediaStream | null;
  analyser?: AnalyserNode | null;
  enabled?: boolean;
  accent?: VisualizerAccent;
  compact?: boolean;
  layout?: VisualizerLayout;
  size?: VisualizerSize;
  className?: string;
}

const ACCENT = {
  green: {
    primary: '#00c864',
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

const SIZE = {
  xs: { canvas: 'h-8', meter: 'h-8', meterWidth: 'w-2' },
  sm: { canvas: 'h-16', meter: 'h-14', meterWidth: 'w-3' },
  md: { canvas: 'h-24', meter: 'h-20', meterWidth: 'w-3' },
  lg: { canvas: 'h-36', meter: 'h-28', meterWidth: 'w-3' },
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

function drawVisualizerFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  frame: AnalyserFrame,
  accent: VisualizerAccent,
  enabled: boolean,
  phase: number,
) {
  const colors = ACCENT[accent];
  const active = enabled && frame.active;
  const midY = h * 0.62;
  const spectrumH = h * 0.38;
  const waveH = h * 0.48;

  ctx.clearRect(0, 0, w, h);

  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0a0a0a');
  bg.addColorStop(1, '#050505');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  if (active) {
    ctx.fillStyle = colors.glow;
    ctx.globalAlpha = 0.08 + Math.sin(phase * 2) * 0.03;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  const gridAlpha = active ? 0.12 : 0.06;
  ctx.strokeStyle = `rgba(255,255,255,${gridAlpha})`;
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const y = (h / 4) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  const barCount = frame.spectrum.length;
  const gap = 1.5;
  const barW = (w - gap * (barCount - 1)) / barCount;

  for (let i = 0; i < barCount; i++) {
    const value = frame.spectrum[i] * (active ? 1 : 0.15);
    const barH = Math.max(2, value * spectrumH);
    const x = i * (barW + gap);
    const y = midY - barH;

    ctx.fillStyle = bandGradient(ctx, x, y, barH, colors, value);
    ctx.fillRect(x, y, barW, barH);

    if (active && value > 0.15) {
      ctx.fillStyle = colors.secondary;
      ctx.globalAlpha = 0.25 + value * 0.35;
      ctx.fillRect(x, y, barW, 2);
      ctx.globalAlpha = 1;
    }
  }

  ctx.strokeStyle = `rgba(255,255,255,${active ? 0.15 : 0.06})`;
  ctx.beginPath();
  ctx.moveTo(0, midY);
  ctx.lineTo(w, midY);
  ctx.stroke();

  const wavePoints: { x: number; y: number }[] = [];
  for (let i = 0; i < frame.waveform.length; i++) {
    const x = (i / (frame.waveform.length - 1)) * w;
    const amp = active ? (frame.waveform[i] - 0.5) * 2 : 0;
    const y = midY - amp * waveH * 0.45;
    wavePoints.push({ x, y });
  }

  ctx.save();
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = active ? 14 : 4;
  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = active ? 2.25 : 1.25;
  ctx.globalAlpha = active ? 0.95 : 0.3;
  ctx.beginPath();
  wavePoints.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.stroke();

  ctx.strokeStyle = colors.secondary;
  ctx.lineWidth = 1;
  ctx.globalAlpha = active ? 0.35 : 0.12;
  ctx.beginPath();
  wavePoints.forEach((p, i) => {
    const mirrorY = midY + (midY - p.y) * 0.35;
    if (i === 0) ctx.moveTo(p.x, mirrorY);
    else ctx.lineTo(p.x, mirrorY);
  });
  ctx.stroke();
  ctx.restore();

  if (active) {
    const pulseX = ((phase * 0.35) % 1) * w;
    const pulseGrad = ctx.createLinearGradient(pulseX - 40, 0, pulseX + 40, 0);
    pulseGrad.addColorStop(0, 'rgba(255,255,255,0)');
    pulseGrad.addColorStop(0.5, 'rgba(255,255,255,0.08)');
    pulseGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = pulseGrad;
    ctx.fillRect(0, 0, w, h);
  }
}

export function InputAudioVisualizer({
  stream = null,
  analyser = null,
  enabled = true,
  accent = 'green',
  compact = false,
  layout = 'stack',
  size,
  className,
}: InputAudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(0);
  const streamAnalyser = useMediaStreamAnalyser(stream, enabled && !analyser);
  const nodeAnalyser = useAnalyserNodeFrame(analyser, enabled && Boolean(analyser));
  const { levels, frameRef, subscribe } = analyser ? nodeAnalyser : streamAnalyser;
  const [signalActive, setSignalActive] = useState(false);

  const resolvedSize: VisualizerSize =
    size ?? (layout === 'strip' ? 'xs' : compact ? 'sm' : 'lg');
  const dims = SIZE[resolvedSize];
  const active = enabled && (signalActive || levels.l > 0.5 || levels.r > 0.5);

  const meterBars = (
    <>
      <VUMeterBar
        level={enabled ? levels.l : 0}
        peak={layout === 'stack' && enabled ? frameRef.current.lPeak : 0}
        label={layout === 'stack' ? 'L' : undefined}
        heightClass={dims.meter}
        animated
        narrow={layout === 'strip'}
      />
      <VUMeterBar
        level={enabled ? levels.r : 0}
        peak={layout === 'stack' && enabled ? frameRef.current.rPeak : 0}
        label={layout === 'stack' ? 'R' : undefined}
        heightClass={dims.meter}
        animated
        narrow={layout === 'strip'}
      />
    </>
  );

  useEffect(() => {
    return subscribe(() => {
      setSignalActive(frameRef.current.active);
    });
  }, [subscribe, frameRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;

    const draw = () => {
      if (!running) return;
      phaseRef.current += 0.016;

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w > 0 && h > 0) {
        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
          canvas.width = w * dpr;
          canvas.height = h * dpr;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        drawVisualizerFrame(ctx, w, h, frameRef.current, accent, enabled, phaseRef.current);
      }
    };

    const unsub = subscribe(draw);

    return () => {
      running = false;
      unsub();
    };
  }, [accent, enabled, frameRef, subscribe]);

  if (compact) {
    return (
      <div className={cn('flex items-end gap-1.5', className)}>
        {meterBars}
      </div>
    );
  }

  if (layout === 'strip') {
    return (
      <div className={cn('audio-input-strip-viz flex min-w-0 items-end gap-1', className)}>
        <div
          className={cn(
            'audio-viz-shell relative min-w-0 flex-1 overflow-hidden rounded border border-mixer-border/60 bg-black',
            active && 'audio-viz-shell--live',
            active && accent === 'green' && 'audio-viz-shell--green',
            active && accent === 'red' && 'audio-viz-shell--red',
            active && accent === 'neutral' && 'audio-viz-shell--neutral',
          )}
        >
          <canvas ref={canvasRef} className={cn('block w-full', dims.canvas)} aria-hidden />
          {!active && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45">
              <span className="text-[6px] font-bold uppercase tracking-wider text-mixer-muted">
                {enabled ? '—' : 'MUTED'}
              </span>
            </div>
          )}
        </div>
        {meterBars}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'audio-viz-shell flex min-w-0 flex-col gap-2',
        active && 'audio-viz-shell--live',
        active && accent === 'green' && 'audio-viz-shell--green',
        active && accent === 'red' && 'audio-viz-shell--red',
        active && accent === 'neutral' && 'audio-viz-shell--neutral',
        className,
      )}
    >
      <div className="relative overflow-hidden rounded-md border border-mixer-border/70 bg-black">
        <canvas ref={canvasRef} className={cn('block w-full', dims.canvas)} aria-hidden />
        {!active && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="text-[8px] font-bold uppercase tracking-widest text-mixer-muted">
              {enabled ? 'No signal' : 'Muted'}
            </span>
          </div>
        )}
        {active && (
          <div className="pointer-events-none absolute left-2 top-1.5 flex items-center gap-1">
            <span className="audio-viz-live-dot" />
            <span className="text-[7px] font-bold uppercase tracking-wider text-white/80">Live</span>
          </div>
        )}
      </div>

      <div className="flex min-w-0 items-end justify-center gap-2">{meterBars}</div>
    </div>
  );
}
