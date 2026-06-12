import { AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ConnectivityBannerProps {
  isOnline: boolean;
  isRecovering: boolean;
  offlineSince: number | null;
  className?: string;
}

function formatOfflineDuration(since: number): string {
  const sec = Math.floor((Date.now() - since) / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function ConnectivityBanner({
  isOnline,
  isRecovering,
  offlineSince,
  className,
}: ConnectivityBannerProps) {
  if (isOnline && !isRecovering) return null;

  const offline = !isOnline;

  return (
    <div
      className={cn(
        'shrink-0 flex items-center gap-2 border-b px-4 py-2 text-[11px]',
        offline
          ? 'border-mixer-yellow/50 bg-mixer-yellow/15 text-mixer-yellow'
          : 'border-mixer-green/40 bg-mixer-green/10 text-mixer-green',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {offline ? (
        <WifiOff className="h-4 w-4 shrink-0" />
      ) : (
        <Wifi className="h-4 w-4 shrink-0 animate-pulse" />
      )}
      <div className="min-w-0 flex-1">
        {offline ? (
          <>
            <p className="font-bold uppercase tracking-wide">No internet connection</p>
            <p className="text-[10px] opacity-90">
              The mixer stays open — your layout and ON AIR state are kept locally.
              {offlineSince != null && ` Offline for ${formatOfflineDuration(offlineSince)}.`}
              {' '}Streams will resume automatically when connectivity returns.
            </p>
          </>
        ) : (
          <>
            <p className="font-bold uppercase tracking-wide">Connection restored</p>
            <p className="text-[10px] opacity-90">
              Reconnecting cameras, signaling, and broadcast output…
            </p>
          </>
        )}
      </div>
      {offline && <AlertTriangle className="h-4 w-4 shrink-0 opacity-80" />}
    </div>
  );
}
