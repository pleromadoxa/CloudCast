import { RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAppFreshness } from '../../hooks/useAppFreshness';

export function AppFreshnessBanner({ className }: { className?: string }) {
  const { updateAvailable, reloadForUpdate } = useAppFreshness();
  if (!updateAvailable) return null;

  return (
    <div className={cn('flex items-center gap-2', className)} role="status" aria-live="polite">
      <RefreshCw className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1">
        A newer CloudCast build is available. Chrome may be using a cached version — refresh for the latest fixes.
      </span>
      <button type="button" onClick={reloadForUpdate} className="mixer-btn shrink-0 px-2 py-0.5 text-[10px]">
        REFRESH
      </button>
    </div>
  );
}
