import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import type { StreamNotice } from '../../hooks/useGoLive';
import { cn } from '../../lib/utils';

interface StreamStatusBannerProps {
  notice: StreamNotice | null;
  isValidating?: boolean;
  onDismiss: () => void;
}

export function StreamStatusBanner({ notice, isValidating, onDismiss }: StreamStatusBannerProps) {
  if (isValidating) {
    return (
      <div className="shrink-0 border-b border-mixer-border bg-mixer-panel px-4 py-2 text-[10px] text-mixer-muted">
        Validating RTMP destinations and connecting broadcast relay…
      </div>
    );
  }

  if (!notice) return null;

  const Icon =
    notice.type === 'success' ? CheckCircle2 : notice.type === 'error' ? AlertTriangle : Info;

  return (
    <div
      className={cn(
        'flex shrink-0 items-start gap-2 border-b px-4 py-2 text-[10px]',
        notice.type === 'success' && 'border-mixer-green/30 bg-mixer-green/10 text-mixer-green',
        notice.type === 'error' && 'border-mixer-red/30 bg-mixer-red/10 text-mixer-red',
        notice.type === 'info' && 'border-mixer-border bg-mixer-panel text-mixer-muted',
      )}
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p className="flex-1 leading-relaxed">{notice.message}</p>
      <button type="button" onClick={onDismiss} className="mixer-btn p-0.5" aria-label="Dismiss">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
