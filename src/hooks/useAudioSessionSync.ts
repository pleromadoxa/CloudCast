import { useEffect, useRef } from 'react';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { removeRealtimeChannel } from '../lib/realtimeChannel';
import {
  buildAudioSessionSyncPayload,
  AUDIO_SYNC_EVENT,
  resolveAudioSyncChannelName,
  type AudioSessionSyncPayload,
} from '../lib/audioSessionSync';

export function useAudioSessionSyncPublisher(
  sessionId: string | null | undefined,
  realtimeChannel: string | null | undefined,
  payload: Omit<AudioSessionSyncPayload, 'sentAt' | 'version'> | null,
  enabled: boolean,
) {
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabase>['channel']> | null>(null);
  const versionRef = useRef(0);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const publish = useRef(() => {
    if (!payloadRef.current || !channelRef.current) return;
    const message = buildAudioSessionSyncPayload({
      ...payloadRef.current,
      version: ++versionRef.current,
    });
    void channelRef.current.send({
      type: 'broadcast',
      event: AUDIO_SYNC_EVENT,
      payload: message,
    });
  });

  useEffect(() => {
    if (!enabled || !sessionId || !isSupabaseConfigured()) {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
      return;
    }

    const channelName = resolveAudioSyncChannelName(sessionId, realtimeChannel);
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
    payload?.selectedChannel,
    payload?.activeBank,
    payload?.masterVolume,
    payload?.masterMuted,
    payload?.monitorMuted,
    payload?.consoleEnabled,
    payload?.soloDeviceId,
    payload?.activeScene,
    payload?.bridgeConnected,
    payload?.rundownActive,
    payload?.rundownStepIndex,
    payload?.rundownTotal,
    payload?.rundownCurrentScene,
    payload?.rundownScenes?.join(','),
  ]);
}

export function useAudioSessionSyncSubscriber(
  sessionId: string | null | undefined,
  realtimeChannel: string | null | undefined,
  operatorKey: string,
  onPayload: (payload: AudioSessionSyncPayload) => void,
  enabled: boolean,
) {
  const onPayloadRef = useRef(onPayload);
  onPayloadRef.current = onPayload;

  useEffect(() => {
    if (!enabled || !sessionId || !isSupabaseConfigured()) return;

    const channelName = resolveAudioSyncChannelName(sessionId, realtimeChannel);
    const channel = getSupabase().channel(channelName, {
      config: { broadcast: { ack: false, self: false } },
    });

    channel
      .on('broadcast', { event: AUDIO_SYNC_EVENT }, ({ payload }: { payload: AudioSessionSyncPayload }) => {
        const row = payload as AudioSessionSyncPayload | undefined;
        if (!row || row.operatorKey === operatorKey) return;
        onPayloadRef.current(row);
      })
      .subscribe();

    return () => {
      void removeRealtimeChannel(channel);
    };
  }, [enabled, sessionId, realtimeChannel, operatorKey]);
}
