import { useCallback, useEffect, useRef, useState } from 'react';
import { useCloudCastOptional } from '../context/CloudCastContext';
import { useWhepStream } from './useWhepStream';
import { isMeshStreamActive } from '../lib/deviceConnection';
import { isRealDevice } from '../types/device';

export function usePrismVideoSource(cameraSourceId: string) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const localStreamRef = useRef<MediaStream | null>(null);
  // Remembers the operator's chosen USB devices so changing one input does
  // not silently reset the other to the system default.
  const localDeviceIdsRef = useRef<{ video: string | null; audio: string | null }>({
    video: null,
    audio: null,
  });
  // Render-visible mirror of the ref above so device <select>s stay in sync
  // after re-enumeration.
  const [activeDeviceIds, setActiveDeviceIds] = useState<{ video: string | null; audio: string | null }>({
    video: null,
    audio: null,
  });

  const cloudcast = useCloudCastOptional();
  const isMobile = cameraSourceId !== 'local';
  const mobileDevice = isMobile
    ? cloudcast?.devices.find((d) => d.deviceId === cameraSourceId && isRealDevice(d)) ?? null
    : null;

  const useMesh = cloudcast?.connectionMode === 'mesh';
  const meshStream = isMobile && useMesh ? cloudcast?.getMeshStream(cameraSourceId) ?? null : null;
  const whep = useWhepStream({
    deviceId: mobileDevice?.deviceId ?? 'prism-none',
    whepUrl: mobileDevice?.whepUrl ?? null,
    enabled: isMobile && !useMesh && Boolean(mobileDevice?.whepUrl),
    quality: 'auto',
  });

  const refreshDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      // USB capture cards (Elgato, Blackmagic, HDMI-to-USB), webcams and
      // built-in cameras all enumerate as videoinput; USB audio interfaces
      // and headset mics enumerate as audioinput.
      setDevices(all.filter((d) => d.kind === 'videoinput'));
      setAudioDevices(all.filter((d) => d.kind === 'audioinput'));
    } catch {
      /* ignore */
    }
  }, []);

  const stopLocal = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
  }, []);

  const startLocal = useCallback(
    async (deviceId?: string | null, audioDeviceId?: string | null) => {
      stopLocal();
      setError(null);
      const videoId = deviceId !== undefined && deviceId !== null ? deviceId : localDeviceIdsRef.current.video;
      const audioId = audioDeviceId !== undefined && audioDeviceId !== null ? audioDeviceId : localDeviceIdsRef.current.audio;
      localDeviceIdsRef.current = { video: videoId, audio: audioId };
      setActiveDeviceIds({ video: videoId, audio: audioId });
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: videoId ? { exact: videoId } : undefined,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
          },
          audio: {
            // USB audio interfaces / capture-card audio / headset mics.
            deviceId: audioId ? { exact: audioId } : undefined,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        localStreamRef.current = media;
        if (videoRef.current) {
          videoRef.current.srcObject = media;
          await videoRef.current.play();
        }
        setActive(true);
        await refreshDevices();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Camera access denied');
        setActive(false);
      }
    },
    [stopLocal, refreshDevices],
  );

  const stop = useCallback(() => {
    stopLocal();
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  }, [stopLocal]);

  const start = useCallback(
    async (localDeviceId?: string | null, localAudioDeviceId?: string | null) => {
      if (cameraSourceId === 'local') {
        await startLocal(localDeviceId, localAudioDeviceId);
        return;
      }
      setError(null);
      setActive(true);
    },
    [cameraSourceId, startLocal],
  );

  useEffect(() => {
    if (!isMobile || !active) return;
    const stream = useMesh ? meshStream : whep.stream;
    const video = videoRef.current;
    if (!video) return;

    if (stream && (useMesh ? isMeshStreamActive(stream) : true)) {
      video.srcObject = stream;
      void video.play().catch(() => undefined);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing error state to the external stream
      setError(null);
    } else if (mobileDevice) {
      setError('Waiting for mobile camera feed… Pair CloudCast Mobile with your access code.');
    }
  }, [isMobile, active, useMesh, meshStream, whep.stream, mobileDevice]);

  useEffect(() => {
    // Initial device enumeration — async, so updates land in callbacks.
    let alive = true;
    navigator.mediaDevices
      .enumerateDevices()
      .then((all) => {
        if (!alive) return;
        setDevices(all.filter((d) => d.kind === 'videoinput'));
        setAudioDevices(all.filter((d) => d.kind === 'audioinput'));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      stopLocal();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cameraSourceId === 'local') return;
    stopLocal();
    if (videoRef.current) videoRef.current.srcObject = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors the external source switch
    setActive(false);
  }, [cameraSourceId, stopLocal]);

  const pairedMobileDevices = (cloudcast?.devices ?? []).filter(
    (d) => isRealDevice(d) && d.deviceRole !== 'audio',
  );

  return {
    videoRef,
    active,
    error,
    devices,
    audioDevices,
    /** Currently active USB device ids — drives the capture <select>s. */
    deviceIds: activeDeviceIds,
    start,
    stop,
    refreshDevices,
    pairedMobileDevices,
    accessCode: cloudcast?.session?.accessCode ?? '',
    sessionReady: Boolean(cloudcast?.session),
    isMobileSource: isMobile,
  };
}
