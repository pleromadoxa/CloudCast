import { useEffect, useRef } from 'react';
import type { ReplayPushRequest } from '../../types/replay';
import { cn } from '../../lib/utils';

interface ReplayPgmBusPlayerProps {
  replay: ReplayPushRequest;
  className?: string;
  onVideoRef?: (el: HTMLVideoElement | null) => void;
  onBusPlaybackStream?: (stream: MediaStream | null) => void;
  onEnded?: () => void;
}

/** Full-screen replay clip on the PGM program bus (captured by broadcast + monitor). */
export function ReplayPgmBusPlayer({
  replay,
  className,
  onVideoRef,
  onBusPlaybackStream,
  onEnded,
}: ReplayPgmBusPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    el.src = replay.url;
    el.playbackRate = replay.playbackRate ?? 1;
    void el.play().catch(() => undefined);

    onVideoRef?.(el);

    if (onBusPlaybackStream) {
      const stream =
        (el as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.() ??
        (el as HTMLVideoElement & { mozCaptureStream?: () => MediaStream }).mozCaptureStream?.() ??
        (el.srcObject instanceof MediaStream ? el.srcObject : null);
      onBusPlaybackStream(stream);
    }

    return () => {
      onBusPlaybackStream?.(null);
    };
  }, [replay.url, replay.playbackRate, onVideoRef, onBusPlaybackStream]);

  const bindRef = (el: HTMLVideoElement | null) => {
    videoRef.current = el;
    onVideoRef?.(el);
  };

  return (
    <video
      ref={bindRef}
      className={cn('h-full w-full object-contain bg-black', className)}
      playsInline
      onEnded={onEnded}
      data-replay-pgm="true"
    />
  );
}
