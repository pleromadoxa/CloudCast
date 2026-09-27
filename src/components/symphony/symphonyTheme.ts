/**
 * Symphony console theme tokens shared across components.
 * (Non-component exports live here so fast-refresh stays happy.)
 */
import { cn } from '../../lib/utils';
import type { TrackColor } from '../../types/symphony';

export const TRACK_COLOR_MAP: Record<TrackColor, {
  bg: string;
  border: string;
  region: string;
  meter: string;
  stripe: string;
  regionClass: string;
  glow: string;
}> = {
  green: {
    bg: 'bg-emerald-500/15', border: 'border-emerald-400/50', region: 'bg-emerald-600/70',
    meter: 'bg-emerald-400', stripe: 'sym-stripe--green', regionClass: 'sym-region--green', glow: 'shadow-emerald-500/30',
  },
  blue: {
    bg: 'bg-sky-500/15', border: 'border-sky-400/50', region: 'bg-sky-600/70',
    meter: 'bg-sky-400', stripe: 'sym-stripe--blue', regionClass: 'sym-region--blue', glow: 'shadow-sky-500/30',
  },
  purple: {
    bg: 'bg-violet-500/15', border: 'border-violet-400/50', region: 'bg-violet-600/70',
    meter: 'bg-violet-400', stripe: 'sym-stripe--purple', regionClass: 'sym-region--purple', glow: 'shadow-violet-500/30',
  },
  yellow: {
    bg: 'bg-amber-500/15', border: 'border-amber-400/50', region: 'bg-amber-500/70',
    meter: 'bg-amber-400', stripe: 'sym-stripe--yellow', regionClass: 'sym-region--yellow', glow: 'shadow-amber-500/30',
  },
  orange: {
    bg: 'bg-orange-500/15', border: 'border-orange-400/50', region: 'bg-orange-600/70',
    meter: 'bg-orange-400', stripe: 'sym-stripe--orange', regionClass: 'sym-region--orange', glow: 'shadow-orange-500/30',
  },
  red: {
    bg: 'bg-rose-500/15', border: 'border-rose-400/50', region: 'bg-rose-600/70',
    meter: 'bg-rose-400', stripe: 'sym-stripe--red', regionClass: 'sym-region--red', glow: 'shadow-rose-500/30',
  },
  cyan: {
    bg: 'bg-cyan-500/15', border: 'border-cyan-400/50', region: 'bg-cyan-600/70',
    meter: 'bg-cyan-400', stripe: 'sym-stripe--cyan', regionClass: 'sym-region--cyan', glow: 'shadow-cyan-500/30',
  },
};

/** The full palette order used by the strip color picker. */
export const TRACK_COLORS: TrackColor[] = [
  'green', 'blue', 'purple', 'yellow', 'orange', 'red', 'cyan',
];

/** Draggable list rows (div, not button). */
export function symListItemClass(active = false, className?: string) {
  return cn('sym-list-item', active && 'sym-list-item--active', className);
}

/** Piano key classes. */
export function symPianoKeyClass(black = false) {
  return cn('sym-piano-key', black ? 'sym-piano-key--black' : 'sym-piano-key--white');
}
