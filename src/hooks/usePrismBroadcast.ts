import { useCallback, useRef, useState } from 'react';
import type { StreamDestination } from '../types/streaming';
import { BroadcastRelayClient, startRelaySession } from '../lib/broadcast/relayClient';
import { pickRecorderMimeType } from '../lib/broadcast/pgmCaptureStream';
import { relayAuthToken, relayWsUrl } from '../lib/broadcast/relayProtocol';

export type PrismBroadcastStatus = 'idle' | 'connecting' | 'live' | 'error';

export function usePrismBroadcast() {
  const relayRef = useRef<BroadcastRelayClient | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [status, setStatus] = useState<PrismBroadcastStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const stopBroadcast = useCallback(async () => {
    setError(null);
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    recorderRef.current = null;

    const relay = relayRef.current;
    if (relay?.isOpen) {
      try {
        relay.sendJson({ type: 'stop' });
      } catch {
        /* ignore */
      }
      relay.close();
    }
    relayRef.current = null;
    setStatus('idle');
  }, []);

  const startBroadcast = useCallback(
    async (
      destinations: StreamDestination[],
      programStream: MediaStream | null,
    ): Promise<{ ok: boolean; message: string }> => {
      const relayUrl = relayWsUrl();
      if (!relayUrl) {
        return {
          ok: false,
          message: 'Broadcast relay not configured. Set VITE_BROADCAST_RELAY_WS in .env and run npm run broadcast-relay.',
        };
      }
      if (!programStream?.getVideoTracks().length) {
        return { ok: false, message: 'No program video. Enable camera and start the composite first.' };
      }
      if (destinations.length === 0) {
        return { ok: false, message: 'No enabled stream destinations. Add destinations in Profile or Video Mixer Stream panel.' };
      }

      const mimeType = pickRecorderMimeType();
      if (!mimeType) {
        return { ok: false, message: 'This browser cannot encode WebM for broadcast.' };
      }

      await stopBroadcast();
      setStatus('connecting');
      setError(null);

      try {
        const relay = await startRelaySession(
          relayUrl,
          destinations.map((d) => ({
            streamUrl: d.streamUrl,
            streamKey: d.streamKey,
            name: d.name,
          })),
          relayAuthToken(),
          {
            onRelayClose: () => {
              if (recorderRef.current?.state !== 'inactive') {
                try {
                  recorderRef.current?.stop();
                } catch {
                  /* ignore */
                }
              }
              recorderRef.current = null;
              relayRef.current = null;
              setStatus('error');
              setError('Broadcast relay disconnected.');
            },
          },
        );
        relayRef.current = relay;

        const recorder = new MediaRecorder(programStream, {
          mimeType,
          videoBitsPerSecond: 2_500_000,
          audioBitsPerSecond: 128_000,
        });

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && relay.isOpen) relay.sendChunk(e.data);
        };

        recorder.onerror = () => {
          setError('Encoder error.');
          setStatus('error');
        };

        recorder.start(1000);
        recorderRef.current = recorder;
        setStatus('live');

        const names = destinations.map((d) => d.name).join(', ');
        return {
          ok: true,
          message: `Streaming Regal Prism composite to ${destinations.length} destination(s): ${names}.`,
        };
      } catch (e) {
        await stopBroadcast();
        const message = e instanceof Error ? e.message : 'Failed to start stream.';
        setError(message);
        setStatus('error');
        return { ok: false, message };
      }
    },
    [stopBroadcast],
  );

  return {
    status,
    error,
    isBroadcasting: status === 'live',
    startBroadcast,
    stopBroadcast,
  };
}
