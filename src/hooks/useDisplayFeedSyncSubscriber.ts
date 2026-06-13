import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { DisplayBackground, DisplaySlide } from '../types/displayFeed';
import { createDefaultBackground } from '../types/displayFeed';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { DISPLAY_FEED_REQUEST_EVENT } from '../lib/displayFeedSync';
import {
  DISPLAY_FEED_SYNC_EVENT,
  resolveDisplayFeedChannelName,
  subscribeDisplayFeedLocalSync,
  type DisplayFeedSyncPayload,
} from '../lib/displayFeedSync';

export interface CongregationDisplayState {
  isLive: boolean;
  liveSlide: DisplaySlide | null;
  holdBackground: DisplayBackground;
  transition: 'cut' | 'fade';
  showCongregationClock: boolean;
  lastSyncAt: string | null;
  connected: boolean;
}

const INITIAL: CongregationDisplayState = {
  isLive: false,
  liveSlide: null,
  holdBackground: createDefaultBackground(),
  transition: 'fade',
  showCongregationClock: false,
  lastSyncAt: null,
  connected: false,
};

function applyPayload(payload: DisplayFeedSyncPayload): CongregationDisplayState {
  return {
    isLive: payload.isLive,
    liveSlide: payload.liveSlide,
    holdBackground: payload.holdBackground,
    transition: payload.transition,
    showCongregationClock: payload.showCongregationClock ?? false,
    lastSyncAt: payload.sentAt,
    connected: true,
  };
}

/** Subscribe to Display Feed sync for congregation / remote viewers. */
export function useDisplayFeedSyncSubscriber(
  sessionId: string | null,
  realtimeChannel: string | null | undefined,
  enabled: boolean,
) {
  const [state, setState] = useState<CongregationDisplayState>(INITIAL);
  const versionRef = useRef(0);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const applySync = useCallback((payload: DisplayFeedSyncPayload) => {
    if (payload.version <= versionRef.current) return;
    versionRef.current = payload.version;
    setState(applyPayload(payload));
  }, []);

  const requestSync = useCallback(() => {
    void channelRef.current?.send({
      type: 'broadcast',
      event: DISPLAY_FEED_REQUEST_EVENT,
      payload: { at: Date.now() },
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    return subscribeDisplayFeedLocalSync(applySync);
  }, [enabled, applySync]);

  useEffect(() => {
    if (!enabled || !sessionId || !isSupabaseConfigured()) {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
      setState((prev) => ({ ...prev, connected: false }));
      return;
    }

    const channelName = resolveDisplayFeedChannelName(sessionId, realtimeChannel);
    const channel = getSupabase().channel(channelName, {
      config: { broadcast: { ack: false, self: false } },
    });

    channel
      .on('broadcast', { event: DISPLAY_FEED_SYNC_EVENT }, ({ payload }) => {
        applySync(payload as DisplayFeedSyncPayload);
      })
      .subscribe((status) => {
        const connected = status === 'SUBSCRIBED';
        setState((prev) => ({ ...prev, connected }));
        if (connected) {
          requestSync();
          setTimeout(requestSync, 800);
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [enabled, sessionId, realtimeChannel, applySync, requestSync]);

  return state;
}
