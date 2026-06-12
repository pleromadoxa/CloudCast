import { useCallback, useEffect, useRef, useState } from 'react';
import type { WhepConnectionState } from '../lib/whepClient';
import { acquireWhepStream } from '../lib/whepStreamPool';
import type { StreamQuality } from '../types/device';

export interface UseWhepStreamOptions {
  deviceId: string;
  whepUrl: string | null;
  enabled: boolean;
  quality?: StreamQuality;
}

export interface UseWhepStreamResult {
  stream: MediaStream | null;
  connectionState: WhepConnectionState;
  error: string | null;
  reconnect: () => void;
}

export function useWhepStream({
  deviceId,
  whepUrl,
  enabled,
  quality = 'auto',
}: UseWhepStreamOptions): UseWhepStreamResult {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<WhepConnectionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const reconnectRef = useRef<() => void>(() => {});

  const reconnect = useCallback(() => {
    reconnectRef.current();
  }, []);

  useEffect(() => {
    if (!enabled || !whepUrl) {
      setStream(null);
      setConnectionState('idle');
      setError(null);
      return;
    }

    const { release, reconnect: poolReconnect } = acquireWhepStream(
      deviceId,
      whepUrl,
      quality,
      (snap) => {
        setStream(snap.stream);
        setConnectionState(snap.connectionState);
        setError(snap.error);
      },
    );
    reconnectRef.current = poolReconnect;

    return release;
  }, [deviceId, whepUrl, enabled, quality]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ deviceId: string }>).detail;
      if (detail?.deviceId === deviceId) reconnectRef.current();
    };
    window.addEventListener('cloudcast:reconnect', handler);
    return () => window.removeEventListener('cloudcast:reconnect', handler);
  }, [deviceId]);

  return { stream, connectionState, error, reconnect };
}
