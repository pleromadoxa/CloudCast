import { useCallback, useRef, useState } from 'react';

function buildPgmRecordStream(
  videoEl: HTMLVideoElement | null,
  broadcastAudio?: MediaStream | null,
): MediaStream | null {
  if (!videoEl?.srcObject) return null;
  const videoStream = videoEl.srcObject as MediaStream;
  const videoTracks = videoStream.getVideoTracks().filter((t) => t.readyState === 'live');
  if (videoTracks.length === 0) return null;

  const out = new MediaStream();
  for (const track of videoTracks) out.addTrack(track);

  const audioTracks =
    broadcastAudio?.getAudioTracks().filter((t) => t.readyState === 'live') ??
    videoStream.getAudioTracks().filter((t) => t.readyState === 'live');

  for (const track of audioTracks) out.addTrack(track.clone());

  return out;
}

interface UsePgmRecordingOptions {
  onComplete?: (blob: Blob, mimeType: string, fileName: string) => void | Promise<void>;
}

export function usePgmRecording(options?: UsePgmRecordingOptions) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const onCompleteRef = useRef(options?.onComplete);
  onCompleteRef.current = options?.onComplete;
  const [isRecording, setIsRecording] = useState(false);

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    recorderRef.current = null;
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(
    (videoEl: HTMLVideoElement | null, broadcastAudio?: MediaStream | null) => {
      if (!videoEl || isRecording) return false;

      const stream = buildPgmRecordStream(videoEl, broadcastAudio);
      if (!stream) return false;

      chunksRef.current = [];
      const mime =
        MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
          ? 'video/webm;codecs=vp9,opus'
          : MediaRecorder.isTypeSupported('video/webm')
            ? 'video/webm'
            : '';

      if (!mime) return false;

      try {
        const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: mime });
          const fileName = `cloudcast-pgm-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          a.click();
          URL.revokeObjectURL(url);
          chunksRef.current = [];
          void onCompleteRef.current?.(blob, mime, fileName);
        };
        recorder.start(1000);
        recorderRef.current = recorder;
        setIsRecording(true);
        return true;
      } catch {
        return false;
      }
    },
    [isRecording],
  );

  const toggleRecording = useCallback(
    (
      videoEl: HTMLVideoElement | null,
      broadcastAudio?: MediaStream | null,
    ): { ok: boolean; message: string } => {
      if (isRecording) {
        stopRecording();
        return { ok: true, message: 'Recording stopped. Saving file…' };
      }
      if (!videoEl?.srcObject) {
        return { ok: false, message: 'No PGM video signal. Put a live source on program before recording.' };
      }
      const started = startRecording(videoEl, broadcastAudio);
      if (!started) {
        return { ok: false, message: 'Could not start recorder. Try another browser or check PGM output.' };
      }
      return { ok: true, message: 'Recording PGM to WebM…' };
    },
    [isRecording, startRecording, stopRecording],
  );

  return { isRecording, toggleRecording, stopRecording };
}
