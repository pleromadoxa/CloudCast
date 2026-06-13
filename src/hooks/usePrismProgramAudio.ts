import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react';
import { usePgmAudioOptional } from '../context/PgmAudioContext';
import {
  audioFromVideoElement,
  combineAudioSources,
  mergeProgramStream,
} from '../lib/prism/prismProgramStream';

interface UsePrismProgramAudioOptions {
  includeMic: boolean;
  includeMixer: boolean;
}

export function usePrismProgramAudio(
  videoRef: RefObject<HTMLVideoElement | null>,
  { includeMic, includeMixer }: UsePrismProgramAudioOptions,
) {
  const pgmAudio = usePgmAudioOptional();
  const [mixerAudio, setMixerAudio] = useState<MediaStream | null>(null);
  const [dedicatedMic, setDedicatedMic] = useState<MediaStream | null>(null);
  const [cameraHasAudio, setCameraHasAudio] = useState(false);

  useEffect(() => {
    if (!includeMixer || !pgmAudio) {
      setMixerAudio(null);
      return;
    }
    const refresh = () => setMixerAudio(pgmAudio.getBroadcastAudioStream());
    refresh();
    const id = window.setInterval(refresh, 1500);
    return () => window.clearInterval(id);
  }, [includeMixer, pgmAudio]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const check = () => {
      const has = video.srcObject instanceof MediaStream && video.srcObject.getAudioTracks().length > 0;
      setCameraHasAudio(has);
    };
    check();
    video.addEventListener('loadedmetadata', check);
    return () => video.removeEventListener('loadedmetadata', check);
  }, [videoRef, includeMic]);

  useEffect(() => {
    if (!includeMic || cameraHasAudio) {
      setDedicatedMic((prev) => {
        prev?.getTracks().forEach((t) => t.stop());
        return null;
      });
      return;
    }

    let cancelled = false;
    void navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then((stream) => {
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      setDedicatedMic(stream);
    }).catch(() => {
      setDedicatedMic(null);
    });

    return () => {
      cancelled = true;
      setDedicatedMic((prev) => {
        prev?.getTracks().forEach((t) => t.stop());
        return null;
      });
    };
  }, [includeMic, cameraHasAudio]);

  const audioStream = useMemo(() => {
    const fromCamera = includeMic ? audioFromVideoElement(videoRef.current) : null;
    const fromMixer = includeMixer ? mixerAudio : null;
    return combineAudioSources(fromCamera, dedicatedMic, fromMixer);
  }, [includeMic, includeMixer, mixerAudio, dedicatedMic, videoRef, cameraHasAudio]);

  const buildProgramStream = useCallback(
    (programStream: MediaStream | null) => mergeProgramStream(programStream, audioStream),
    [audioStream],
  );

  const hasAudio = Boolean(audioStream?.getAudioTracks().length);

  return { audioStream, buildProgramStream, hasAudio };
}
