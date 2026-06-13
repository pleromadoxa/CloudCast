import { cn } from '../../lib/utils';
import { usePgmAudioLevels } from '../../context/PgmAudioContext';
import type { AudioAnalyserLevels } from '../../hooks/useMediaStreamAnalyser';

interface AudioMetersProps {
  active?: boolean;
  muted?: boolean;
  levels?: AudioAnalyserLevels;
  size?: 'sm' | 'md' | 'lg';
  peakHold?: boolean;
}

export function VUMeterBar({
  level,
  peak = 0,
  peakHold = false,
  label,
  heightClass = 'h-28',
  animated = false,
  narrow = false,
  pro = false,
}: {
  level: number;
  peak?: number;
  peakHold?: boolean;
  label?: string;
  heightClass?: string;
  animated?: boolean;
  narrow?: boolean;
  pro?: boolean;
}) {
  const segments = pro ? 24 : 20;
  const activeCount = Math.round((level / 100) * segments);
  const peakSeg = Math.round((peak / 100) * segments);
  const showPeak = peakHold ? peakSeg > 0 : peakSeg > activeCount;

  return (
    <div className={cn('vu-meter-bar', pro && 'vu-meter-bar--pro')}>
      {label && (
        <span className={cn('vu-meter-bar__label', pro && 'vu-meter-bar__label--pro')}>{label}</span>
      )}
      <div
        className={cn(
          'vu-meter-bar__housing relative flex flex-col-reverse gap-px rounded-sm border bg-black p-0.5',
          pro ? 'vu-meter-bar__housing--pro border-slate-700/80' : 'border-mixer-border',
          narrow ? 'w-2' : pro ? 'w-3.5' : 'w-3',
          heightClass,
        )}
      >
        {pro && (
          <div className="vu-meter-bar__scale" aria-hidden>
            <span>0</span>
            <span>-6</span>
            <span>-12</span>
          </div>
        )}
        {Array.from({ length: segments }, (_, i) => {
          const seg = i + 1;
          const on = seg <= activeCount;
          const isPeakMarker = showPeak && peakSeg > 0 && seg === peakSeg;
          const dangerZone = pro ? seg > segments * 0.85 : seg > 16;
          const warnZone = pro ? seg > segments * 0.65 : seg > 12;
          let color = 'vu-off';
          if (on) {
            if (dangerZone) color = 'vu-red';
            else if (warnZone) color = 'vu-yellow';
            else color = 'vu-green';
          }
          return (
            <div
              key={i}
              className={cn(
                'vu-segment min-h-[2px] flex-1',
                color,
                pro && 'vu-segment--pro',
                animated && on && 'vu-segment--pulse',
                isPeakMarker && 'vu-segment--peak',
                peakHold && isPeakMarker && 'vu-segment--peak-hold',
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

function VUMeterPair({
  l,
  r,
  lPeak = 0,
  rPeak = 0,
  peakHold = false,
  size = 'md',
}: {
  l: number;
  r: number;
  lPeak?: number;
  rPeak?: number;
  peakHold?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const heightClass = size === 'lg' ? 'h-28' : size === 'sm' ? 'h-12' : 'h-20';
  return (
    <div className="flex gap-2 px-1">
      <VUMeterBar
        level={l}
        peak={lPeak}
        peakHold={peakHold}
        label="L"
        heightClass={heightClass}
        animated
      />
      <VUMeterBar
        level={r}
        peak={rPeak}
        peakHold={peakHold}
        label="R"
        heightClass={heightClass}
        animated
      />
    </div>
  );
}

export function AudioMeters({
  active = true,
  muted = false,
  levels: externalLevels,
  size = 'md',
  peakHold = false,
}: AudioMetersProps) {
  const pgmLevels = usePgmAudioLevels();
  const levels = externalLevels ?? pgmLevels;
  const l = active ? levels.l : 0;
  const r = active ? levels.r : 0;

  return (
    <div className={cn('transition-opacity', muted && 'opacity-45')}>
      <VUMeterPair l={l} r={r} peakHold={peakHold} size={size} />
    </div>
  );
}
