import { AlertTriangle, HardDrive } from 'lucide-react';
import type { ReplayQuotaAlert } from '../../lib/replayQuotaAlerts';
import { cn } from '../../lib/utils';

interface ReplayQuotaBannerProps {
  alert: ReplayQuotaAlert;
  className?: string;
}

export function ReplayQuotaBanner({ alert, className }: ReplayQuotaBannerProps) {
  if (alert.level === 'ok' || !alert.message) return null;

  const isCritical = alert.level === 'full' || alert.level === 'critical';

  return (
    <div
      className={cn(
        'flex items-center gap-2 border-b px-3 py-1.5 text-[10px]',
        isCritical
          ? 'border-mixer-red/40 bg-mixer-red/10 text-mixer-red'
          : 'border-amber-500/30 bg-amber-950/40 text-amber-100',
        className,
      )}
    >
      {isCritical ? <AlertTriangle className="h-3 w-3 shrink-0" /> : <HardDrive className="h-3 w-3 shrink-0" />}
      <span>{alert.message}</span>
    </div>
  );
}
