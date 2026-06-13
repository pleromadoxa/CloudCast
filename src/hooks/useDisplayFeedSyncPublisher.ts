import { useEffect, useRef } from 'react';
import type { DisplayFeedState } from '../types/displayFeed';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import {
  buildDisplayFeedSyncPayload,
  DISPLAY_FEED_REQUEST_EVENT,
  DISPLAY_FEED_SYNC_EVENT,
  postDisplayFeedLocalSync,
  resolveDisplayFeedChannelName,
  type DisplayFeedSyncPayload,
} from '../lib/displayFeedSync';

/** Publish live Display Feed state to congregation viewers (BroadcastChannel + Realtime). */
export function useDisplayFeedSyncPublisher(
  state: DisplayFeedState,
  liveSlide: DisplayFeedState['slides'][number] | null,
  sessionId: string | null | undefined,
  realtimeChannel: string | null | undefined,
  enabled: boolean,
) {
  const versionRef = useRef(0);
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabase>['channel']> | null>(null);
  const stateRef = useRef({ state, liveSlide });
  stateRef.current = { state, liveSlide };

  const publish = useRef(() => {
    const { state: s, liveSlide: slide } = stateRef.current;
    const payload = buildDisplayFeedSyncPayload({
      version: ++versionRef.current,
      isLive: Boolean(s.liveSlideId),
      liveSlide: slide,
      holdBackground: s.holdBackground,
      transition: s.transition,
      showCongregationClock: s.showCongregationClock ?? false,
    });
    postDisplayFeedLocalSync(payload);
    void channelRef.current?.send({
      type: 'broadcast',
      event: DISPLAY_FEED_SYNC_EVENT,
      payload,
    });
  });

  useEffect(() => {
    publish.current = () => {
      const { state: s, liveSlide: slide } = stateRef.current;
      const payload = buildDisplayFeedSyncPayload({
        version: ++versionRef.current,
        isLive: Boolean(s.liveSlideId),
        liveSlide: slide,
        holdBackground: s.holdBackground,
        transition: s.transition,
        showCongregationClock: s.showCongregationClock ?? false,
      });
      postDisplayFeedLocalSync(payload);
      void channelRef.current?.send({
        type: 'broadcast',
        event: DISPLAY_FEED_SYNC_EVENT,
        payload,
      });
    };
  });

  useEffect(() => {
    if (!enabled || !sessionId || !isSupabaseConfigured()) {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
      return;
    }

    const channelName = resolveDisplayFeedChannelName(sessionId, realtimeChannel);
    const channel = getSupabase().channel(channelName, {
      config: { broadcast: { ack: false, self: false } },
    });

    channel
      .on('broadcast', { event: DISPLAY_FEED_REQUEST_EVENT }, () => {
        publish.current();
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [enabled, sessionId, realtimeChannel]);

  useEffect(() => {
    if (!enabled) return;
    publish.current();
  }, [
    enabled,
    state.liveSlideId,
    state.holdBackground,
    state.transition,
    state.showCongregationClock,
    liveSlide?.updatedAt,
    liveSlide?.id,
    JSON.stringify(liveSlide?.fields),
  ]);

  useEffect(() => {
    if (!enabled || !state.liveSlideId) return;
    const interval = setInterval(() => publish.current(), 3000);
    return () => clearInterval(interval);
  }, [enabled, state.liveSlideId]);
}

export type { DisplayFeedSyncPayload };
