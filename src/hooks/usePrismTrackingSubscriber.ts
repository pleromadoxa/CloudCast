import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import {
  PRISM_TRACKING_REQUEST_EVENT,
  PRISM_TRACKING_SYNC_EVENT,
  resolvePrismTrackingChannelName,
  subscribePrismTrackingLocalSync,
  type PrismTrackingSyncPayload,
} from '../lib/prismTrackingSync';

/** Subscribe to Regal Prism Eye gyro updates on the desktop studio. */
export function usePrismTrackingSubscriber(
  sessionId: string | null | undefined,
  realtimeChannel: string | null | undefined,
  enabled: boolean,
  onUpdate: (yaw: number, pitch: number) => void,
) {
  const [connected, setConnected] = useState(false);
  const versionRef = useRef(0);
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabase>['channel']> | null>(null);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const applySync = useCallback((payload: PrismTrackingSyncPayload) => {
    if (payload.version <= versionRef.current) return;
    versionRef.current = payload.version;
    onUpdateRef.current(payload.yaw, payload.pitch);
    setConnected(true);
  }, []);

  const requestSync = useCallback(() => {
    void channelRef.current?.send({
      type: 'broadcast',
      event: PRISM_TRACKING_REQUEST_EVENT,
      payload: { at: Date.now() },
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    return subscribePrismTrackingLocalSync(applySync);
  }, [enabled, applySync]);

  useEffect(() => {
    if (!enabled || !sessionId || !isSupabaseConfigured()) {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
      setConnected(false);
      return;
    }

    const channelName = resolvePrismTrackingChannelName(sessionId, realtimeChannel);
    const channel = getSupabase().channel(channelName, {
      config: { broadcast: { ack: false, self: false } },
    });

    channel
      .on('broadcast', { event: PRISM_TRACKING_SYNC_EVENT }, ({ payload }) => {
        applySync(payload as PrismTrackingSyncPayload);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          requestSync();
          setTimeout(requestSync, 800);
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      setConnected(false);
    };
  }, [enabled, sessionId, realtimeChannel, applySync, requestSync]);

  return { connected };
}
