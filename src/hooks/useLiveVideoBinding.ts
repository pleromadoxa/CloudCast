import { useLayoutEffect, type RefObject } from 'react';
import { bindLiveVideoElement, liveVideoWireKey } from '../lib/liveVideoBinding';

/** Keep a video element synced with a live mesh/WHEP MediaStream (handles Chrome track lag). */
export function useLiveVideoBinding(
  videoRef: RefObject<HTMLVideoElement | null>,
  stream: MediaStream | null | undefined,
) {
  const wireKey = liveVideoWireKey(stream);

  useLayoutEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    let raf = 0;

    const tryBind = () => {
      if (cancelled) return;
      const el = videoRef.current;
      if (!el) {
        if (!stream) return;
        raf = requestAnimationFrame(tryBind);
        return;
      }
      cleanup = bindLiveVideoElement(el, stream);
    };

    tryBind();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      cleanup?.();
    };
  }, [videoRef, stream, wireKey]);
}
