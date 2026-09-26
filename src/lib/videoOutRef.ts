import { useCallback, useRef } from 'react';

/** Registers a video element without clearing a shared PGM ref on stream/track churn. */
export function useOwnedVideoOutRef(onVideoRef?: (el: HTMLVideoElement | null) => void) {
  const ownedRef = useRef<HTMLVideoElement | null>(null);

  const bindVideoOutRef = useCallback(
    (el: HTMLVideoElement | null) => {
      if (!onVideoRef) return;
      if (el) {
        ownedRef.current = el;
        onVideoRef(el);
        return;
      }
      if (ownedRef.current !== null) {
        ownedRef.current = null;
        onVideoRef(null);
      }
    },
    [onVideoRef],
  );

  return { bindVideoOutRef, ownedRef };
}
