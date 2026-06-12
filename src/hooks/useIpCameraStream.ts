import { useCallback, useEffect, useRef, useState } from 'react';
import { acquireIpCameraStream } from '../lib/ipCameraStreamPool';
import type { IpCameraConnectionState } from '../types/ipCamera';

export type { IpCameraConnectionState };

export interface UseIpCameraStreamOptions {
  url: string | null;
  enabled: boolean;
}

export interface UseIpCameraStreamResult {
  stream: MediaStream | null;
  connectionState: IpCameraConnectionState;
  error: string | null;
  reconnect: () => void;
}

export function useIpCameraStream({ url, enabled }: UseIpCameraStreamOptions): UseIpCameraStreamResult {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<IpCameraConnectionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const reconnectRef = useRef<() => void>(() => {});

  const reconnect = useCallback(() => {
    reconnectRef.current();
  }, []);

  useEffect(() => {
    if (!enabled || !url?.trim()) {
      setStream(null);
      setConnectionState('idle');
      setError(null);
      return;
    }

    const { release, reconnect: poolReconnect } = acquireIpCameraStream(url, (snap) => {
      setStream(snap.stream);
      setConnectionState(snap.connectionState);
      setError(snap.error);
    });
    reconnectRef.current = poolReconnect;

    return release;
  }, [url, enabled]);

  return { stream, connectionState, error, reconnect };
}
