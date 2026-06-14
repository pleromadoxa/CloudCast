import { useEffect, useRef } from 'react';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { removeRealtimeChannel } from '../lib/realtimeChannel';
import {
  buildVideoSessionSyncPayload,
  VIDEO_SYNC_EVENT,
  resolveVideoSyncChannelName,
  type VideoSessionSyncPayload,
} from '../lib/videoSessionSync';

export function useVideoSessionSyncPublisher(
  sessionId: string | null | undefined,
  realtimeChannel: string | null | undefined,
  payload: Omit<VideoSessionSyncPayload, 'sentAt' | 'version'> | null,
  enabled: boolean,
) {
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabase>['channel']> | null>(null);
  const versionRef = useRef(0);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const publish = useRef(() => {
    if (!payloadRef.current || !channelRef.current) return;
    const message = buildVideoSessionSyncPayload({
      ...payloadRef.current,
      version: ++versionRef.current,
    });
    void channelRef.current.send({
      type: 'broadcast',
      event: VIDEO_SYNC_EVENT,
      payload: message,
    });
  });

  useEffect(() => {
    if (!enabled || !sessionId || !isSupabaseConfigured()) {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
      return;
    }

    const channelName = resolveVideoSyncChannelName(sessionId, realtimeChannel);
    const channel = getSupabase().channel(channelName, {
      config: { broadcast: { ack: false, self: false } },
    });
    channel.subscribe();
    channelRef.current = channel;

    return () => {
      void removeRealtimeChannel(channel);
      channelRef.current = null;
    };
  }, [enabled, sessionId, realtimeChannel]);

  useEffect(() => {
    if (!enabled || !payload) return;
    publish.current();
  }, [
    enabled,
    payload?.operatorKey,
    payload?.pstDeviceId,
    payload?.pgmDeviceId,
    payload?.isOnAir,
    payload?.isRecording,
    payload?.transitionType,
    payload?.transitionProgress,
    payload?.inTransition,
    payload?.outputMode,
    payload?.activePanel,
    payload?.replayOnPgmLabel,
  ]);
}

export function useVideoSessionSyncSubscriber(
  sessionId: string | null | undefined,
  realtimeChannel: string | null | undefined,
  operatorKey: string,
  onPayload: (payload: VideoSessionSyncPayload) => void,
  enabled: boolean,
) {
  const onPayloadRef = useRef(onPayload);
  onPayloadRef.current = onPayload;

  useEffect(() => {
    if (!enabled || !sessionId || !isSupabaseConfigured()) return;

    const channelName = resolveVideoSyncChannelName(sessionId, realtimeChannel);
    const channel = getSupabase().channel(channelName, {
      config: { broadcast: { ack: false, self: false } },
    });

    channel
      .on('broadcast', { event: VIDEO_SYNC_EVENT }, ({ payload }: { payload: VideoSessionSyncPayload }) => {
        const row = payload as VideoSessionSyncPayload | undefined;
        if (!row || row.operatorKey === operatorKey) return;
        onPayloadRef.current(row);
      })
      .subscribe();

    return () => {
      void removeRealtimeChannel(channel);
    };
  }, [enabled, sessionId, realtimeChannel, operatorKey]);
}
