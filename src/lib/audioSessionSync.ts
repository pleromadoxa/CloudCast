import { SESSION_CHANNEL_PREFIX, SIGNALING_EVENTS } from './constants';

export const AUDIO_SYNC_EVENT = SIGNALING_EVENTS.AUDIO_CONSOLE_SYNC;

export interface AudioSessionSyncPayload {
  version: number;
  operatorKey: string;
  operatorLabel: string;
  selectedChannel: number;
  activeBank: string;
  masterVolume: number;
  masterMuted: boolean;
  monitorMuted: boolean;
  consoleEnabled: boolean;
  soloDeviceId: string | null;
  activeScene: string | null;
  bridgeConnected: boolean;
  rundownActive?: boolean;
  rundownStepIndex?: number | null;
  rundownTotal?: number;
  rundownScenes?: string[];
  rundownCurrentScene?: string | null;
  sentAt: string;
}

export function resolveAudioSyncChannelName(sessionId: string, realtimeChannel?: string | null): string {
  if (realtimeChannel?.trim()) return realtimeChannel.trim();
  return `${SESSION_CHANNEL_PREFIX}${sessionId}`;
}

export function buildAudioSessionSyncPayload(
  input: Omit<AudioSessionSyncPayload, 'sentAt' | 'version'> & { version?: number },
): AudioSessionSyncPayload {
  return {
    ...input,
    version: input.version ?? 1,
    sentAt: new Date().toISOString(),
  };
}
