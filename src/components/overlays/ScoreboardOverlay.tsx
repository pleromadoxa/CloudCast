import { useEffect, useState } from 'react';
import type { ScoreboardSettings, ScoreboardTeam } from '../../types/overlays';
import { placementStyle, resolveCornerPlacement } from '../../lib/overlayPlacement';
import { formatGameClock } from '../../lib/graphicsPack';
import { cn } from '../../lib/utils';

interface ScoreboardOverlayProps {
  settings: ScoreboardSettings;
}

function TeamMark({ team, accentColor, size = 18 }: { team: ScoreboardTeam; accentColor: string; size?: number }) {
  if (team.logoDataUrl) {
    return (
      <img
        src={team.logoDataUrl}
        alt=""
        className="shrink-0 object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-sm text-[8px] font-black text-slate-950"
      style={{ width: size, height: size, backgroundColor: accentColor }}
    >
      {(team.name || '?').slice(0, 2).toUpperCase()}
    </span>
  );
}

function TeamBlock({
  team,
  accentColor,
  possession,
  side,
  compact,
}: {
  team: ScoreboardTeam;
  accentColor: string;
  possession: 'home' | 'away' | 'none';
  side: 'home' | 'away';
  compact: boolean;
}) {
  const hasPossession = possession === side;
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {hasPossession && (
        <span
          className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full"
          style={{ backgroundColor: accentColor, boxShadow: `0 0 6px ${accentColor}` }}
          aria-label="Possession"
        />
      )}
      <TeamMark team={team} accentColor={accentColor} size={compact ? 15 : 19} />
      <span
        className={cn(
          'truncate font-black uppercase tracking-[0.08em] text-white',
          compact ? 'max-w-[72px] text-[9px]' : 'max-w-[110px] text-[11px]',
        )}
        style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}
      >
        {team.name || 'TEAM'}
      </span>
      <span
        className={cn(
          'font-mono font-black tabular-nums leading-none text-white',
          compact ? 'text-[13px]' : 'text-[17px]',
        )}
        style={{ textShadow: '0 2px 5px rgba(0,0,0,0.55)' }}
      >
        {team.score}
      </span>
    </div>
  );
}

function ClockCluster({ settings, compact }: { settings: ScoreboardSettings; compact: boolean }) {
  const [remaining, setRemaining] = useState(settings.clockSeconds);
  const [lastClock, setLastClock] = useState(settings.clockSeconds);

  // Operator edits to the clock reset the on-air countdown (state derived from props).
  if (settings.clockSeconds !== lastClock) {
    setLastClock(settings.clockSeconds);
    setRemaining(settings.clockSeconds);
  }

  useEffect(() => {
    if (!settings.clockRunning) return;
    const timer = setInterval(() => {
      setRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [settings.clockRunning]);

  return (
    <div
      className="flex items-center gap-1.5 rounded-sm px-2 py-0.5"
      style={{ background: `linear-gradient(180deg, ${settings.accentColor}, ${settings.accentColor}cc)` }}
    >
      <span className={cn('font-black uppercase tracking-[0.12em] text-slate-950', compact ? 'text-[8px]' : 'text-[9px]')}>
        {settings.periodLabel || ''}
      </span>
      <span
        className={cn(
          'font-mono font-black tabular-nums leading-none text-slate-950',
          compact ? 'text-[11px]' : 'text-[13px]',
        )}
      >
        {formatGameClock(remaining)}
      </span>
    </div>
  );
}

export function ScoreboardOverlay({ settings }: ScoreboardOverlayProps) {
  const fullwidth = settings.style === 'fullwidth';
  const compact = settings.style === 'bug' || settings.style === 'minimal';
  const posStyle = fullwidth
    ? { left: 0, right: 0 }
    : placementStyle(resolveCornerPlacement(settings.position, settings));

  const home = (
    <TeamBlock
      team={settings.home}
      accentColor={settings.accentColor}
      possession={settings.possession}
      side="home"
      compact={compact}
    />
  );
  const away = (
    <TeamBlock
      team={settings.away}
      accentColor={settings.accentColor}
      possession={settings.possession}
      side="away"
      compact={compact}
    />
  );
  const clock = <ClockCluster settings={settings} compact={compact} />;

  if (fullwidth) {
    return (
      <div
        className="absolute z-[16] animate-cloudcast-gfx-fade"
        style={{ ...posStyle, top: 0, opacity: settings.opacity / 100 }}
      >
        <div
          className="flex items-center justify-center gap-4 px-4 py-1.5 shadow-[0_8px_22px_rgba(0,0,0,0.45)]"
          style={{
            background: 'linear-gradient(90deg, rgba(2,6,23,0.92), rgba(15,23,42,0.88), rgba(2,6,23,0.92))',
            borderBottom: `2px solid ${settings.accentColor}`,
          }}
        >
          {home}
          {clock}
          {away}
        </div>
      </div>
    );
  }

  if (settings.style === 'bar') {
    return (
      <div
        className="absolute z-[16] animate-cloudcast-gfx-rise"
        style={{ ...posStyle, opacity: settings.opacity / 100 }}
      >
        <div
          className="flex items-center gap-4 rounded-md px-3 py-1.5 shadow-[0_10px_26px_rgba(0,0,0,0.5)]"
          style={{
            background: 'linear-gradient(180deg, rgba(15,23,42,0.95), rgba(2,6,23,0.95))',
            borderTop: `2px solid ${settings.accentColor}`,
          }}
        >
          {home}
          <span className="h-5 w-px bg-white/15" />
          {clock}
          <span className="h-5 w-px bg-white/15" />
          {away}
        </div>
      </div>
    );
  }

  if (settings.style === 'minimal') {
    return (
      <div
        className="absolute z-[16] animate-cloudcast-gfx-rise"
        style={{ ...posStyle, opacity: settings.opacity / 100 }}
      >
        <div className="flex flex-col gap-1 rounded-none border-l-2 bg-black/55 px-3 py-2 backdrop-blur-sm" style={{ borderLeftColor: settings.accentColor }}>
          <div className="flex items-center gap-3">
            {home}
            <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/45">vs</span>
            {away}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-black uppercase tracking-[0.22em]" style={{ color: settings.accentColor }}>
              {settings.periodLabel}
            </span>
            <span className="font-mono text-[11px] font-bold tabular-nums text-white/90">
              {formatGameClock(settings.clockSeconds)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 'bug' — compact stacked sports score bug
  return (
    <div
      className="absolute z-[16] animate-cloudcast-gfx-rise"
      style={{ ...posStyle, opacity: settings.opacity / 100 }}
    >
      <div className="flex flex-col overflow-hidden rounded-md border border-white/10 shadow-[0_12px_30px_rgba(0,0,0,0.55)]">
        <div className="flex items-center gap-2 bg-slate-950/95 px-2.5 py-1">
          <span
            className="h-full w-0.5 self-stretch rounded-full"
            style={{ backgroundColor: settings.accentColor }}
          />
          {home}
        </div>
        <div className="flex items-center gap-2 bg-slate-900/95 px-2.5 py-1">
          <span
            className="h-full w-0.5 self-stretch rounded-full"
            style={{ backgroundColor: settings.accentColor, opacity: 0.5 }}
          />
          {away}
        </div>
        <div className="flex items-center justify-center bg-black/85 px-2.5 py-0.5">{clock}</div>
      </div>
    </div>
  );
}
