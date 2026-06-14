import { SESSION_CHANNEL_PREFIX, SIGNALING_EVENTS } from './constants';

export const VIDEO_SYNC_EVENT = SIGNALING_EVENTS.VIDEO_MIXER_SYNC;

export interface VideoSessionSyncPayload {
  version: number;
  operatorKey: string;
  operatorLabel: string;
  pstDeviceId: string | null;
  pstDeviceLabel: string | null;
  pgmDeviceId: string | null;
  pgmDeviceLabel: string | null;
  isOnAir: boolean;
  isRecording: boolean;
  transitionType: string;
  transitionProgress: number;
  inTransition: boolean;
  outputMode: string;
  activePanel: string;
  replayOnPgmLabel: string | null;
  sentAt: string;
}

export function resolveVideoSyncChannelName(sessionId: string, realtimeChannel?: string | null): string {
  if (realtimeChannel?.trim()) return realtimeChannel.trim();
  return `${SESSION_CHANNEL_PREFIX}${sessionId}`;
}

export function buildVideoSessionSyncPayload(
  input: Omit<VideoSessionSyncPayload, 'sentAt' | 'version'> & { version?: number },
): VideoSessionSyncPayload {
  return {
    ...input,
    version: input.version ?? 1,
    sentAt: new Date().toISOString(),
  };
}
