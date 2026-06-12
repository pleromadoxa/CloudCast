import { useCallback, useRef, useState } from 'react';
import type { StreamDestination } from '../types/streaming';
import { BroadcastRelayClient, startRelaySession } from '../lib/broadcast/relayClient';
import {
  createPgmBroadcastCapture,
  pickRecorderMimeType,
  type PgmBroadcastCapture,
} from '../lib/broadcast/pgmCaptureStream';
import { waitForPgmSignal } from '../lib/broadcast/pgmProgramCapture';
import { relayAuthToken, relayWsUrl } from '../lib/broadcast/relayProtocol';

export type BroadcastStatus = 'idle' | 'connecting' | 'live' | 'error';

export interface PgmBroadcastSources {
  getOutputContainer: () => HTMLElement | null;
  getAudioVideo: () => HTMLVideoElement | null;
  getBroadcastAudioStream?: () => MediaStream | null;
  getFadeToBlackLevel?: () => number;
}

export function usePgmBroadcast() {
  const relayRef = useRef<BroadcastRelayClient | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const captureRef = useRef<PgmBroadcastCapture | null>(null);
  const [status, setStatus] = useState<BroadcastStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const stopBroadcast = useCallback(async () => {
    setError(null);
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    recorderRef.current = null;

    captureRef.current?.stop();
    captureRef.current = null;

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
      sources: PgmBroadcastSources,
    ): Promise<{ ok: boolean; message: string }> => {
      const relayUrl = relayWsUrl();
      if (!relayUrl) {
        return {
          ok: false,
          message:
            'Broadcast relay not configured. Run `npm run broadcast-relay` and set VITE_BROADCAST_RELAY_WS=ws://localhost:8090 in .env',
        };
      }

      if (destinations.length === 0) {
        return {
          ok: false,
          message: 'No enabled stream destinations. Save and enable at least one destination in Stream settings.',
        };
      }

      const outputContainer = await waitForPgmSignal(sources.getOutputContainer);
      const audioVideo = sources.getAudioVideo();
      const fadeLevel = sources.getFadeToBlackLevel?.() ?? 0;

      const broadcastAudio = sources.getBroadcastAudioStream?.() ?? null;
      const capture = createPgmBroadcastCapture(
        outputContainer,
        audioVideo,
        fadeLevel,
        broadcastAudio,
      );
      if (!capture) {
        return {
          ok: false,
          message:
            'PGM has no video signal. Put a live source on program (CUT/TAKE) and wait for video before going ON AIR.',
        };
      }

      const mimeType = pickRecorderMimeType();
      if (!mimeType) {
        capture.stop();
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
              captureRef.current?.stop();
              captureRef.current = null;
              relayRef.current = null;
              setStatus('error');
              setError('Broadcast relay disconnected. Will retry when connection returns.');
            },
          },
        );
        relayRef.current = relay;
        captureRef.current = capture;

        const recorder = new MediaRecorder(capture.stream, {
          mimeType,
          videoBitsPerSecond: 2_500_000,
          audioBitsPerSecond: 128_000,
        });

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && relay.isOpen) relay.sendChunk(e.data);
        };

        recorder.onerror = () => {
          setError('PGM encoder error.');
          setStatus('error');
        };

        recorder.start(1000);
        recorderRef.current = recorder;
        setStatus('live');

        const names = destinations.map((d) => d.name).join(', ');
        return {
          ok: true,
          message: `Broadcasting program output to ${destinations.length} destination(s): ${names}.`,
        };
      } catch (e) {
        await stopBroadcast();
        const message = e instanceof Error ? e.message : 'Failed to start broadcast.';
        setError(message);
        setStatus('error');
        return { ok: false, message };
      }
    },
    [stopBroadcast],
  );

  const updateFadeToBlack = useCallback((level: number) => {
    captureRef.current?.setFadeToBlackLevel(level);
  }, []);

  return {
    status,
    error,
    isBroadcasting: status === 'live',
    startBroadcast,
    stopBroadcast,
    updateFadeToBlack,
  };
}
