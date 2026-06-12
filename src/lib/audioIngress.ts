import { useCallback, useEffect, useRef } from 'react';
import type { ConnectionMode } from '../types/plans';
import { acquireWhepStream } from './whepStreamPool';
import { isMeshStreamPresent } from './deviceConnection';
import type { Device } from '../types/device';
import { isRealDevice } from '../types/device';

type IngressCallbacks = {
  onStream: (deviceId: string, stream: MediaStream) => void;
  onConnecting: (deviceId: string) => void;
  onStreamLost: (deviceId: string) => void;
};

const releases = new Map<string, () => void>();
const connectedUrls = new Map<string, string>();

/** Connect a single device via WHEP (Regal Cloud ingest playback). */
export function connectAudioIngressWhep(
  deviceId: string,
  whepUrl: string,
  callbacks: IngressCallbacks,
): () => void {
  releases.get(deviceId)?.();

  const { release } = acquireWhepStream(deviceId, whepUrl, 'auto', (snap) => {
    if (snap.stream) {
      callbacks.onStream(deviceId, snap.stream);
      return;
    }
    if (
      snap.connectionState === 'connecting' ||
      snap.connectionState === 'reconnecting' ||
      snap.connectionState === 'idle'
    ) {
      callbacks.onConnecting(deviceId);
      return;
    }
    if (snap.connectionState === 'failed' || snap.connectionState === 'disconnected') {
      callbacks.onStreamLost(deviceId);
    }
  });

  releases.set(deviceId, release);
  connectedUrls.set(deviceId, whepUrl);
  return release;
}

export function releaseAudioIngressWhep(deviceId: string): void {
  releases.get(deviceId)?.();
  releases.delete(deviceId);
  connectedUrls.delete(deviceId);
}

export function releaseAllAudioIngressWhep(): void {
  releases.forEach((release) => release());
  releases.clear();
  connectedUrls.clear();
}

/**
 * For the audio mixer dashboard: acquire Regal Cloud WHEP playback streams
 * and publish them into the same stream map used by mesh P2P feeds.
 */
export function useAudioIngressStreams({
  enabled,
  connectionMode,
  devices,
  onStream,
  onConnecting,
  onStreamLost,
}: {
  enabled: boolean;
  connectionMode: ConnectionMode;
  devices: Device[];
  onStream: (deviceId: string, stream: MediaStream) => void;
  onConnecting: (deviceId: string) => void;
  onStreamLost: (deviceId: string) => void;
}) {
  const callbacksRef = useRef({ onStream, onConnecting, onStreamLost });
  callbacksRef.current = { onStream, onConnecting, onStreamLost };

  const useWhep = enabled && connectionMode !== 'mesh';

  const syncWhepDevices = useCallback(() => {
    if (!useWhep) {
      releaseAllAudioIngressWhep();
      return;
    }

    const activeIds = new Set<string>();

    for (const device of devices) {
      if (!isRealDevice(device) || !device.whepUrl) continue;
      if (device.status === 'offline') continue;

      activeIds.add(device.deviceId);

      if (releases.has(device.deviceId) && connectedUrls.get(device.deviceId) === device.whepUrl) {
        continue;
      }

      connectAudioIngressWhep(device.deviceId, device.whepUrl, {
        onStream: (id, stream) => callbacksRef.current.onStream(id, stream),
        onConnecting: (id) => callbacksRef.current.onConnecting(id),
        onStreamLost: (id) => callbacksRef.current.onStreamLost(id),
      });
    }

    for (const deviceId of [...releases.keys()]) {
      if (!activeIds.has(deviceId)) {
        releaseAudioIngressWhep(deviceId);
        callbacksRef.current.onStreamLost(deviceId);
      }
    }
  }, [devices, useWhep]);

  useEffect(() => {
    syncWhepDevices();
  }, [syncWhepDevices]);

  useEffect(() => {
    if (!useWhep) return;
    return () => releaseAllAudioIngressWhep();
  }, [useWhep]);

  return { useWhep, isStreamPresent: isMeshStreamPresent };
}
