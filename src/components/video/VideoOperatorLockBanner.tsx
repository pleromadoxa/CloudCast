import { Lock } from 'lucide-react';
import type { VideoOperatorLock } from '../../lib/videoOperatorLocks';
import { cn } from '../../lib/utils';

interface VideoOperatorLockBannerProps {
  active: boolean;
  readOnly: boolean;
  blockingHolder: VideoOperatorLock | null;
  operatorLabel: string | null;
  className?: string;
}

/**
 * Shown only when another operator/tab holds the director lock.
 * When you hold the lock, no banner is shown — controls stay fully enabled.
 */
export function VideoOperatorLockBanner({
  active,
  readOnly,
  blockingHolder,
  className,
}: VideoOperatorLockBannerProps) {
  if (!active || !readOnly) return null;

  const holder = blockingHolder?.operatorLabel ?? 'Another operator';

  return (
    <div
      className={cn(
        'relative z-20 flex shrink-0 items-start gap-2 border-b border-amber-500/30 bg-amber-950/40 px-3 py-2 text-[10px] leading-relaxed text-amber-100',
        className,
      )}
    >
      <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold">Video mixer is read-only</p>
        <p className="mt-0.5 text-amber-100/90">
          The enterprise director lock is held by <strong>{holder}</strong> (often another CloudCast
          tab or TD). Close other tabs, wait about 45 seconds for the lock to expire, or ask them to
          release control. Only one operator can drive cuts, Go Live, and presets at a time.
        </p>
      </div>
    </div>
  );
}
