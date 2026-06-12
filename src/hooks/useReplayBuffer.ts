import { useCallback, useEffect, useRef, useState } from 'react';

interface BufferChunk {
  blob: Blob;
  atMs: number;
}

function pickRecorderMime(): string {
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) return 'video/webm;codecs=vp9,opus';
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) return 'video/webm;codecs=vp8,opus';
  if (MediaRecorder.isTypeSupported('video/webm')) return 'video/webm';
  return '';
}

export interface ReplayBufferState {
  isRecording: boolean;
  bufferSeconds: number;
  maxSeconds: number;
  markInSec: number | null;
  markOutSec: number | null;
  mimeType: string;
}

export function useReplayBuffer(maxSeconds: number, sourceStream: MediaStream | null) {
  const chunksRef = useRef<BufferChunk[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const startedAtRef = useRef<number>(0);
  const markInRef = useRef<number | null>(null);
  const markOutRef = useRef<number | null>(null);
  const mimeRef = useRef('');

  const [isRecording, setIsRecording] = useState(false);
  const [bufferSeconds, setBufferSeconds] = useState(0);
  const [markInSec, setMarkInSec] = useState<number | null>(null);
  const [markOutSec, setMarkOutSec] = useState<number | null>(null);

  const pruneOldChunks = useCallback(() => {
    const cutoff = performance.now() - maxSeconds * 1000;
    chunksRef.current = chunksRef.current.filter((c) => c.atMs >= cutoff);
    if (chunksRef.current.length === 0) {
      setBufferSeconds(0);
      return;
    }
    const oldest = chunksRef.current[0]!.atMs;
    setBufferSeconds(Math.min(maxSeconds, (performance.now() - oldest) / 1000));
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

    const mime = pickRecorderMime();
    if (!mime) return false;

    chunksRef.current = [];
    markInRef.current = null;
    markOutRef.current = null;
    setMarkInSec(null);
    setMarkOutSec(null);
    startedAtRef.current = performance.now();
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

  const bufferStartMs = useCallback(() => {
    if (chunksRef.current.length === 0) return performance.now();
    return chunksRef.current[0]!.atMs;
  }, []);

  const markIn = useCallback(() => {
    if (!isRecording || chunksRef.current.length === 0) return null;
    const sec = (performance.now() - bufferStartMs()) / 1000;
    markInRef.current = sec;
    setMarkInSec(sec);
    return sec;
  }, [isRecording, bufferStartMs]);

  const markOut = useCallback(() => {
    if (!isRecording || chunksRef.current.length === 0) return null;
    const sec = (performance.now() - bufferStartMs()) / 1000;
    markOutRef.current = sec;
    setMarkOutSec(sec);
    return sec;
  }, [isRecording, bufferStartMs]);

  const clearMarks = useCallback(() => {
    markInRef.current = null;
    markOutRef.current = null;
    setMarkInSec(null);
    setMarkOutSec(null);
  }, []);

  const extractClip = useCallback((): { blob: Blob; mimeType: string; durationSec: number; inSec: number; outSec: number } | null => {
    const chunks = chunksRef.current;
    if (chunks.length === 0) return null;

    const startMs = bufferStartMs();
    const endMs = performance.now();
    const inSec = markInRef.current ?? 0;
    const outSec = markOutRef.current ?? (endMs - startMs) / 1000;
    const fromSec = Math.min(inSec, outSec);
    const toSec = Math.max(inSec, outSec);
    if (toSec - fromSec < 0.05) return null;

    const fromMs = startMs + fromSec * 1000;
    const toMs = startMs + toSec * 1000;
    const selected = chunks.filter((c) => c.atMs >= fromMs - 300 && c.atMs <= toMs + 300);
    if (selected.length === 0) return null;

    const mimeType = mimeRef.current || 'video/webm';
    const blob = new Blob(selected.map((c) => c.blob), { type: mimeType });
    return { blob, mimeType, durationSec: toSec - fromSec, inSec: fromSec, outSec: toSec };
  }, [bufferStartMs]);

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
    mimeType: mimeRef.current,
    markIn,
    markOut,
    clearMarks,
    extractClip,
    toggleRecording,
    stopRecorder,
    startRecorder,
  };
}
