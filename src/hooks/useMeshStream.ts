import { useEffect, useRef, useState } from 'react';
import { useCloudCast } from '../context/CloudCastContext';
import { isMeshStreamActive } from '../lib/deviceConnection';
import type { ConnectionMode } from '../types/plans';

export interface UseMeshStreamResult {
  stream: MediaStream | null;
  connectionState: RTCPeerConnectionState | 'idle';
}

export function useMeshStream(deviceId: string, enabled: boolean, _mode: ConnectionMode): UseMeshStreamResult {
  const { meshStreams } = useCloudCast();
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState | 'idle'>('idle');
  const streamRef = useRef<MediaStream | null>(null);

  const stream =
    enabled ? meshStreams.get(deviceId) ?? null : null;

  useEffect(() => {
    if (stream) {
      streamRef.current = stream;
      setConnectionState(isMeshStreamActive(stream) ? 'connected' : 'connecting');
    } else {
      streamRef.current = null;
      if (enabled) setConnectionState('connecting');
      else setConnectionState('idle');
    }
  }, [stream, enabled]);

  return { stream, connectionState };
}
