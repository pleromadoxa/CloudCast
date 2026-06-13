import { useEffect, useRef } from 'react';
import { usePrismFeedOptional } from '../../context/PrismFeedContext';
import { cn } from '../../lib/utils';

interface PrismFeedPlayerProps {
  compact?: boolean;
  showLabel?: boolean;
  className?: string;
  onVideoRef?: (el: HTMLVideoElement | null) => void;
}

/** Video Mixer source player for the Regal Prism virtual input. */
export function PrismFeedPlayer({
  compact = false,
  showLabel = true,
  className,
  onVideoRef,
}: PrismFeedPlayerProps) {
  const prism = usePrismFeedOptional();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (prism?.programStream) {
      video.srcObject = prism.programStream;
      void video.play().catch(() => {});
    } else {
      video.srcObject = null;
    }
  }, [prism?.programStream]);

  useEffect(() => {
    onVideoRef?.(videoRef.current);
    return () => onVideoRef?.(null);
  }, [onVideoRef, prism?.programStream]);

  const active = Boolean(prism?.isLive && prism.programStream);

  return (
    <div className={cn('relative h-full w-full overflow-hidden bg-black', className)}>
      {active ? (
        <video ref={videoRef} className="h-full w-full object-contain" playsInline muted />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-amber-950/40 to-black p-4 text-center">
          <p className="text-xs font-bold tracking-[0.2em] text-amber-400/80">REGAL PRISM</p>
          <p className="max-w-[200px] text-[10px] text-mixer-muted">
            Open Regal Prism, enable camera, and press Go Live to route composite here.
          </p>
        </div>
      )}
      {showLabel && !compact && (
        <div className="absolute left-2 top-2 z-30 rounded bg-black/70 px-2 py-0.5 text-[9px] font-bold tracking-wider text-amber-300">
          {active ? 'Regal Prism · LIVE' : 'Regal Prism · STANDBY'}
        </div>
      )}
      {active && (
        <div className="absolute right-2 top-2 z-30 rounded bg-amber-600/90 px-2 py-0.5 text-[9px] font-bold tracking-wider text-black">
          LIVE
        </div>
      )}
    </div>
  );
}
