import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConnectionMode } from '../types/plans';
import type { Device } from '../types/device';
import { isRealDevice } from '../types/device';
import { acquireWhepStream } from '../lib/whepStreamPool';

/** Regal Cloud WHEP playback streams for Replay ISO capture (Pro+). */
export function useReplayWhepIngress(
  devices: Device[],
  connectionMode: ConnectionMode,
  enabled: boolean,
) {
  const streamsRef = useRef(new Map<string, MediaStream>());
  const [tick, setTick] = useState(0);

  const useWhep = enabled && connectionMode !== 'mesh';

  useEffect(() => {
    if (!useWhep) {
      streamsRef.current.clear();
      return;
    }

    const activeIds = new Set<string>();
    const releases: (() => void)[] = [];

    for (const device of devices) {
      if (!isRealDevice(device) || !device.whepUrl?.trim()) continue;
      if (device.status === 'offline') continue;

      activeIds.add(device.deviceId);
      if (streamsRef.current.has(device.deviceId)) continue;

      const { release } = acquireWhepStream(device.deviceId, device.whepUrl, 'auto', (snap) => {
        if (snap.stream) {
          streamsRef.current.set(device.deviceId, snap.stream);
          setTick((n) => n + 1);
        }
      });
      releases.push(release);
    }

    for (const deviceId of [...streamsRef.current.keys()]) {
      if (!activeIds.has(deviceId)) {
        streamsRef.current.delete(deviceId);
      }
    }

    return () => {
      releases.forEach((release) => release());
      streamsRef.current.clear();
    };
  }, [devices, useWhep]);

  const getWhepStream = useCallback(
    (deviceId: string) => streamsRef.current.get(deviceId) ?? null,
    [tick],
  );

  return { getWhepStream, useWhep };
}
