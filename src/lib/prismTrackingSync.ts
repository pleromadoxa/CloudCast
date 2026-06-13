import { SESSION_CHANNEL_PREFIX, SIGNALING_EVENTS } from './constants';

/** Gyro tracking payload from Regal Prism Eye (phone) to desktop studio. */
export interface PrismTrackingSyncPayload {
  version: number;
  yaw: number;
  pitch: number;
  sentAt: string;
}

export const PRISM_TRACKING_BROADCAST_CHANNEL = 'cloudcast-prism-tracking';

export const PRISM_TRACKING_SYNC_EVENT = SIGNALING_EVENTS.PRISM_TRACKING_SYNC;

export const PRISM_TRACKING_REQUEST_EVENT = 'prism-tracking-request';

export function resolvePrismTrackingChannelName(sessionId: string, realtimeChannel?: string | null): string {
  if (realtimeChannel?.trim()) return realtimeChannel.trim();
  return `${SESSION_CHANNEL_PREFIX}${sessionId}`;
}

export function buildPrismTrackingSyncPayload(input: {
  version: number;
  yaw: number;
  pitch: number;
}): PrismTrackingSyncPayload {
  return {
    ...input,
    sentAt: new Date().toISOString(),
  };
}

export function postPrismTrackingLocalSync(payload: PrismTrackingSyncPayload): void {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const channel = new BroadcastChannel(PRISM_TRACKING_BROADCAST_CHANNEL);
    channel.postMessage(payload);
    channel.close();
  } catch {
    /* unsupported */
  }
}

export function subscribePrismTrackingLocalSync(
  onMessage: (payload: PrismTrackingSyncPayload) => void,
): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => undefined;
  const channel = new BroadcastChannel(PRISM_TRACKING_BROADCAST_CHANNEL);
  channel.onmessage = (event: MessageEvent<PrismTrackingSyncPayload>) => {
    if (event.data?.version != null) onMessage(event.data);
  };
  return () => channel.close();
}

export function buildPrismEyeUrl(accessCode: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/prism/eye?code=${encodeURIComponent(accessCode.trim().toUpperCase())}`;
}
