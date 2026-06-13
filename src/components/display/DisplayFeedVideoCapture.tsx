import { useEffect, useRef } from 'react';
import { useDisplayFeedOptional } from '../../context/DisplayFeedContext';
import { DISPLAY_CANVAS_HEIGHT, DISPLAY_CANVAS_WIDTH } from '../../lib/displayCanvas';
import { paintDisplaySlideToCanvas } from '../../lib/displaySlideCanvasDraw';
import { cn } from '../../lib/utils';

interface DisplayFeedVideoCaptureProps {
  live?: boolean;
  compact?: boolean;
  showLabel?: boolean;
  className?: string;
  onVideoRef?: (el: HTMLVideoElement | null) => void;
}

/**
 * Renders Regal Display slides to a canvas (exact chroma green) and exposes a
 * MediaStream-backed video element for the Video Mixer chroma/luma key path.
 */
export function DisplayFeedVideoCapture({
  live = true,
  compact = false,
  showLabel = true,
  className,
  onVideoRef,
}: DisplayFeedVideoCaptureProps) {
  const display = useDisplayFeedOptional();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageCacheRef = useRef(new Map<string, HTMLImageElement>());

  const slide = live ? display?.liveSlide : display?.previewSlide;
  const keyMode = display?.state.keyMode ?? false;
  const holdBg = display?.state.holdBackground;
  const label = live
    ? display?.isLive
      ? 'Display Feed · LIVE'
      : 'Display Feed · HOLD'
    : 'Display Feed · PREVIEW';

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    canvas.width = DISPLAY_CANVAS_WIDTH;
    canvas.height = DISPLAY_CANVAS_HEIGHT;

    const stream = canvas.captureStream(30);
    video.srcObject = stream;
    void video.play().catch(() => undefined);
    onVideoRef?.(video);

    return () => {
      onVideoRef?.(null);
      video.srcObject = null;
    };
  }, [onVideoRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let raf = 0;
    const draw = () => {
      paintDisplaySlideToCanvas(ctx, slide ?? null, holdBg, keyMode, imageCacheRef.current);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [slide, holdBg, keyMode]);

  return (
    <div className={cn('relative h-full w-full overflow-hidden bg-black', className)}>
      <canvas ref={canvasRef} className="pointer-events-none absolute h-0 w-0 opacity-0" aria-hidden />
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        playsInline
        muted
        autoPlay
      />
      {showLabel && !compact && (
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 to-transparent px-2 py-1">
          <span className="text-xs font-bold tracking-wide text-white">{label}</span>
        </div>
      )}
      {live && display?.isLive && (
        <div className="pointer-events-none absolute right-2 top-2 z-30 rounded bg-violet-600/90 px-2 py-0.5 text-[9px] font-bold tracking-wider text-white">
          LIVE
        </div>
      )}
    </div>
  );
}
