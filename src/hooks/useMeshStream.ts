import { useEffect, useState } from 'react';
import { useCloudCast } from '../context/CloudCastContext';
import { isMeshStreamActive } from '../lib/deviceConnection';
import type { ConnectionMode } from '../types/plans';

export interface UseMeshStreamResult {
  stream: MediaStream | null;
  connectionState: RTCPeerConnectionState | 'idle';
}

export function useMeshStream(deviceId: string, enabled: boolean, _mode: ConnectionMode): UseMeshStreamResult {
  const { getMeshStream, meshStreamVersions } = useCloudCast();
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState | 'idle'>('idle');
  const streamRevision = meshStreamVersions.get(deviceId) ?? 0;

  const stream = enabled ? getMeshStream(deviceId) : null;

  useEffect(() => {
    if (stream) {
      setConnectionState(isMeshStreamActive(stream) ? 'connected' : 'connecting');
    } else {
      if (enabled) setConnectionState('connecting');
      else setConnectionState('idle');
    }
  }, [stream, enabled, streamRevision]);

  return { stream, connectionState };
}
