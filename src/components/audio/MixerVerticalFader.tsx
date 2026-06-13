import { unlockDashboardAudio } from '../../lib/audioOutput';
import { cn } from '../../lib/utils';

export function MixerVerticalFader({
  label,
  value,
  onChange,
  disabled = false,
  accent = 'blue',
  height = 120,
  showDb = true,
  className,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  accent?: 'blue' | 'green' | 'red' | 'amber';
  height?: number;
  showDb?: boolean;
  className?: string;
}) {
  const db = volumeToDb(value);

  return (
    <div className={cn('mixer-vfader', disabled && 'mixer-vfader--disabled', className)}>
      <span className="mixer-vfader__label">{label}</span>
      <div className="mixer-vfader__scale" aria-hidden>
        <span>0</span>
        <span>-12</span>
        <span>-∞</span>
      </div>
      <div className="mixer-vfader__wrap" style={{ height }}>
        <div className={cn('mixer-vfader__track', `mixer-vfader__track--${accent}`)} aria-hidden>
          <div className="mixer-vfader__fill" style={{ height: `${value}%` }} />
          <div className="mixer-vfader__cap" style={{ bottom: `calc(${value}% - 5px)` }} />
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          disabled={disabled}
          aria-label={`${label} fader`}
          onPointerDown={() => {
            void unlockDashboardAudio();
          }}
          onChange={(e) => onChange(Number(e.target.value))}
          className="studiolive-fader-input studiolive-fader-input--vertical mixer-vfader__input"
        />
      </div>
      <span className="mixer-vfader__value">{showDb ? db : value}</span>
    </div>
  );
}

/** Approximate dB readout for 0–100 fader (unity ≈ 75). */
export function volumeToDb(vol: number): string {
  if (vol <= 0) return '-∞';
  const normalized = vol / 100;
  if (normalized >= 0.99) return '+0';
  const db = 20 * Math.log10(normalized);
  return db > -0.5 ? '0' : db.toFixed(0);
}
