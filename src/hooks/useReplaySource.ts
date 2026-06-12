import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReplaySourceKind } from '../types/replay';

export function useReplaySource(
  getMeshStream: (deviceId: string) => MediaStream | null,
  selectedDeviceId: string | null,
) {
  const [sourceKind, setSourceKind] = useState<ReplaySourceKind>('camera');
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopScreen = useCallback(() => {
    screenStream?.getTracks().forEach((t) => t.stop());
    setScreenStream(null);
  }, [screenStream]);

  const startScreenShare = useCallback(async () => {
    setError(null);
    try {
      stopScreen();
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });
      stream.getVideoTracks()[0]?.addEventListener('ended', () => setScreenStream(null));
      setScreenStream(stream);
      setSourceKind('screen');
      return true;
    } catch {
      setError('Screen share was cancelled or unavailable.');
      return false;
    }
  }, [stopScreen]);

  useEffect(() => () => stopScreen(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeStream = (() => {
    if (sourceKind === 'screen') return screenStream;
    if (selectedDeviceId) return getMeshStream(selectedDeviceId);
    return null;
  })();

  return {
    sourceKind,
    setSourceKind,
    screenStream,
    activeStream,
    error,
    startScreenShare,
    stopScreen,
  };
}

export function useReplayPreviewPlayback() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);

  const loadUrl = useCallback((url: string | null) => {
    const el = videoRef.current;
    if (!el) return;
    if (!url) {
      el.removeAttribute('src');
      el.load();
      setIsPlaying(false);
      return;
    }
    el.src = url;
    el.playbackRate = playbackRate;
    void el.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  }, [playbackRate]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play().then(() => setIsPlaying(true));
    } else {
      el.pause();
      setIsPlaying(false);
    }
  }, []);

  const stepFrame = useCallback((direction: 1 | -1) => {
    const el = videoRef.current;
    if (!el) return;
    el.pause();
    setIsPlaying(false);
    el.currentTime = Math.max(0, el.currentTime + direction * (1 / 30));
  }, []);

  return {
    videoRef,
    playbackRate,
    setPlaybackRate,
    isPlaying,
    loadUrl,
    togglePlay,
    stepFrame,
  };
}
