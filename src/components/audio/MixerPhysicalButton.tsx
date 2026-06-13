import { cn } from '../../lib/utils';

type PhysicalButtonVariant = 'neutral' | 'solo' | 'mute' | 'nc' | 'gate' | 'learn' | 'hpf' | 'pgm' | 'peak' | 'power';

export function MixerPhysicalButton({
  label,
  active = false,
  disabled = false,
  variant = 'neutral',
  momentary = false,
  className,
  title,
  onClick,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  variant?: PhysicalButtonVariant;
  momentary?: boolean;
  className?: string;
  title?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cn(
        'mixer-hw-btn',
        `mixer-hw-btn--${variant}`,
        active && 'mixer-hw-btn--active',
        momentary && active && 'mixer-hw-btn--momentary',
        disabled && 'mixer-hw-btn--disabled',
        className,
      )}
    >
      <span className="mixer-hw-btn__bezel" aria-hidden />
      <span className="mixer-hw-btn__cap">
        <span className="mixer-hw-btn__led" aria-hidden />
        <span className="mixer-hw-btn__label">{label}</span>
      </span>
    </button>
  );
}
