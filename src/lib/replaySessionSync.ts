import { SESSION_CHANNEL_PREFIX, SIGNALING_EVENTS } from './constants';
import { resolveRealtimeChannelName } from './realtimeChannel';

export const REPLAY_SYNC_EVENT = SIGNALING_EVENTS.REPLAY_CONSOLE_SYNC;

export interface ReplaySessionSyncPayload {
  version: number;
  operatorKey: string;
  operatorLabel: string;
  activeBankIndex: number;
  markInSec: number | null;
  markOutSec: number | null;
  markTimecodeIn: string | null;
  markTimecodeOut: string | null;
  houseClockSmpte: string;
  rundownLabels: string[];
  pgmLabel: string | null;
  sentAt: string;
}

export function resolveReplaySyncChannelName(sessionId: string, realtimeChannel?: string | null): string {
  if (realtimeChannel?.trim()) return realtimeChannel.trim();
  return `${SESSION_CHANNEL_PREFIX}${sessionId}`;
}

export function buildReplaySessionSyncPayload(
  input: Omit<ReplaySessionSyncPayload, 'sentAt' | 'version'> & { version?: number },
): ReplaySessionSyncPayload {
  return {
    ...input,
    version: input.version ?? 1,
    sentAt: new Date().toISOString(),
  };
}

export { resolveRealtimeChannelName };
