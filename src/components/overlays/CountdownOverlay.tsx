import { useEffect, useMemo, useState } from 'react';
import type { CountdownSettings } from '../../types/overlays';
import { placementStyle, resolveCornerPlacement } from '../../lib/overlayPlacement';
import { formatCountdownClock, formatTimeOfDay, resolveCountdownDisplay } from '../../lib/graphicsPack';
import { cn } from '../../lib/utils';

interface CountdownOverlayProps {
  settings: CountdownSettings;
}

const RING_RADIUS = 62;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function CountdownRing({
  progress,
  accentColor,
  done,
}: {
  progress: number;
  accentColor: string;
  done: boolean;
}) {
  const offset = RING_CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, progress)));
  return (
    <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 160 160" aria-hidden>
      <circle
        cx="80"
        cy="80"
        r={RING_RADIUS}
        fill="none"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth="7"
      />
      <circle
        cx="80"
        cy="80"
        r={RING_RADIUS}
        fill="none"
        stroke={done ? 'rgba(255,255,255,0.5)' : accentColor}
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={RING_CIRCUMFERENCE}
        strokeDashoffset={offset}
        style={{ filter: `drop-shadow(0 0 6px ${accentColor}88)` }}
      />
    </svg>
  );
}

export function CountdownOverlay({ settings }: CountdownOverlayProps) {
  const [elapsed, setElapsed] = useState(0);
  const [wallClock, setWallClock] = useState(() => new Date());

  const ticking = settings.mode !== 'time-of-day';
  useEffect(() => {
    if (!ticking) return;
    const timer = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [ticking]);

  useEffect(() => {
    if (settings.mode !== 'time-of-day') return;
    const timer = setInterval(() => setWallClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, [settings.mode]);

  const display = useMemo(
    () => resolveCountdownDisplay(settings, elapsed),
    [settings, elapsed],
  );

  const isTimeOfDay = settings.mode === 'time-of-day';
  const hidden = !isTimeOfDay && settings.mode === 'countdown' && display.done && settings.autoHideAtZero;
  if (hidden) return null;

  const digits = isTimeOfDay ? formatTimeOfDay(wallClock) : formatCountdownClock(display.seconds);
  const posStyle = placementStyle(resolveCornerPlacement(settings.position, settings));

  return (
    <div
      className="absolute z-[16] animate-cloudcast-gfx-rise"
      style={{ ...posStyle, opacity: settings.opacity / 100 }}
    >
      <div className="flex flex-col items-center gap-2">
        {settings.title.trim() && (
          <p
            className="rounded-full border border-white/15 bg-black/55 px-3 py-0.5 text-[9px] font-black uppercase tracking-[0.32em] text-white/90 backdrop-blur-sm"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}
          >
            {settings.title}
          </p>
        )}

        <div className="relative h-[152px] w-[152px]">
          {settings.showRing && (
            <CountdownRing progress={display.progress} accentColor={settings.accentColor} done={display.done} />
          )}
          <div
            className="absolute inset-[14px] flex flex-col items-center justify-center rounded-full border border-white/10"
            style={{
              background:
                'radial-gradient(circle at 50% 30%, rgba(30,41,59,0.92), rgba(2,6,23,0.96))',
              boxShadow: `0 18px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)`,
            }}
          >
            <span
              className={cn(
                'font-mono font-black leading-none tabular-nums text-white',
                digits.length > 8 ? 'text-[22px]' : 'text-[28px]',
              )}
              style={{ textShadow: `0 0 22px ${settings.accentColor}55, 0 2px 8px rgba(0,0,0,0.6)` }}
            >
              {digits}
            </span>
            <span
              className="mt-1 text-[7px] font-bold uppercase tracking-[0.3em]"
              style={{ color: settings.accentColor }}
            >
              {settings.mode === 'count-up'
                ? 'ELAPSED'
                : isTimeOfDay
                  ? 'LOCAL TIME'
                  : display.done
                    ? 'NOW'
                    : 'REMAINING'}
            </span>
          </div>
        </div>

        {settings.label.trim() && (
          <p
            className="max-w-[260px] truncate rounded-full bg-black/55 px-3 py-0.5 text-[9px] font-semibold tracking-wide text-white/85 backdrop-blur-sm"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}
          >
            {settings.label}
          </p>
        )}
      </div>
    </div>
  );
}
