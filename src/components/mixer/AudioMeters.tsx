import { cn } from '../../lib/utils';
import { usePgmAudioLevels } from '../../context/PgmAudioContext';
import type { AudioAnalyserLevels } from '../../hooks/useMediaStreamAnalyser';

interface AudioMetersProps {
  active?: boolean;
  muted?: boolean;
  levels?: AudioAnalyserLevels;
  size?: 'sm' | 'md' | 'lg';
}

export function VUMeterBar({
  level,
  peak = 0,
  label,
  heightClass = 'h-28',
  animated = false,
  narrow = false,
}: {
  level: number;
  peak?: number;
  label?: string;
  heightClass?: string;
  animated?: boolean;
  narrow?: boolean;
}) {
  const segments = 20;
  const activeCount = Math.round((level / 100) * segments);
  const peakSeg = Math.round((peak / 100) * segments);

  return (
    <div className="flex flex-col items-center gap-0.5">
      {label && <span className="text-[7px] font-bold text-mixer-muted">{label}</span>}
      <div
        className={cn(
          'relative flex flex-col-reverse gap-px rounded-sm border border-mixer-border bg-black p-0.5',
          narrow ? 'w-2' : 'w-3',
          heightClass,
        )}
      >
        {Array.from({ length: segments }, (_, i) => {
          const seg = i + 1;
          const on = seg <= activeCount;
          const isPeak = peakSeg > 0 && seg === peakSeg && seg > activeCount;
          let color = 'vu-off';
          if (on) {
            if (seg > 16) color = 'vu-red';
            else if (seg > 12) color = 'vu-yellow';
            else color = 'vu-green';
          }
          return (
            <div
              key={i}
              className={cn(
                'vu-segment min-h-[2px] flex-1',
                color,
                animated && on && 'vu-segment--pulse',
                isPeak && 'vu-segment--peak',
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
  size = 'md',
}: {
  l: number;
  r: number;
  size?: 'sm' | 'md' | 'lg';
}) {
  const heightClass = size === 'lg' ? 'h-28' : size === 'sm' ? 'h-12' : 'h-20';
  return (
    <div className="flex gap-2 px-1">
      <VUMeterBar level={l} label="L" heightClass={heightClass} animated />
      <VUMeterBar level={r} label="R" heightClass={heightClass} animated />
    </div>
  );
}

export function AudioMeters({
  active = true,
  muted = false,
  levels: externalLevels,
  size = 'md',
}: AudioMetersProps) {
  const pgmLevels = usePgmAudioLevels();
  const levels = externalLevels ?? pgmLevels;
  const l = active ? levels.l : 0;
  const r = active ? levels.r : 0;

  return (
    <div className={cn('transition-opacity', muted && 'opacity-45')}>
      <VUMeterPair l={l} r={r} size={size} />
    </div>
  );
}
