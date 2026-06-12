import { cn } from '../../lib/utils';
import type { ReactNode } from 'react';
import type { TrackColor } from '../../types/symphony';

export const TRACK_COLOR_MAP: Record<TrackColor, {
  bg: string;
  border: string;
  region: string;
  meter: string;
  stripe: string;
  regionClass: string;
  glow: string;
}> = {
  green: {
    bg: 'bg-emerald-500/15', border: 'border-emerald-400/50', region: 'bg-emerald-600/70',
    meter: 'bg-emerald-400', stripe: 'sym-stripe--green', regionClass: 'sym-region--green', glow: 'shadow-emerald-500/30',
  },
  blue: {
    bg: 'bg-sky-500/15', border: 'border-sky-400/50', region: 'bg-sky-600/70',
    meter: 'bg-sky-400', stripe: 'sym-stripe--blue', regionClass: 'sym-region--blue', glow: 'shadow-sky-500/30',
  },
  purple: {
    bg: 'bg-violet-500/15', border: 'border-violet-400/50', region: 'bg-violet-600/70',
    meter: 'bg-violet-400', stripe: 'sym-stripe--purple', regionClass: 'sym-region--purple', glow: 'shadow-violet-500/30',
  },
  yellow: {
    bg: 'bg-amber-500/15', border: 'border-amber-400/50', region: 'bg-amber-500/70',
    meter: 'bg-amber-400', stripe: 'sym-stripe--yellow', regionClass: 'sym-region--yellow', glow: 'shadow-amber-500/30',
  },
  orange: {
    bg: 'bg-orange-500/15', border: 'border-orange-400/50', region: 'bg-orange-600/70',
    meter: 'bg-orange-400', stripe: 'sym-stripe--orange', regionClass: 'sym-region--orange', glow: 'shadow-orange-500/30',
  },
  red: {
    bg: 'bg-rose-500/15', border: 'border-rose-400/50', region: 'bg-rose-600/70',
    meter: 'bg-rose-400', stripe: 'sym-stripe--red', regionClass: 'sym-region--red', glow: 'shadow-rose-500/30',
  },
  cyan: {
    bg: 'bg-cyan-500/15', border: 'border-cyan-400/50', region: 'bg-cyan-600/70',
    meter: 'bg-cyan-400', stripe: 'sym-stripe--cyan', regionClass: 'sym-region--cyan', glow: 'shadow-cyan-500/30',
  },
};

export function SegmentedVuMeter({ level, trackColor }: { level: number; trackColor: TrackColor }) {
  const segments = 12;
  const lit = Math.round((Math.min(100, level) / 100) * segments);
  return (
    <div className="sym-vu-meter" aria-hidden>
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'sym-vu-meter__seg',
            i < lit && 'sym-vu-meter__seg--lit',
            i < lit && `sym-vu-meter__seg--${trackColor}`,
            i >= segments - 2 && i < lit && 'sym-vu-meter__seg--hot',
          )}
        />
      ))}
    </div>
  );
}

export function WaveformMini({ className, active }: { className?: string; active?: boolean }) {
  const bars = [3, 7, 5, 9, 4, 8, 6, 10, 5, 7, 4, 8, 6, 9, 3, 7, 5, 8, 4, 6];
  return (
    <div className={cn('sym-waveform-mini flex h-10 items-end gap-px rounded-md bg-black/30 p-1.5', className)}>
      {bars.map((h, i) => (
        <div
          key={i}
          className={cn('sym-waveform-mini__bar w-0.5 rounded-sm', active && 'sym-waveform-mini__bar--active')}
          style={{
            height: `${h * 10}%`,
            animationDelay: active ? `${i * 40}ms` : undefined,
          }}
        />
      ))}
    </div>
  );
}

export function MidiDots({ color }: { color: TrackColor }) {
  const c = TRACK_COLOR_MAP[color];
  return (
    <div className="sym-midi-dots flex h-full flex-wrap content-start gap-0.5 p-1.5 opacity-90">
      {Array.from({ length: 28 }).map((_, i) => (
        <div
          key={i}
          className={cn('h-1 rounded-sm', c.meter)}
          style={{ width: `${6 + (i % 6) * 3}px`, marginTop: `${(i % 5) * 2}px`, opacity: 0.5 + (i % 3) * 0.15 }}
        />
      ))}
    </div>
  );
}

export function AudioWaveform({ color }: { color: TrackColor }) {
  const c = TRACK_COLOR_MAP[color];
  const points = Array.from({ length: 48 }, (_, i) => Math.sin(i * 0.35) * 0.45 + Math.cos(i * 0.12) * 0.2 + 0.15);
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${i * 2.08} ${10 - p * 7}`).join(' ');
  const fillD = `${pathD} L${(points.length - 1) * 2.08} 20 L0 20 Z`;
  return (
    <svg className="sym-audio-wave h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 20">
      <defs>
        <linearGradient id={`wave-fill-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path d={fillD} fill={`url(#wave-fill-${color})`} className={c.meter.replace('bg-', 'text-')} />
      <path d={pathD} fill="none" stroke="currentColor" strokeWidth="0.6" className={c.meter.replace('bg-', 'text-')} opacity={0.9} />
    </svg>
  );
}

export function LcdSegment({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="sym-lcd-segment">
      {label && <span className="sym-lcd-segment__label">{label}</span>}
      <span className="sym-lcd-segment__value">{children}</span>
    </div>
  );
}
