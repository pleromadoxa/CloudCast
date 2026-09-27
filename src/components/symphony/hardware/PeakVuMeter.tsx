import { cn } from '../../../lib/utils';

export interface PeakVuMeterProps {
  /** Displayed level 0–100. */
  level: number;
  /** Peak-hold marker 0–100 (renders a white segment). */
  peak?: number;
  orientation?: 'vertical' | 'horizontal';
  segments?: number;
  className?: string;
  style?: React.CSSProperties;
  showLegend?: boolean;
  label?: string;
}

function segmentClass(index: number, segments: number): string {
  const ratio = index / segments;
  if (ratio >= 0.92) return 'sym-meter__seg--red';
  if (ratio >= 0.74) return 'sym-meter__seg--amber';
  return 'sym-meter__seg--green';
}

/** Segmented LED VU meter with peak-hold, modelled on console bridge meters. */
export function PeakVuMeter({
  level, peak = level, orientation = 'vertical', segments = 16,
  className, style, showLegend = false, label,
}: PeakVuMeterProps) {
  const lit = Math.round((Math.min(100, Math.max(0, level)) / 100) * segments);
  const peakIdx = Math.round((Math.min(100, Math.max(0, peak)) / 100) * segments) - 1;

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      {label && <span className="sym-knob__label">{label}</span>}
      <div
        className={cn('sym-meter', orientation === 'vertical' ? 'sym-meter--vertical' : 'sym-meter--horizontal')}
        style={style}
        aria-hidden
      >
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'sym-meter__seg',
              i < lit && segmentClass(i, segments),
              i === peakIdx && peakIdx >= lit && 'sym-meter__seg--peak',
            )}
          />
        ))}
      </div>
      {showLegend && (
        <div className={cn('sym-meter__legend', orientation === 'vertical' && 'sym-meter__legend--vertical')}>
          {orientation === 'vertical'
            ? ['−∞', '−24', '−12', '−6', '0'].map((s) => <span key={s}>{s}</span>)
            : ['−∞', '−12', '0'].map((s) => <span key={s}>{s}</span>)}
        </div>
      )}
    </div>
  );
}

export interface StereoVuMeterProps {
  left: number;
  right: number;
  leftPeak?: number;
  rightPeak?: number;
  orientation?: 'vertical' | 'horizontal';
  segments?: number;
  height?: number;
  className?: string;
}

/** Paired L/R meters for channel strips and the master bridge. */
export function StereoVuMeter({
  left, right, leftPeak = left, rightPeak = right,
  orientation = 'vertical', segments = 14, height = 120, className,
}: StereoVuMeterProps) {
  return (
    <div className={cn('flex items-stretch gap-1.5', className)}>
      <PeakVuMeter
        level={left}
        peak={leftPeak}
        orientation={orientation}
        segments={segments}
        style={orientation === 'vertical' ? { height, width: 7 } : { height: 8, width: height }}
      />
      <PeakVuMeter
        level={right}
        peak={rightPeak}
        orientation={orientation}
        segments={segments}
        style={orientation === 'vertical' ? { height, width: 7 } : { height: 8, width: height }}
      />
    </div>
  );
}
