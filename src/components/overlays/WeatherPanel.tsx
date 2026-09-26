import { useEffect, useState } from 'react';
import type { WeatherIconId, WeatherSettings } from '../../types/overlays';
import { placementStyle, resolveCornerPlacement } from '../../lib/overlayPlacement';
import { formatTimeOfDay } from '../../lib/graphicsPack';
import { cn } from '../../lib/utils';

interface WeatherPanelProps {
  settings: WeatherSettings;
}

/** Crisp stroke glyph set — reads clearly at broadcast sizes over any video. */
export function WeatherGlyph({
  icon,
  className,
  strokeWidth = 2,
}: {
  icon: WeatherIconId;
  className?: string;
  strokeWidth?: number;
}) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
  };
  switch (icon) {
    case 'sun':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7" />
        </svg>
      );
    case 'cloud':
      return (
        <svg {...common}>
          <path d="M7 18.5h10.2a3.8 3.8 0 0 0 .5-7.56 5.6 5.6 0 0 0-10.86-1.2A4.4 4.4 0 0 0 7 18.5Z" />
        </svg>
      );
    case 'rain':
      return (
        <svg {...common}>
          <path d="M7 15.5h10.2a3.8 3.8 0 0 0 .5-7.56 5.6 5.6 0 0 0-10.86-1.2A4.4 4.4 0 0 0 7 15.5Z" />
          <path d="M8.5 18.5l-1 2.5M12.5 18.5l-1 2.5M16.5 18.5l-1 2.5" />
        </svg>
      );
    case 'snow':
      return (
        <svg {...common}>
          <path d="M7 15.5h10.2a3.8 3.8 0 0 0 .5-7.56 5.6 5.6 0 0 0-10.86-1.2A4.4 4.4 0 0 0 7 15.5Z" />
          <path d="M8.5 19.8h.01M12 21h.01M15.5 19.8h.01" />
        </svg>
      );
    case 'storm':
      return (
        <svg {...common}>
          <path d="M7 14.5h10.2a3.8 3.8 0 0 0 .5-7.56 5.6 5.6 0 0 0-10.86-1.2A4.4 4.4 0 0 0 7 14.5Z" />
          <path d="M12.8 16.2l-2.6 3.6h3l-1.4 3" />
        </svg>
      );
    case 'wind':
      return (
        <svg {...common}>
          <path d="M3 8.5h11a2.6 2.6 0 1 0-2.6-2.6" />
          <path d="M3 13h15.2a2.8 2.8 0 1 1-2.8 2.8" />
          <path d="M3 17.5h7" />
        </svg>
      );
    case 'fog':
      return (
        <svg {...common}>
          <path d="M7 13.5h10.2a3.8 3.8 0 0 0 .5-7.56 5.6 5.6 0 0 0-10.86-1.2A4.4 4.4 0 0 0 7 13.5Z" />
          <path d="M4.5 17h15M6.5 20h11" />
        </svg>
      );
    default:
      return null;
  }
}

const PANEL_SHELL: Record<WeatherSettings['style'], string> = {
  slate: 'rounded-md border border-white/10 bg-gradient-to-br from-slate-800/95 via-slate-900/95 to-slate-950/95 shadow-[0_10px_30px_rgba(0,0,0,0.45)]',
  glass: 'rounded-md border border-white/15 bg-slate-950/55 shadow-[0_10px_30px_rgba(0,0,0,0.4)] backdrop-blur-md',
  minimal: 'rounded-none border-l-4 bg-black/55 backdrop-blur-sm',
  'ticker-pill': 'rounded-full border border-white/15 bg-slate-950/70 shadow-[0_8px_22px_rgba(0,0,0,0.4)] backdrop-blur-md',
};

function LiveClock({ accentColor }: { accentColor: string }) {
  const [now, setNow] = useState(() => formatTimeOfDay(new Date()));
  useEffect(() => {
    const timer = setInterval(() => setNow(formatTimeOfDay(new Date())), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <span
      className="font-mono text-[10px] font-bold tabular-nums tracking-widest text-white/85"
      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
    >
      <span style={{ color: accentColor }}>●</span> {now}
    </span>
  );
}

export function WeatherPanel({ settings }: WeatherPanelProps) {
  const posStyle = placementStyle(resolveCornerPlacement(settings.position, settings));
  const unitLabel = `°${settings.unit}`;

  return (
    <div
      className="absolute z-[16] animate-cloudcast-gfx-rise"
      style={{ ...posStyle, opacity: settings.opacity / 100 }}
    >
      <div
        className={cn(
          'overflow-hidden text-white',
          PANEL_SHELL[settings.style],
          settings.style === 'minimal' && 'min-w-[190px]',
        )}
        style={
          settings.style === 'minimal'
            ? { borderLeftColor: settings.accentColor }
            : { borderTop: `2px solid ${settings.accentColor}` }
        }
      >
        {/* Header — location + optional live clock */}
        <div className="flex items-center justify-between gap-3 px-3 pt-2 pb-1">
          <div className="flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: settings.accentColor, boxShadow: `0 0 6px ${settings.accentColor}` }}
            />
            <span className="text-[9px] font-black uppercase tracking-[0.22em] text-white/90">
              {settings.location || 'WEATHER'}
            </span>
          </div>
          {settings.showClock && <LiveClock accentColor={settings.accentColor} />}
        </div>

        {/* Current conditions */}
        <div className="flex items-center gap-3 px-3 pb-1.5">
          <WeatherGlyph
            icon={settings.icon}
            className="h-9 w-9 shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]"
            strokeWidth={1.7}
          />
          <div className="flex items-baseline gap-1.5">
            <span
              className="text-[26px] font-black leading-none tabular-nums"
              style={{ textShadow: '0 2px 6px rgba(0,0,0,0.5)' }}
            >
              {Math.round(settings.temperature)}
            </span>
            <span className="text-[11px] font-bold text-white/70">{unitLabel}</span>
          </div>
          <div className="min-w-0 border-l border-white/15 pl-3">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-white/85">
              {settings.condition || '—'}
            </p>
            <p className="text-[8px] font-medium uppercase tracking-[0.18em] text-white/50">
              Current conditions
            </p>
          </div>
        </div>

        {/* Forecast strip */}
        {settings.forecast.length > 0 && (
          <div
            className={cn(
              'flex divide-x divide-white/10 border-t border-white/10',
              settings.style === 'ticker-pill' && 'rounded-b-full',
            )}
            style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))' }}
          >
            {settings.forecast.map((day) => (
              <div key={`${day.day}-${day.hi}-${day.lo}`} className="flex-1 px-2.5 py-1.5 text-center">
                <p className="text-[8px] font-black uppercase tracking-[0.16em] text-white/60">{day.day}</p>
                <WeatherGlyph icon={day.icon} className="mx-auto my-0.5 h-3.5 w-3.5 text-white/85" strokeWidth={1.8} />
                <p className="text-[9px] font-bold tabular-nums text-white/95">
                  {Math.round(day.hi)}°
                  <span className="ml-1 font-medium text-white/55">{Math.round(day.lo)}°</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
