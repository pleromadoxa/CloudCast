import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

export type SymBtnVariant =
  | 'default'
  | 'icon'
  | 'transport'
  | 'toggle'
  | 'tool'
  | 'ms'
  | 'pad'
  | 'list'
  | 'round'
  | 'ghost';

export type SymBtnAccent = 'violet' | 'red' | 'green' | 'amber' | 'sky' | 'yellow' | 'neutral';

const VARIANT_CLASS: Record<SymBtnVariant, string> = {
  default: 'sym-btn sym-btn--default',
  icon: 'sym-btn sym-btn--icon',
  transport: 'sym-btn sym-btn--transport',
  toggle: 'sym-btn sym-btn--toggle',
  tool: 'sym-btn sym-btn--tool',
  ms: 'sym-btn sym-btn--ms',
  pad: 'sym-btn sym-btn--pad',
  list: 'sym-btn sym-btn--list',
  round: 'sym-btn sym-btn--round',
  ghost: 'sym-btn sym-btn--ghost',
};

const ACCENT_CLASS: Record<SymBtnAccent, string> = {
  violet: 'sym-btn--accent-violet',
  red: 'sym-btn--accent-red',
  green: 'sym-btn--accent-green',
  amber: 'sym-btn--accent-amber',
  sky: 'sym-btn--accent-sky',
  yellow: 'sym-btn--accent-yellow',
  neutral: 'sym-btn--accent-neutral',
};

export interface SymphonyButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: SymBtnVariant;
  active?: boolean;
  accent?: SymBtnAccent;
  children: ReactNode;
}

export const SymphonyButton = forwardRef<HTMLButtonElement, SymphonyButtonProps>(
  ({ variant = 'default', active = false, accent = 'violet', className, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        VARIANT_CLASS[variant],
        active && 'sym-btn--active',
        active && ACCENT_CLASS[accent],
        className,
      )}
      {...props}
    >
      <span className="sym-btn__face">{children}</span>
    </button>
  ),
);
SymphonyButton.displayName = 'SymphonyButton';

/** div/role=button list row with same press feel (no inner face) */
export function symListItemClass(active = false, className?: string) {
  return cn('sym-list-item', active && 'sym-list-item--active', className);
}

/** Piano key classes */
export function symPianoKeyClass(black = false) {
  return cn('sym-piano-key', black ? 'sym-piano-key--black' : 'sym-piano-key--white');
}
