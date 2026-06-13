import { useState } from 'react';
import { usePgmOutputSubscriber } from '../lib/pgmOutputTransport';

/** Subscribe to the Video Mixer composite PGM output for program-feed replay buffering. */
export function useReplayPgmIngress(
  sessionId: string | null | undefined,
  realtimeChannel: string | null | undefined,
  enabled: boolean,
): MediaStream | null {
  const [pgmStream, setPgmStream] = useState<MediaStream | null>(null);

  usePgmOutputSubscriber({
    sessionId: sessionId ?? null,
    realtimeChannel,
    enabled: enabled && Boolean(sessionId),
    onStream: setPgmStream,
  });

  return pgmStream;
}
