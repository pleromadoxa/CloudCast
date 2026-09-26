import { useCallback, useEffect, useRef } from 'react';
import { useBrowserFeedOptional } from '../../context/BrowserFeedContext';
import { useOwnedVideoOutRef } from '../../lib/videoOutRef';
import { cn } from '../../lib/utils';

interface BrowserFeedVideoCaptureProps {
  className?: string;
  onVideoRef?: (el: HTMLVideoElement | null) => void;
}

/**
 * Fallback capture for chroma / encode paths. Cross-origin iframes cannot be
 * drawn to canvas, so we paint a branded slate with the active URL. Local PGM
 * monitors still show the live interactive iframe via BrowserFeedPlayer.
 */
export function BrowserFeedVideoCapture({ className, onVideoRef }: BrowserFeedVideoCaptureProps) {
  const browser = useBrowserFeedOptional();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const captureTrackRef = useRef<MediaStreamTrack | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { bindVideoOutRef } = useOwnedVideoOutRef(onVideoRef);

  const label = browser?.state.activeUrl || browser?.state.urlInput || 'Browser Shot';
  const hasUrl = Boolean(browser?.state.embedUrl);

  const bindCaptureVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      bindVideoOutRef(el);
    },
    [bindVideoOutRef],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    canvas.width = 1920;
    canvas.height = 1080;

    canvas.style.position = 'fixed';
    canvas.style.left = '-9999px';
    canvas.style.top = '0';
    canvas.style.width = '1920px';
    canvas.style.height = '1080px';
    canvas.style.pointerEvents = 'none';
    canvas.setAttribute('aria-hidden', 'true');
    if (!canvas.parentElement) {
      document.body.appendChild(canvas);
    }

    const stream = canvas.captureStream(15);
    streamRef.current = stream;
    captureTrackRef.current = stream.getVideoTracks()[0] ?? null;
    video.srcObject = stream;
    void video.play().catch(() => undefined);
    bindVideoOutRef(video);

    return () => {
      bindVideoOutRef(null);
      video.srcObject = null;
      streamRef.current = null;
      captureTrackRef.current = null;
      if (canvas.parentElement) {
        canvas.parentElement.removeChild(canvas);
      }
      for (const track of stream.getTracks()) track.stop();
    };
  }, [bindVideoOutRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const draw = () => {
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#0ea5e9';
      ctx.font = 'bold 48px system-ui, sans-serif';
      ctx.fillText('BROWSER SHOT', 80, 200);

      ctx.fillStyle = hasUrl ? '#e2e8f0' : '#64748b';
      ctx.font = '32px system-ui, sans-serif';
      const text = hasUrl ? label : 'Open a URL in the Browser panel';
      const maxWidth = canvas.width - 160;
      const words = text.split('');
      let line = '';
      let y = 280;
      for (const ch of words) {
        const test = line + ch;
        if (ctx.measureText(test).width > maxWidth) {
          ctx.fillText(line, 80, y);
          line = ch;
          y += 44;
          if (y > 900) break;
        } else {
          line = test;
        }
      }
      if (line && y <= 900) ctx.fillText(line, 80, y);

      ctx.fillStyle = '#64748b';
      ctx.font = '24px system-ui, sans-serif';
      ctx.fillText('Live interactive view is on the mixer monitors', 80, 1000);

      const track = captureTrackRef.current as (MediaStreamTrack & { requestFrame?: () => void }) | null;
      track?.requestFrame?.();

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [label, hasUrl]);

  return (
    <div className={cn('relative h-full w-full overflow-hidden bg-black', className)}>
      <canvas ref={canvasRef} className="pointer-events-none absolute h-0 w-0 opacity-0" aria-hidden data-pgm-capture="1" />
      <video ref={bindCaptureVideoRef} className="h-full w-full object-cover" playsInline muted autoPlay data-pgm-capture="1" />
    </div>
  );
}
