import { useEffect, useRef } from 'react';
import { Clapperboard, X } from 'lucide-react';
import { useProduction } from '../../context/ProductionContext';
import { cn } from '../../lib/utils';

/** Full-screen replay clip overlay on the video mixer PGM output. */
export function ReplayPgmOverlay() {
  const { replayPush, clearReplayPush } = useProduction();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !replayPush) return;
    el.src = replayPush.url;
    el.playbackRate = replayPush.playbackRate ?? 1;
    void el.play().catch(() => undefined);
  }, [replayPush]);

  if (!replayPush) return null;

  return (
    <div
      className={cn(
        'pointer-events-auto fixed inset-0 z-[60] flex flex-col bg-black/95',
      )}
      role="dialog"
      aria-label="Instant replay on program"
    >
      <div className="flex items-center justify-between border-b border-emerald-500/30 bg-emerald-950/40 px-4 py-2">
        <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-emerald-300">
          <Clapperboard className="h-4 w-4" />
          REPLAY ON PGM — {replayPush.label}
        </div>
        <button
          type="button"
          onClick={clearReplayPush}
          className="inline-flex items-center gap-1 rounded border border-white/20 px-2 py-1 text-[10px] font-bold tracking-wider hover:border-white/40"
        >
          <X className="h-3.5 w-3.5" /> DISMISS
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center p-4">
        <video
          ref={videoRef}
          className="max-h-full max-w-full rounded border border-emerald-500/20"
          playsInline
          onEnded={clearReplayPush}
        />
      </div>
    </div>
  );
}
