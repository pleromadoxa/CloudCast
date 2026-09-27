import type { ReactNode } from 'react';
import { cn } from '../../../lib/utils';

export interface LcdPanelProps {
  children: ReactNode;
  amber?: boolean;
  className?: string;
}

/** Backlit LCD panel surface (engraved bezel + scanline glass). */
export function LcdPanel({ children, amber = false, className }: LcdPanelProps) {
  return (
    <div className={cn('sym-lcd-pro', amber && 'sym-lcd-pro--amber', className)}>
      {children}
    </div>
  );
}

export interface LcdReadoutProps {
  label?: string;
  value: ReactNode;
  small?: boolean;
  amber?: boolean;
  className?: string;
}

/** Single LCD value with engraved caption. */
export function LcdReadout({ label, value, small = false, amber = false, className }: LcdReadoutProps) {
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      {label && <span className="sym-lcd-pro__label">{label}</span>}
      <span className={cn('sym-lcd-pro__value', small && 'sym-lcd-pro__value--sm')}>
        {value}
      </span>
      {amber && <span className="sr-only">amber display</span>}
    </div>
  );
}

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

/** Rocker toggle with metallic knob, used across settings panels. */
export function ToggleSwitch({ checked, onChange, label, disabled = false }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn('sym-settings__toggle', checked && 'sym-settings__toggle--on', disabled && 'opacity-40')}
    />
  );
}
