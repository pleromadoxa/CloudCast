import { SESSION_CHANNEL_PREFIX } from './constants';

export const PGM_OUTPUT_REQUEST_EVENT = 'pgm-output-request';
export const PGM_OUTPUT_OFFER_EVENT = 'pgm-output-offer';
export const PGM_OUTPUT_ANSWER_EVENT = 'pgm-output-answer';
export const PGM_OUTPUT_ICE_EVENT = 'pgm-output-ice';

export function resolvePgmOutputChannelName(sessionId: string, realtimeChannel?: string | null): string {
  if (realtimeChannel?.trim()) return realtimeChannel.trim();
  return `${SESSION_CHANNEL_PREFIX}${sessionId}`;
}

export function buildMixerOutputUrl(accessCode: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/dashboard/output?code=${encodeURIComponent(accessCode.trim().toUpperCase())}`;
}
