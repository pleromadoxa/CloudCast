import { useCallback, useEffect, useRef } from 'react';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import {
  buildPrismTrackingSyncPayload,
  PRISM_TRACKING_REQUEST_EVENT,
  PRISM_TRACKING_SYNC_EVENT,
  postPrismTrackingLocalSync,
  resolvePrismTrackingChannelName,
} from '../lib/prismTrackingSync';

const MIN_PUBLISH_INTERVAL_MS = 50;

/** Publish phone gyro tracking to the desktop Regal Prism studio. */
export function usePrismTrackingPublisher(
  sessionId: string | null | undefined,
  realtimeChannel: string | null | undefined,
  enabled: boolean,
) {
  const versionRef = useRef(0);
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabase>['channel']> | null>(null);
  const lastSentRef = useRef(0);
  const pendingRef = useRef<{ yaw: number; pitch: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  const flush = useCallback(() => {
    rafRef.current = null;
    const pending = pendingRef.current;
    if (!pending || !enabled) return;

    const now = Date.now();
    if (now - lastSentRef.current < MIN_PUBLISH_INTERVAL_MS) {
      rafRef.current = requestAnimationFrame(flush);
      return;
    }
    lastSentRef.current = now;

    const payload = buildPrismTrackingSyncPayload({
      version: ++versionRef.current,
      yaw: pending.yaw,
      pitch: pending.pitch,
    });
    postPrismTrackingLocalSync(payload);
    void channelRef.current?.send({
      type: 'broadcast',
      event: PRISM_TRACKING_SYNC_EVENT,
      payload,
    });
  }, [enabled]);

  const publish = useCallback(
    (yaw: number, pitch: number) => {
      if (!enabled) return;
      pendingRef.current = { yaw, pitch };
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(flush);
      }
    },
    [enabled, flush],
  );

  useEffect(() => {
    if (!enabled || !sessionId || !isSupabaseConfigured()) {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
      return;
    }

    const channelName = resolvePrismTrackingChannelName(sessionId, realtimeChannel);
    const channel = getSupabase().channel(channelName, {
      config: { broadcast: { ack: false, self: false } },
    });

    channel
      .on('broadcast', { event: PRISM_TRACKING_REQUEST_EVENT }, () => {
        if (pendingRef.current) flush();
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [enabled, sessionId, realtimeChannel, flush]);

  return publish;
}
