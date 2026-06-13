import { useEffect, useRef } from 'react';
import type { ReplaySourceKind } from '../types/replay';
import { saveReplayBufferSnapshot } from '../lib/replayBufferSnapshot';

interface UseReplayBufferSnapshotPublisherOptions {
  enabled: boolean;
  sessionId: string | null | undefined;
  operatorKey: string;
  operatorLabel: string | null;
  sourceKind: ReplaySourceKind;
  isRecording: boolean;
  bufferSeconds: number;
  chunkCount: number;
  markInSec: number | null;
  markOutSec: number | null;
  markTimecodeIn: string | null;
  markTimecodeOut: string | null;
  houseClockSmpte: string;
  intervalMs?: number;
}

/** Persist rolling buffer ops metadata to Regal Cloud for crash recovery notes. */
export function useReplayBufferSnapshotPublisher({
  enabled,
  sessionId,
  operatorKey,
  operatorLabel,
  sourceKind,
  isRecording,
  bufferSeconds,
  chunkCount,
  markInSec,
  markOutSec,
  markTimecodeIn,
  markTimecodeOut,
  houseClockSmpte,
  intervalMs = 30_000,
}: UseReplayBufferSnapshotPublisherOptions) {
  const lastSavedAtRef = useRef(0);

  useEffect(() => {
    if (!enabled || !sessionId || !isRecording) return;

    const save = () => {
      void saveReplayBufferSnapshot({
        sessionId,
        operatorKey,
        operatorLabel: operatorLabel ?? undefined,
        sourceKind,
        bufferSeconds,
        chunkCount,
        markInSec,
        markOutSec,
        markTimecodeIn,
        markTimecodeOut,
        houseClockSmpte,
        isRecording,
      });
      lastSavedAtRef.current = Date.now();
    };

    save();
    const timer = window.setInterval(save, intervalMs);
    return () => window.clearInterval(timer);
  }, [
    enabled,
    sessionId,
    operatorKey,
    operatorLabel,
    sourceKind,
    isRecording,
    bufferSeconds,
    chunkCount,
    markInSec,
    markOutSec,
    markTimecodeIn,
    markTimecodeOut,
    houseClockSmpte,
    intervalMs,
  ]);
}
