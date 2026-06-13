import { useCallback, useEffect, useRef, useState } from 'react';
import {
  bufferStartMs,
  computeBufferSeconds,
  extractMarkedClip,
  pruneChunksBefore,
  type TimestampedChunk,
} from '../lib/replayClipMux';
import { pickRecorderMimeType } from '../lib/broadcast/pgmCaptureStream';
import {
  DEFAULT_REPLAY_FPS,
  formatSmpteFromSeconds,
  houseClockSeconds,
} from '../lib/replayTimecode';

export interface ReplayBufferState {
  isRecording: boolean;
  bufferSeconds: number;
  maxSeconds: number;
  markInSec: number | null;
  markOutSec: number | null;
  markTimecodeIn: string | null;
  markTimecodeOut: string | null;
  houseClockSmpte: string;
  mimeType: string;
  chunkCount: number;
}

export function useReplayBuffer(
  maxSeconds: number,
  sourceStream: MediaStream | null,
  options?: { fps?: number; houseAnchorMs?: number },
) {
  const fps = options?.fps ?? DEFAULT_REPLAY_FPS;
  const houseAnchorRef = useRef(options?.houseAnchorMs ?? Date.now());

  const chunksRef = useRef<TimestampedChunk[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const markInRef = useRef<number | null>(null);
  const markOutRef = useRef<number | null>(null);
  const markTcInRef = useRef<string | null>(null);
  const markTcOutRef = useRef<string | null>(null);
  const mimeRef = useRef('');

  const [isRecording, setIsRecording] = useState(false);
  const [bufferSeconds, setBufferSeconds] = useState(0);
  const [markInSec, setMarkInSec] = useState<number | null>(null);
  const [markOutSec, setMarkOutSec] = useState<number | null>(null);
  const [markTimecodeIn, setMarkTimecodeIn] = useState<string | null>(null);
  const [markTimecodeOut, setMarkTimecodeOut] = useState<string | null>(null);
  const [houseClockSmpte, setHouseClockSmpte] = useState('00:00:00:00');
  const [chunkCount, setChunkCount] = useState(0);

  useEffect(() => {
    if (options?.houseAnchorMs) {
      houseAnchorRef.current = options.houseAnchorMs;
    }
  }, [options?.houseAnchorMs]);

  useEffect(() => {
    if (!isRecording) return;
    const timer = window.setInterval(() => {
      setHouseClockSmpte(formatSmpteFromSeconds(houseClockSeconds(houseAnchorRef.current), fps));
    }, 100);
    return () => window.clearInterval(timer);
  }, [isRecording, fps]);

  const pruneOldChunks = useCallback(() => {
    const nowMs = performance.now();
    chunksRef.current = pruneChunksBefore(chunksRef.current, maxSeconds, nowMs);
    setChunkCount(chunksRef.current.length);
    setBufferSeconds(computeBufferSeconds(chunksRef.current, maxSeconds, nowMs));
  }, [maxSeconds]);

  const stopRecorder = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    recorderRef.current = null;
    setIsRecording(false);
  }, []);

  const startRecorder = useCallback(() => {
    if (!sourceStream || isRecording) return false;

    const videoTracks = sourceStream.getVideoTracks().filter((t) => t.readyState === 'live');
    if (videoTracks.length === 0) return false;

    const mime = pickRecorderMimeType();
    if (!mime) return false;

    if (chunksRef.current.length === 0) {
      houseAnchorRef.current = Date.now();
    }

    markInRef.current = null;
    markOutRef.current = null;
    markTcInRef.current = null;
    markTcOutRef.current = null;
    setMarkInSec(null);
    setMarkOutSec(null);
    setMarkTimecodeIn(null);
    setMarkTimecodeOut(null);
    mimeRef.current = mime;

    try {
      const recorder = new MediaRecorder(sourceStream, {
        mimeType: mime,
        videoBitsPerSecond: 3_500_000,
      });
      recorder.ondataavailable = (e) => {
        if (e.data.size <= 0) return;
        chunksRef.current.push({ blob: e.data, atMs: performance.now() });
        pruneOldChunks();
      };
      recorder.start(250);
      recorderRef.current = recorder;
      setIsRecording(true);
      return true;
    } catch {
      return false;
    }
  }, [sourceStream, isRecording, pruneOldChunks]);

  const restartRecorder = useCallback(() => {
    if (!sourceStream) return;
    const mime = mimeRef.current || pickRecorderMimeType();
    if (!mime) return;

    stopRecorder();

    window.setTimeout(() => {
      if (!sourceStream) return;
      try {
        const recorder = new MediaRecorder(sourceStream, {
          mimeType: mime,
          videoBitsPerSecond: 3_500_000,
        });
        recorder.ondataavailable = (e) => {
          if (e.data.size <= 0) return;
          chunksRef.current.push({ blob: e.data, atMs: performance.now() });
          pruneOldChunks();
        };
        recorder.start(250);
        recorderRef.current = recorder;
        mimeRef.current = mime;
        setIsRecording(true);
      } catch {
        /* ignore */
      }
    }, 250);
  }, [sourceStream, stopRecorder, pruneOldChunks]);

  useEffect(() => {
    if (!isRecording) return;
    const id = window.setInterval(pruneOldChunks, 500);
    return () => window.clearInterval(id);
  }, [isRecording, pruneOldChunks]);

  useEffect(() => {
    if (sourceStream && !isRecording) {
      startRecorder();
    }
    return () => stopRecorder();
  }, [sourceStream]); // eslint-disable-line react-hooks/exhaustive-deps

  const getBufferStartMs = useCallback(() => {
    return bufferStartMs(chunksRef.current, performance.now());
  }, []);

  const markIn = useCallback(() => {
    if (!isRecording || chunksRef.current.length === 0) return null;
    const sec = (performance.now() - getBufferStartMs()) / 1000;
    const tc = formatSmpteFromSeconds(houseClockSeconds(houseAnchorRef.current), fps);
    markInRef.current = sec;
    markTcInRef.current = tc;
    setMarkInSec(sec);
    setMarkTimecodeIn(tc);
    return sec;
  }, [isRecording, getBufferStartMs, fps]);

  const markOut = useCallback(() => {
    if (!isRecording || chunksRef.current.length === 0) return null;
    const sec = (performance.now() - getBufferStartMs()) / 1000;
    const tc = formatSmpteFromSeconds(houseClockSeconds(houseAnchorRef.current), fps);
    markOutRef.current = sec;
    markTcOutRef.current = tc;
    setMarkOutSec(sec);
    setMarkTimecodeOut(tc);
    return sec;
  }, [isRecording, getBufferStartMs, fps]);

  const clearMarks = useCallback(() => {
    markInRef.current = null;
    markOutRef.current = null;
    markTcInRef.current = null;
    markTcOutRef.current = null;
    setMarkInSec(null);
    setMarkOutSec(null);
    setMarkTimecodeIn(null);
    setMarkTimecodeOut(null);
  }, []);

  const extractClip = useCallback(() => {
    const nowMs = performance.now();
    return extractMarkedClip({
      chunks: chunksRef.current,
      bufferStartMs: getBufferStartMs(),
      markInSec: markInRef.current,
      markOutSec: markOutRef.current,
      nowMs,
      mimeType: mimeRef.current || 'video/webm',
      fps,
      snapFrames: true,
    });
  }, [getBufferStartMs, fps]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecorder();
      return { ok: true, message: 'Buffer paused' };
    }
    const ok = startRecorder();
    return ok
      ? { ok: true, message: 'Rolling buffer recording' }
      : { ok: false, message: 'Select a live source to start the buffer' };
  }, [isRecording, startRecorder, stopRecorder]);

  return {
    isRecording,
    bufferSeconds,
    maxSeconds,
    markInSec,
    markOutSec,
    markTimecodeIn,
    markTimecodeOut,
    houseClockSmpte,
    mimeType: mimeRef.current,
    chunkCount,
    markIn,
    markOut,
    clearMarks,
    extractClip,
    toggleRecording,
    stopRecorder,
    startRecorder,
    restartRecorder,
    getMarkTimecodes: () => ({
      in: markTcInRef.current,
      out: markTcOutRef.current,
    }),
  };
}
