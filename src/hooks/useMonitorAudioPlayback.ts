import { useCallback, useEffect, useRef } from 'react';
import {
  registerMonitorAudioElement,
  unlockDashboardAudio,
  unregisterMonitorAudioElement,
} from '../lib/audioOutput';
import { hasUsableAudio } from '../lib/streamAudioHub';

/**
 * Routes a MediaStream to a hidden <video> for monitor speaker output.
 * Uses a callback ref so playback starts as soon as the element mounts.
 */
export function useMonitorAudioPlayback(
  stream: MediaStream | null,
  active: boolean,
  volume: number,
) {
  const elRef = useRef<HTMLVideoElement | null>(null);

  const sync = useCallback(() => {
    const el = elRef.current;
    if (!el) return;

    if (!active || !stream || volume <= 0) {
      el.srcObject = null;
      el.muted = true;
      return;
    }

    if (!hasUsableAudio(stream)) return;

    for (const track of stream.getAudioTracks()) {
      track.enabled = true;
    }

    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }

    el.muted = false;
    el.volume = Math.min(1, Math.max(0, volume));

    void unlockDashboardAudio().then(() => {
      el.play().catch(() => undefined);
    });
  }, [active, stream, volume]);

  const setMonitorAudioRef = useCallback(
    (el: HTMLVideoElement | null) => {
      if (elRef.current && elRef.current !== el) {
        unregisterMonitorAudioElement(elRef.current);
      }
      elRef.current = el;
      if (el) {
        registerMonitorAudioElement(el);
        sync();
      }
    },
    [sync],
  );

  useEffect(() => {
    return () => {
      const el = elRef.current;
      if (el) unregisterMonitorAudioElement(el);
    };
  }, []);

  useEffect(() => {
    sync();
    if (!stream) return;

    const onTrackChange = () => sync();
    stream.addEventListener('addtrack', onTrackChange);
    stream.addEventListener('removetrack', onTrackChange);

    return () => {
      stream.removeEventListener('addtrack', onTrackChange);
      stream.removeEventListener('removetrack', onTrackChange);
    };
  }, [stream, sync]);

  return setMonitorAudioRef;
}
