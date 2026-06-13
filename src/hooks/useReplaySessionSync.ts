import { useEffect, useRef } from 'react';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { removeRealtimeChannel } from '../lib/realtimeChannel';
import {
  buildReplaySessionSyncPayload,
  REPLAY_SYNC_EVENT,
  resolveReplaySyncChannelName,
  type ReplaySessionSyncPayload,
} from '../lib/replaySessionSync';

export function useReplaySessionSyncPublisher(
  sessionId: string | null | undefined,
  realtimeChannel: string | null | undefined,
  payload: Omit<ReplaySessionSyncPayload, 'sentAt' | 'version'> | null,
  enabled: boolean,
) {
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabase>['channel']> | null>(null);
  const versionRef = useRef(0);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const publish = useRef(() => {
    if (!payloadRef.current || !channelRef.current) return;
    const message = buildReplaySessionSyncPayload({
      ...payloadRef.current,
      version: ++versionRef.current,
    });
    void channelRef.current.send({
      type: 'broadcast',
      event: REPLAY_SYNC_EVENT,
      payload: message,
    });
  });

  useEffect(() => {
    if (!enabled || !sessionId || !isSupabaseConfigured()) {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
      return;
    }

    const channelName = resolveReplaySyncChannelName(sessionId, realtimeChannel);
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
    payload?.activeBankIndex,
    payload?.markInSec,
    payload?.markOutSec,
    payload?.markTimecodeIn,
    payload?.markTimecodeOut,
    payload?.houseClockSmpte,
    payload?.pgmLabel,
    JSON.stringify(payload?.rundownLabels),
  ]);
}

export function useReplaySessionSyncSubscriber(
  sessionId: string | null | undefined,
  realtimeChannel: string | null | undefined,
  operatorKey: string,
  onPayload: (payload: ReplaySessionSyncPayload) => void,
  enabled: boolean,
) {
  const onPayloadRef = useRef(onPayload);
  onPayloadRef.current = onPayload;

  useEffect(() => {
    if (!enabled || !sessionId || !isSupabaseConfigured()) return;

    const channelName = resolveReplaySyncChannelName(sessionId, realtimeChannel);
    const channel = getSupabase().channel(channelName, {
      config: { broadcast: { ack: false, self: false } },
    });

    channel
      .on('broadcast', { event: REPLAY_SYNC_EVENT }, ({ payload }: { payload: ReplaySessionSyncPayload }) => {
        const row = payload as ReplaySessionSyncPayload | undefined;
        if (!row || row.operatorKey === operatorKey) return;
        onPayloadRef.current(row);
      })
      .subscribe();

    return () => {
      void removeRealtimeChannel(channel);
    };
  }, [enabled, sessionId, realtimeChannel, operatorKey]);
}
