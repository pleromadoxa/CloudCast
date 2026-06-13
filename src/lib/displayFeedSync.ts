import type { DisplayBackground, DisplaySlide } from '../types/displayFeed';
import { SESSION_CHANNEL_PREFIX, SIGNALING_EVENTS } from './constants';

/** Payload broadcast to congregation viewers (local + remote). */
export interface DisplayFeedSyncPayload {
  version: number;
  isLive: boolean;
  liveSlide: DisplaySlide | null;
  holdBackground: DisplayBackground;
  transition: 'cut' | 'fade';
  showCongregationClock: boolean;
  sentAt: string;
}

export const DISPLAY_FEED_BROADCAST_CHANNEL = 'cloudcast-display-feed';

export const DISPLAY_FEED_SYNC_EVENT = SIGNALING_EVENTS.DISPLAY_FEED_SYNC;

export const DISPLAY_FEED_REQUEST_EVENT = 'display-feed-request';

export function resolveDisplayFeedChannelName(sessionId: string, realtimeChannel?: string | null): string {
  if (realtimeChannel?.trim()) return realtimeChannel.trim();
  return `${SESSION_CHANNEL_PREFIX}${sessionId}`;
}

export function buildDisplayFeedSyncPayload(input: {
  version: number;
  isLive: boolean;
  liveSlide: DisplaySlide | null;
  holdBackground: DisplayBackground;
  transition: 'cut' | 'fade';
  showCongregationClock: boolean;
}): DisplayFeedSyncPayload {
  return {
    ...input,
    sentAt: new Date().toISOString(),
  };
}

/** Same-origin tab sync (operator + local congregation window). */
export function postDisplayFeedLocalSync(payload: DisplayFeedSyncPayload): void {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const channel = new BroadcastChannel(DISPLAY_FEED_BROADCAST_CHANNEL);
    channel.postMessage(payload);
    channel.close();
  } catch {
    /* unsupported */
  }
}

export function subscribeDisplayFeedLocalSync(
  onMessage: (payload: DisplayFeedSyncPayload) => void,
): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => undefined;
  const channel = new BroadcastChannel(DISPLAY_FEED_BROADCAST_CHANNEL);
  channel.onmessage = (event: MessageEvent<DisplayFeedSyncPayload>) => {
    if (event.data?.version != null) onMessage(event.data);
  };
  return () => channel.close();
}

export function buildCongregationViewUrl(accessCode: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/display/view?code=${encodeURIComponent(accessCode.trim().toUpperCase())}`;
}
