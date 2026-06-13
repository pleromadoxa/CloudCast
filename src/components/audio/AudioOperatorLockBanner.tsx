import { Lock, Unlock } from 'lucide-react';
import type { AudioOperatorLock } from '../../lib/audioOperatorLocks';
import { cn } from '../../lib/utils';

interface AudioOperatorLockBannerProps {
  active: boolean;
  readOnly: boolean;
  blockingHolder: AudioOperatorLock | null;
  operatorLabel: string | null;
  className?: string;
}

export function AudioOperatorLockBanner({
  active,
  readOnly,
  blockingHolder,
  operatorLabel,
  className,
}: AudioOperatorLockBannerProps) {
  if (!active) return null;

  if (readOnly) {
    return (
      <div className={cn('flex items-center gap-2 border-b border-amber-500/30 bg-amber-950/40 px-3 py-1.5 text-[10px] text-amber-100', className)}>
        <Lock className="h-3 w-3" />
        <span>
          Read-only — {blockingHolder?.operatorLabel ?? 'Another operator'} holds the audio console lock.
        </span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2 border-b border-sky-500/20 bg-sky-950/30 px-3 py-1.5 text-[10px] text-sky-200/90', className)}>
      <Unlock className="h-3 w-3" />
      <span>
        Audio console lock held by <strong>{operatorLabel ?? 'this operator'}</strong>
      </span>
    </div>
  );
}
