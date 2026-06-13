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
  const localStreamRef = useRef<MediaStream | null>(null);

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
      setDevices(all.filter((d) => d.kind === 'videoinput'));
    } catch {
      /* ignore */
    }
  }, []);

  const stopLocal = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
  }, []);

  const startLocal = useCallback(
    async (deviceId?: string | null) => {
      stopLocal();
      setError(null);
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
          },
          audio: {
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
    async (localDeviceId?: string | null) => {
      if (cameraSourceId === 'local') {
        await startLocal(localDeviceId);
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
      setError(null);
    } else if (mobileDevice) {
      setError('Waiting for mobile camera feed… Pair CloudCast Mobile with your access code.');
    }
  }, [isMobile, active, useMesh, meshStream, whep.stream, mobileDevice]);

  useEffect(() => {
    void refreshDevices();
    return () => stopLocal();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cameraSourceId === 'local') return;
    stopLocal();
    if (videoRef.current) videoRef.current.srcObject = null;
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
    start,
    stop,
    refreshDevices,
    pairedMobileDevices,
    accessCode: cloudcast?.session?.accessCode ?? '',
    sessionReady: Boolean(cloudcast?.session),
    isMobileSource: isMobile,
  };
}
