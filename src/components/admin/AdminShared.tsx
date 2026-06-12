import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

type CardTone = 'default' | 'success' | 'warning' | 'danger' | 'accent';

const TONE_STYLES: Record<CardTone, string> = {
  default: 'border-white/10 bg-black/40',
  success: 'border-mixer-green/25 bg-mixer-green/5',
  warning: 'border-mixer-yellow/25 bg-mixer-yellow/5',
  danger: 'border-mixer-red/25 bg-mixer-red/5',
  accent: 'border-mixer-red/35 bg-mixer-red/10',
};

const TONE_ICON: Record<CardTone, string> = {
  default: 'text-mixer-muted',
  success: 'text-mixer-green',
  warning: 'text-mixer-yellow',
  danger: 'text-mixer-red',
  accent: 'text-mixer-red',
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: CardTone;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border p-4', TONE_STYLES[tone], className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold tracking-wider text-mixer-muted">{label}</p>
        {Icon && <Icon className={cn('h-4 w-4 shrink-0 opacity-80', TONE_ICON[tone])} />}
      </div>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      {hint && <p className="mt-1 text-[10px] text-mixer-muted">{hint}</p>}
    </div>
  );
}

export function StatCardGrid({
  children,
  className,
  cols = 4,
}: {
  children: React.ReactNode;
  className?: string;
  cols?: 2 | 3 | 4;
}) {
  return (
    <div
      className={cn(
        'grid gap-3',
        cols === 2 && 'sm:grid-cols-2',
        cols === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
        cols === 4 && 'sm:grid-cols-2 lg:grid-cols-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function InsightCard({
  title,
  value,
  description,
  icon: Icon,
  tone = 'default',
}: {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  tone?: CardTone;
}) {
  return (
    <div className={cn('rounded-xl border p-4', TONE_STYLES[tone])}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className={cn('rounded-lg border border-white/10 bg-black/30 p-2', TONE_ICON[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-wider text-mixer-muted">{title}</p>
          <p className="text-xl font-bold text-white">{value}</p>
          {description && <p className="text-[10px] text-mixer-muted">{description}</p>}
        </div>
      </div>
    </div>
  );
}

export function AdminSection({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-xl border border-white/10 bg-[#0a0a0a] p-4', className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold">{title}</h2>
          {description && <p className="text-[10px] text-mixer-muted">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function AdminPagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 0;
  const canNext = page < totalPages - 1;

  return (
    <div className="mt-4 flex items-center justify-between text-[10px] text-mixer-muted">
      <span>
        Page {page + 1} of {totalPages} · {total} total
      </span>
      <div className="flex gap-1">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
          className="rounded border border-white/10 p-1 disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
          className="rounded border border-white/10 p-1 disabled:opacity-40"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const live = status === 'live';
  const error = status === 'error';
  return (
    <span
      className={cn(
        'rounded px-1.5 py-0.5 text-[9px] font-bold uppercase',
        live && 'bg-mixer-green/20 text-mixer-green',
        error && 'bg-mixer-red/20 text-mixer-red',
        !live && !error && 'bg-white/10 text-mixer-muted',
      )}
    >
      {status}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={cn(
        'rounded px-1.5 py-0.5 text-[9px] font-bold uppercase',
        severity === 'fatal' && 'bg-mixer-red/30 text-mixer-red',
        severity === 'warn' && 'bg-mixer-yellow/20 text-mixer-yellow',
        severity === 'error' && 'bg-white/10 text-mixer-muted',
      )}
    >
      {severity}
    </span>
  );
}
