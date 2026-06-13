import { useEffect, useRef } from 'react';
import { logReplayAudit } from '../lib/replayAuditService';

interface UseReplayBufferResilienceOptions {
  enabled: boolean;
  isRecording: boolean;
  chunkCount: number;
  hasSource: boolean;
  sessionId?: string | null;
  stallMs?: number;
  onRecover: () => void;
}

/** Detect stalled MediaRecorder buffers and auto-restart recording. */
export function useReplayBufferResilience({
  enabled,
  isRecording,
  chunkCount,
  hasSource,
  sessionId,
  stallMs = 3500,
  onRecover,
}: UseReplayBufferResilienceOptions) {
  const lastChunkCountRef = useRef(chunkCount);
  const lastProgressAtRef = useRef(Date.now());
  const recoveringRef = useRef(false);

  useEffect(() => {
    lastChunkCountRef.current = chunkCount;
    lastProgressAtRef.current = Date.now();
  }, [chunkCount]);

  useEffect(() => {
    if (!enabled || !isRecording || !hasSource) return;

    const timer = window.setInterval(() => {
      if (chunkCount !== lastChunkCountRef.current) {
        lastChunkCountRef.current = chunkCount;
        lastProgressAtRef.current = Date.now();
        return;
      }

      if (Date.now() - lastProgressAtRef.current < stallMs) return;
      if (recoveringRef.current) return;

      recoveringRef.current = true;
      lastProgressAtRef.current = Date.now();

      void logReplayAudit({
        eventType: 'buffer_stall_recovered',
        sessionId,
        meta: { chunkCount, stallMs },
      });

      onRecover();

      window.setTimeout(() => {
        recoveringRef.current = false;
      }, 1500);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [enabled, isRecording, hasSource, chunkCount, stallMs, onRecover, sessionId]);
}
