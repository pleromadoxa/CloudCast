import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Device } from '../types/device';
import {
  createHostUsbDevice,
  friendlyAudioInputLabel,
  hostUsbDeviceId,
  hostUsbMediaDeviceId,
  isHostUsbDevice,
} from '../lib/localUsbAudio';

const STORAGE_KEY = 'cloudcast-host-usb-inputs';

type StoredHostInput = {
  mediaDeviceId: string;
  label: string;
};

function readStoredInputs(): StoredHostInput[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredHostInput[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredInputs(inputs: StoredHostInput[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
  } catch {
    /* ignore */
  }
}

export function useLocalHostAudioInputs(maxInputs: number) {
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [localDevices, setLocalDevices] = useState<Device[]>([]);
  const [localStreams, setLocalStreams] = useState<Map<string, MediaStream>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const streamsRef = useRef<Map<string, MediaStream>>(new Map());
  const restoringRef = useRef(false);

  const stopStream = useCallback((deviceId: string) => {
    const stream = streamsRef.current.get(deviceId);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamsRef.current.delete(deviceId);
    }
    setLocalStreams(new Map(streamsRef.current));
  }, []);

  const refreshDeviceList = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setAvailableDevices([]);
      return [];
    }

    setScanning(true);
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((d) => d.kind === 'audioinput');
      setAvailableDevices(audioInputs);
      return audioInputs;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not list audio devices');
      return [];
    } finally {
      setScanning(false);
    }
  }, []);

  const captureInput = useCallback(
    async (mediaDeviceId: string, label?: string) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser does not support local USB audio capture');
        return null;
      }

      if (localDevices.length >= maxInputs) {
        setError(`USB input limit reached (${maxInputs} on your plan)`);
        return null;
      }

      const deviceId = hostUsbDeviceId(mediaDeviceId);
      if (streamsRef.current.has(deviceId)) {
        setError('That USB device is already added');
        return deviceId;
      }

      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: mediaDeviceId },
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
          video: false,
        });

        const resolvedLabel =
          label?.trim() ||
          availableDevices.find((d) => d.deviceId === mediaDeviceId)?.label ||
          'USB Microphone';

        streamsRef.current.set(deviceId, stream);
        setLocalStreams(new Map(streamsRef.current));

        const slotNumber = localDevices.length + 1;
        const device = createHostUsbDevice(mediaDeviceId, resolvedLabel, slotNumber);
        setLocalDevices((prev) => {
          const next = [...prev, device];
          writeStoredInputs(
            next.map((d) => ({
              mediaDeviceId: hostUsbMediaDeviceId(d.deviceId),
              label: d.label,
            })),
          );
          return next;
        });

        stream.getAudioTracks()[0]?.addEventListener('ended', () => {
          stopStream(deviceId);
          setLocalDevices((prev) => {
            const next = prev.filter((d) => d.deviceId !== deviceId);
            writeStoredInputs(
              next.map((d) => ({
                mediaDeviceId: hostUsbMediaDeviceId(d.deviceId),
                label: d.label,
              })),
            );
            return next;
          });
        });

        return deviceId;
      } catch (err) {
        const message =
          err instanceof Error && err.name === 'NotAllowedError'
            ? 'Microphone permission denied — allow access to add USB audio'
            : err instanceof Error
              ? err.message
              : 'Failed to add audio input';
        setError(message);
        return null;
      }
    },
    [availableDevices, localDevices.length, maxInputs, stopStream],
  );

  const removeInput = useCallback(
    (deviceId: string) => {
      if (!isHostUsbDevice(deviceId)) return;
      stopStream(deviceId);
      setLocalDevices((prev) => {
        const next = prev.filter((d) => d.deviceId !== deviceId);
        writeStoredInputs(
          next.map((d) => ({
            mediaDeviceId: hostUsbMediaDeviceId(d.deviceId),
            label: d.label,
          })),
        );
        return next;
      });
      setError(null);
    },
    [stopStream],
  );

  const addInput = useCallback(
    async (mediaDeviceId: string) => {
      if (!mediaDeviceId) {
        setError('Select a USB audio device first');
        return null;
      }
      return captureInput(mediaDeviceId);
    },
    [captureInput],
  );

  useEffect(() => {
    void refreshDeviceList();
    const onChange = () => {
      void refreshDeviceList();
    };
    navigator.mediaDevices?.addEventListener('devicechange', onChange);
    return () => navigator.mediaDevices?.removeEventListener('devicechange', onChange);
  }, [refreshDeviceList]);

  useEffect(() => {
    if (restoringRef.current) return;
    restoringRef.current = true;

    const restore = async () => {
      const stored = readStoredInputs();
      if (stored.length === 0) return;

      try {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch {
        /* permission may be granted later */
      }

      const listed = await refreshDeviceList();
      const listedIds = new Set(listed.map((d) => d.deviceId));

      for (const entry of stored.slice(0, maxInputs)) {
        if (!listedIds.has(entry.mediaDeviceId)) continue;
        await captureInput(entry.mediaDeviceId, entry.label);
      }
    };

    void restore();
  }, [captureInput, maxInputs, refreshDeviceList]);

  useEffect(() => {
    return () => {
      streamsRef.current.forEach((stream) => stream.getTracks().forEach((t) => t.stop()));
      streamsRef.current.clear();
    };
  }, []);

  const selectableDevices = useMemo(() => {
    const activeIds = new Set(localDevices.map((d) => hostUsbMediaDeviceId(d.deviceId)));
    return availableDevices.filter((d) => !activeIds.has(d.deviceId));
  }, [availableDevices, localDevices]);

  const deviceLabels = useMemo(
    () =>
      Object.fromEntries(
        availableDevices.map((d) => [d.deviceId, friendlyAudioInputLabel(d)]),
      ),
    [availableDevices],
  );

  return {
    localDevices,
    localStreams,
    availableDevices,
    selectableDevices,
    deviceLabels,
    error,
    scanning,
    addInput,
    removeInput,
    refreshDeviceList,
    atLimit: localDevices.length >= maxInputs,
  };
}
