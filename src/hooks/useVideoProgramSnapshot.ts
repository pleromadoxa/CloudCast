import { useEffect } from 'react';
import { saveVideoProgramSnapshot } from '../lib/videoProgramSnapshot';

interface UseVideoProgramSnapshotPublisherOptions {
  enabled: boolean;
  sessionId: string | null | undefined;
  operatorKey: string;
  operatorLabel: string | null;
  pstDeviceId: string | null;
  pstDeviceLabel: string | null;
  pgmDeviceId: string | null;
  pgmDeviceLabel: string | null;
  isOnAir: boolean;
  isRecording: boolean;
  transitionType: string;
  outputMode: string;
  liveInputCount: number;
  replayOnPgm: boolean;
  replayLabel: string | null;
  intervalMs?: number;
}

export function useVideoProgramSnapshotPublisher(options: UseVideoProgramSnapshotPublisherOptions) {
  const {
    enabled,
    sessionId,
    operatorKey,
    operatorLabel,
    pstDeviceId,
    pstDeviceLabel,
    pgmDeviceId,
    pgmDeviceLabel,
    isOnAir,
    isRecording,
    transitionType,
    outputMode,
    liveInputCount,
    replayOnPgm,
    replayLabel,
    intervalMs = 30_000,
  } = options;

  useEffect(() => {
    if (!enabled || !sessionId) return;

    const save = () => {
      void saveVideoProgramSnapshot({
        sessionId,
        operatorKey,
        operatorLabel: operatorLabel ?? undefined,
        pstDeviceId,
        pstDeviceLabel,
        pgmDeviceId,
        pgmDeviceLabel,
        isOnAir,
        isRecording,
        transitionType,
        outputMode,
        liveInputCount,
        replayOnPgm,
        replayLabel,
      });
    };

    save();
    const timer = window.setInterval(save, intervalMs);
    return () => window.clearInterval(timer);
  }, [
    enabled,
    sessionId,
    operatorKey,
    operatorLabel,
    pstDeviceId,
    pstDeviceLabel,
    pgmDeviceId,
    pgmDeviceLabel,
    isOnAir,
    isRecording,
    transitionType,
    outputMode,
    liveInputCount,
    replayOnPgm,
    replayLabel,
    intervalMs,
  ]);
}
