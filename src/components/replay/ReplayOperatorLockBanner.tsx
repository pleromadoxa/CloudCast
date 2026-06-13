import { Lock, Unlock } from 'lucide-react';
import type { ReplayOperatorLock } from '../../lib/replayOperatorLocks';
import { cn } from '../../lib/utils';

interface ReplayOperatorLockBannerProps {
  active: boolean;
  readOnly: boolean;
  blockingHolder: ReplayOperatorLock | null;
  operatorLabel: string | null;
  className?: string;
}

export function ReplayOperatorLockBanner({
  active,
  readOnly,
  blockingHolder,
  operatorLabel,
  className,
}: ReplayOperatorLockBannerProps) {
  if (!active) return null;

  if (readOnly) {
    return (
      <div className={cn('flex items-center gap-2 border-b border-amber-500/30 bg-amber-950/40 px-3 py-1.5 text-[10px] text-amber-100', className)}>
        <Lock className="h-3 w-3" />
        <span>
          Read-only — {blockingHolder?.operatorLabel ?? 'Another operator'} holds the replay console lock.
          Wait for them to close Replay or release the lock.
        </span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2 border-b border-emerald-500/20 bg-emerald-950/30 px-3 py-1.5 text-[10px] text-emerald-200/90', className)}>
      <Unlock className="h-3 w-3" />
      <span>
        Replay console lock held by <strong>{operatorLabel ?? 'this operator'}</strong>
      </span>
    </div>
  );
}
