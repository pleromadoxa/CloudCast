import { useCallback, useRef, useState } from 'react';
import { pickRecorderMimeType } from '../lib/broadcast/pgmCaptureStream';

export function usePrismRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        setRecording(false);
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        chunksRef.current = [];
        recorderRef.current = null;
        setRecording(false);
        resolve(blob.size > 0 ? blob : null);
      };

      recorder.stop();
    });
  }, []);

  const startRecording = useCallback((stream: MediaStream | null): boolean => {
    if (!stream?.getVideoTracks().length) return false;
    const mimeType = pickRecorderMimeType();
    if (!mimeType) return false;

    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 4_000_000,
      audioBitsPerSecond: stream.getAudioTracks().length ? 128_000 : undefined,
    });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.start(500);
    recorderRef.current = recorder;
    setRecording(true);
    return true;
  }, []);

  const downloadRecording = useCallback(async (stream: MediaStream | null, filename?: string) => {
    if (!startRecording(stream)) return false;
    return new Promise<boolean>((resolve) => {
      setTimeout(async () => {
        const blob = await stopRecording();
        if (!blob) {
          resolve(false);
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename ?? `regal-prism-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        resolve(true);
      }, 5000);
    });
  }, [startRecording, stopRecording]);

  return { recording, startRecording, stopRecording, downloadRecording };
}
