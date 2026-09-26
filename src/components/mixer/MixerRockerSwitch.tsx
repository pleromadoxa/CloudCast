import { useId } from 'react';
import { cn } from '../../lib/utils';

export type MixerRockerSwitchSize = 'sm' | 'md';

export interface MixerRockerSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Accessible name — also used as title when title is omitted */
  label: string;
  title?: string;
  disabled?: boolean;
  size?: MixerRockerSwitchSize;
  className?: string;
  /** Glyphs on the rocker face (hardware I / O) */
  onGlyph?: string;
  offGlyph?: string;
}

/**
 * Hardware-style vertical rocker (I/O). Checked = powered ON (rocker up).
 * Visual language adapted from Uiverse.io / mrhyddenn.
 */
export function MixerRockerSwitch({
  checked,
  onCheckedChange,
  label,
  title,
  disabled = false,
  size = 'md',
  className,
  onGlyph = 'I',
  offGlyph = 'O',
}: MixerRockerSwitchProps) {
  const id = useId();

  return (
    <label
      className={cn(
        'mixer-rocker',
        `mixer-rocker--${size}`,
        checked && 'mixer-rocker--on',
        disabled && 'mixer-rocker--disabled',
        className,
      )}
      title={title ?? label}
    >
      <input
        id={id}
        type="checkbox"
        className="mixer-rocker__input"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onCheckedChange(e.target.checked)}
      />
      <span className="mixer-rocker__back" aria-hidden>
        <span className="mixer-rocker__but">
          <span className="mixer-rocker__on">{onGlyph}</span>
          <span className="mixer-rocker__off">{offGlyph}</span>
        </span>
      </span>
    </label>
  );
}
