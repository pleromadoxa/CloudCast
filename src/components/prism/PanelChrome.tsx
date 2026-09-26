import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

/** Consistent panel masthead: icon chip, title, one-line description. */
export function PanelHeader({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-2 border-b border-white/10 pb-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="mt-0.5 shrink-0 rounded border border-amber-500/30 bg-amber-500/10 p-1.5 text-amber-400">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-xs font-bold tracking-wider text-white">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[10px] leading-snug text-mixer-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/** Collapsible card used to chunk a panel into scannable sections. */
export function PanelSection({
  title,
  hint,
  children,
  action,
  collapsible = true,
  defaultOpen = true,
  accent = false,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  action?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** Amber emphasis for the section that owns the panel's primary control. */
  accent?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const showBody = !collapsible || open;

  return (
    <section
      className={cn(
        'rounded-lg border bg-black/40 transition-colors',
        accent ? 'border-amber-500/30' : 'border-white/10',
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between gap-2 px-3 py-2',
          showBody && 'border-b border-white/10',
        )}
      >
        <button
          type="button"
          onClick={() => collapsible && setOpen((v) => !v)}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-1.5 text-left',
            !collapsible && 'cursor-default',
          )}
          aria-expanded={showBody}
        >
          {collapsible ? (
            open ? (
              <ChevronDown className="h-3 w-3 shrink-0 text-amber-500" />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0 text-mixer-muted" />
            )
          ) : null}
          <span
            className={cn(
              'truncate text-[10px] font-bold uppercase tracking-wider',
              accent ? 'text-amber-300' : 'text-amber-400/90',
            )}
          >
            {title}
          </span>
        </button>
        {action}
      </div>
      {showBody && (
        <div className="space-y-3 p-3">
          {hint && <p className="text-[10px] leading-relaxed text-mixer-muted">{hint}</p>}
          {children}
        </div>
      )}
    </section>
  );
}

/** Labelled text input matching the studio's dark field styling. */
export function PanelField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold tracking-wider text-mixer-muted">{label}</span>
      {children}
    </label>
  );
}

export const panelInputClass =
  'mt-1 w-full rounded border border-white/10 bg-black px-2 py-1.5 text-xs text-white outline-none transition-colors placeholder:text-white/25 focus:border-amber-500/50';

/** iOS-style switch row with an optional right-aligned value readout. */
export function PanelToggle({
  label,
  description,
  checked,
  onChange,
  disabled,
  badge,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  badge?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded border px-2.5 py-2 text-left transition-colors',
        disabled
          ? 'cursor-not-allowed border-white/5 opacity-45'
          : checked
            ? 'border-amber-500/40 bg-amber-500/10 hover:border-amber-500/60'
            : 'border-white/10 bg-black/40 hover:border-white/25',
      )}
    >
      <span className="min-w-0">
        <span className="block text-[11px] font-bold text-white">{label}</span>
        {description && <span className="mt-0.5 block text-[9px] leading-snug text-mixer-muted">{description}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {badge}
        <span
          className={cn(
            'relative h-4 w-7 rounded-full transition-colors',
            checked ? 'bg-amber-500' : 'bg-white/15',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all',
              checked ? 'left-3.5' : 'left-0.5',
            )}
          />
        </span>
      </span>
    </button>
  );
}

/** Small muted callout used for plan/usage notes. */
export function PanelNote({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'amber' | 'green' }) {
  return (
    <p
      className={cn(
        'rounded border p-2 text-[10px] leading-relaxed',
        tone === 'amber' && 'border-amber-500/30 bg-amber-500/10 text-amber-200',
        tone === 'green' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
        tone === 'muted' && 'border-white/10 bg-black/40 text-mixer-muted',
      )}
    >
      {children}
    </p>
  );
}
