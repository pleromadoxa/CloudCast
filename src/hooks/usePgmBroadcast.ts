import { useCallback, useEffect, useRef, useState } from 'react';
import type { StreamDestination } from '../types/streaming';
import { BroadcastRelayClient, startRelaySession } from '../lib/broadcast/relayClient';
import {
  BROADCAST_MAX_BITRATE,
  BROADCAST_MIN_BITRATE,
  createPgmBroadcastCapture,
  pickInitialVideoBitrate,
  pickRecorderMimeType,
  type PgmBroadcastCapture,
} from '../lib/broadcast/pgmCaptureStream';
import { isPgmReadyForBroadcast, waitForPgmSignal, warmupCaptureStream } from '../lib/broadcast/pgmProgramCapture';
import { relayAuthToken, relayUrlProblem, relayWsUrl } from '../lib/broadcast/relayProtocol';

export type BroadcastStatus = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'error';

export interface PgmBroadcastSources {
  getOutputContainer: () => HTMLElement | null;
  getAudioVideo: () => HTMLVideoElement | null;
  getBroadcastAudioStream?: () => MediaStream | null;
  getFadeToBlackLevel?: () => number;
}

// Adaptive bitrate tuning — keeps the live stream smooth when the uplink degrades.
const ADAPT_INTERVAL_MS = 2_000;
const ADAPT_BUFFER_HIGH = 1_500_000;
const ADAPT_BUFFER_LOW = 250_000;
const ADAPT_DOWN_COOLDOWN_MS = 6_000;
const ADAPT_UP_COOLDOWN_MS = 12_000;
const ADAPT_UP_STREAK = 5;
const RECORDER_TIMESLICE_MS = 500;
const FIRST_CHUNK_TIMEOUT_MS = 18_000;
const TRANSMISSION_STALL_MS = 6_000;
const ENCODER_RESTART_GRACE_MS = 4_000;
const FULL_RECONNECT_STALL_MS = 14_000;
const TRANSMITTING_WINDOW_MS = 4_000;

function waitAnimationFrames(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'undefined') {
      setTimeout(resolve, 32);
      return;
    }
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function waitForFirstChunk(
  getLastChunkAt: () => number,
  recorderStartedAt: number,
  timeoutMs: number,
  getEncoderChunkAt: () => number,
  isCancelled: () => boolean,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (isCancelled()) {
        reject(new Error('Broadcast start cancelled.'));
        return;
      }
      if (getLastChunkAt() >= recorderStartedAt) {
        resolve();
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        if (getEncoderChunkAt() >= recorderStartedAt) {
          reject(
            new Error(
              'PGM encoder is running but video is not reaching the broadcast relay. Check your relay connection and try again.',
            ),
          );
        } else {
          reject(new Error('No program video reached the broadcast relay. Check PGM and try again.'));
        }
        return;
      }
      setTimeout(tick, 150);
    };
    tick();
  });
}

export function usePgmBroadcast() {
  const relayRef = useRef<BroadcastRelayClient | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const captureRef = useRef<PgmBroadcastCapture | null>(null);
  const mimeTypeRef = useRef<string>('');
  const adaptiveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transmissionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentBitrateRef = useRef<number>(BROADCAST_MAX_BITRATE);
  const targetBitrateRef = useRef<number>(BROADCAST_MAX_BITRATE);
  const lastBitrateChangeRef = useRef<number>(0);
  const lastChunkAtRef = useRef<number>(0);
  const lastEncoderChunkAtRef = useRef<number>(0);
  const recorderStartedAtRef = useRef<number>(0);
  const lastEncoderRestartRef = useRef<number>(0);
  const lowStreakRef = useRef<number>(0);
  const startGenerationRef = useRef(0);
  const [status, setStatus] = useState<BroadcastStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isTransmitting, setIsTransmitting] = useState(false);

  const markChunkSent = useCallback(() => {
    lastChunkAtRef.current = Date.now();
    setIsTransmitting(true);
  }, []);

  const stopAdaptiveMonitor = useCallback(() => {
    if (adaptiveTimerRef.current) {
      clearInterval(adaptiveTimerRef.current);
      adaptiveTimerRef.current = null;
    }
  }, []);

  const stopTransmissionWatchdog = useCallback(() => {
    if (transmissionTimerRef.current) {
      clearInterval(transmissionTimerRef.current);
      transmissionTimerRef.current = null;
    }
    setIsTransmitting(false);
  }, []);

  const detachRelay = useCallback(
    (nextStatus: BroadcastStatus, message: string | null) => {
      stopAdaptiveMonitor();
      stopTransmissionWatchdog();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        try {
          recorder.ondataavailable = null;
          recorder.onerror = null;
          recorder.stop();
        } catch {
          /* ignore */
        }
      }
      recorderRef.current = null;
      const relay = relayRef.current;
      if (relay?.isOpen) {
        try {
          relay.close();
        } catch {
          /* ignore */
        }
      }
      relayRef.current = null;
      setError(message);
      setStatus(nextStatus);
    },
    [stopAdaptiveMonitor, stopTransmissionWatchdog],
  );

  const buildRecorder = useCallback(
    (bitrate: number): MediaRecorder | null => {
      const capture = captureRef.current;
      const relay = relayRef.current;
      const mimeType = mimeTypeRef.current;
      if (!capture || !relay || !mimeType) return null;

      const recorder = new MediaRecorder(capture.stream, {
        mimeType,
        videoBitsPerSecond: bitrate,
        audioBitsPerSecond: 128_000,
      });
      recorder.ondataavailable = (e) => {
        if (e.data.size <= 0) return;
        lastEncoderChunkAtRef.current = Date.now();
        const activeRelay = relayRef.current;
        if (activeRelay?.isOpen) {
          activeRelay.sendChunk(e.data);
          markChunkSent();
        }
      };
      recorder.onerror = () => {
        setError('PGM encoder error — reconnecting…');
        detachRelay('reconnecting', 'PGM encoder error — reconnecting…');
      };
      recorderStartedAtRef.current = Date.now();
      recorder.start(RECORDER_TIMESLICE_MS);
      currentBitrateRef.current = bitrate;
      return recorder;
    },
    [detachRelay, markChunkSent],
  );

  const restartRecorderAt = useCallback(
    (bitrate: number) => {
      const old = recorderRef.current;
      if (old && old.state !== 'inactive') {
        try {
          old.ondataavailable = null;
          old.onerror = null;
          old.stop();
        } catch {
          /* ignore */
        }
      }
      recorderRef.current = buildRecorder(bitrate);
      lastBitrateChangeRef.current = Date.now();
      lastEncoderRestartRef.current = Date.now();
    },
    [buildRecorder],
  );

  const startAdaptiveMonitor = useCallback(() => {
    stopAdaptiveMonitor();
    lowStreakRef.current = 0;
    lastBitrateChangeRef.current = Date.now();
    adaptiveTimerRef.current = setInterval(() => {
      const relay = relayRef.current;
      if (!relay || !relay.isOpen) return;
      const buffered = relay.bufferedAmount;
      const now = Date.now();
      const current = currentBitrateRef.current;

      if (buffered > ADAPT_BUFFER_HIGH) {
        lowStreakRef.current = 0;
        if (now - lastBitrateChangeRef.current > ADAPT_DOWN_COOLDOWN_MS && current > BROADCAST_MIN_BITRATE) {
          const next = Math.max(BROADCAST_MIN_BITRATE, Math.round(current * 0.7));
          if (next < current * 0.95) restartRecorderAt(next);
        }
      } else if (buffered < ADAPT_BUFFER_LOW) {
        lowStreakRef.current += 1;
        if (
          lowStreakRef.current >= ADAPT_UP_STREAK &&
          now - lastBitrateChangeRef.current > ADAPT_UP_COOLDOWN_MS &&
          current < targetBitrateRef.current
        ) {
          const next = Math.min(targetBitrateRef.current, Math.round(current * 1.2));
          if (next > current * 1.05) {
            restartRecorderAt(next);
            lowStreakRef.current = 0;
          }
        }
      } else {
        lowStreakRef.current = 0;
      }
    }, ADAPT_INTERVAL_MS);
  }, [restartRecorderAt, stopAdaptiveMonitor]);

  const startTransmissionWatchdog = useCallback(() => {
    stopTransmissionWatchdog();
    transmissionTimerRef.current = setInterval(() => {
      const relay = relayRef.current;
      if (!relay?.isOpen) return;

      const now = Date.now();
      const sinceChunk = now - lastChunkAtRef.current;
      setIsTransmitting(sinceChunk < TRANSMITTING_WINDOW_MS);

      if (sinceChunk < TRANSMISSION_STALL_MS) return;

      if (
        sinceChunk < FULL_RECONNECT_STALL_MS &&
        now - lastEncoderRestartRef.current > ENCODER_RESTART_GRACE_MS
      ) {
        restartRecorderAt(currentBitrateRef.current);
        return;
      }

      setError('Broadcast stalled — reconnecting…');
      detachRelay('reconnecting', 'Broadcast stalled — reconnecting…');
    }, 2_000);
  }, [detachRelay, restartRecorderAt, stopTransmissionWatchdog]);

  const teardownPipeline = useCallback((nextStatus?: BroadcastStatus) => {
    stopAdaptiveMonitor();
    stopTransmissionWatchdog();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.ondataavailable = null;
        recorder.onerror = null;
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
    recorderRef.current = null;
    captureRef.current?.stop();
    captureRef.current = null;
    const relay = relayRef.current;
    if (relay) {
      try {
        if (relay.isOpen) relay.sendJson({ type: 'stop' });
      } catch {
        /* ignore */
      }
      relay.close();
    }
    relayRef.current = null;
    lastChunkAtRef.current = 0;
    lastEncoderChunkAtRef.current = 0;
    recorderStartedAtRef.current = 0;
    if (nextStatus) setStatus(nextStatus);
  }, [stopAdaptiveMonitor, stopTransmissionWatchdog]);

  const stopBroadcast = useCallback(async () => {
    startGenerationRef.current += 1;
    setError(null);
    teardownPipeline('idle');
  }, [teardownPipeline]);

  useEffect(() => {
    return () => {
      startGenerationRef.current += 1;
      teardownPipeline();
    };
  }, [teardownPipeline]);

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

      const relayProblem = relayUrlProblem();
      if (relayProblem) {
        return { ok: false, message: relayProblem };
      }

      if (destinations.length === 0) {
        return {
          ok: false,
          message: 'No enabled stream destinations. Save and enable at least one destination in Stream settings.',
        };
      }

      const generation = ++startGenerationRef.current;
      setStatus('connecting');
      setError(null);

      // Keep the hidden encode clone mounted (status stays connecting) for the whole start.
      await waitAnimationFrames();
      teardownPipeline();
      await waitAnimationFrames();

      if (generation !== startGenerationRef.current) {
        return { ok: false, message: 'Broadcast start cancelled.' };
      }

      const outputContainer = await waitForPgmSignal(sources.getOutputContainer);
      if (generation !== startGenerationRef.current) {
        return { ok: false, message: 'Broadcast start cancelled.' };
      }
      if (!isPgmReadyForBroadcast(outputContainer)) {
        setStatus('idle');
        return {
          ok: false,
          message:
            'PGM has no video signal. Put a live source on program (CUT/TAKE) and wait for video before going ON AIR.',
        };
      }

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
        setStatus('idle');
        return {
          ok: false,
          message:
            'PGM has no video signal. Put a live source on program (CUT/TAKE) and wait for video before going ON AIR.',
        };
      }

      const mimeType = pickRecorderMimeType();
      if (!mimeType) {
        capture.stop();
        setStatus('idle');
        return { ok: false, message: 'This browser cannot encode WebM for broadcast.' };
      }

      try {
        lastChunkAtRef.current = 0;
        lastEncoderChunkAtRef.current = 0;

        await warmupCaptureStream(capture.stream);

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
              if (generation !== startGenerationRef.current) return;
              detachRelay('reconnecting', 'Broadcast relay disconnected — reconnecting…');
            },
          },
        );
        if (generation !== startGenerationRef.current) {
          relay.close();
          capture.stop();
          return { ok: false, message: 'Broadcast start cancelled.' };
        }
        relayRef.current = relay;
        captureRef.current = capture;
        mimeTypeRef.current = mimeType;

        const initialBitrate = pickInitialVideoBitrate();
        targetBitrateRef.current = BROADCAST_MAX_BITRATE;
        const recorder = buildRecorder(initialBitrate);
        if (!recorder) {
          capture.stop();
          teardownPipeline('idle');
          return { ok: false, message: 'Could not start the PGM encoder.' };
        }
        recorderRef.current = recorder;

        await waitForFirstChunk(
          () => lastChunkAtRef.current,
          recorderStartedAtRef.current,
          FIRST_CHUNK_TIMEOUT_MS,
          () => lastEncoderChunkAtRef.current,
          () => generation !== startGenerationRef.current,
        );

        if (generation !== startGenerationRef.current) {
          teardownPipeline();
          return { ok: false, message: 'Broadcast start cancelled.' };
        }

        startAdaptiveMonitor();
        startTransmissionWatchdog();
        setStatus('live');
        setError(null);

        const names = destinations.map((d) => d.name).join(', ');
        return {
          ok: true,
          message: `Live on ${destinations.length} destination(s): ${names}.`,
        };
      } catch (e) {
        if (generation !== startGenerationRef.current) {
          return { ok: false, message: 'Broadcast start cancelled.' };
        }
        captureRef.current?.stop();
        captureRef.current = null;
        teardownPipeline();
        const message = e instanceof Error ? e.message : 'Failed to start broadcast.';
        setError(message);
        setStatus('error');
        return { ok: false, message };
      }
    },
    [
      buildRecorder,
      detachRelay,
      startAdaptiveMonitor,
      startTransmissionWatchdog,
      teardownPipeline,
    ],
  );

  const updateFadeToBlack = useCallback((level: number) => {
    captureRef.current?.setFadeToBlackLevel(level);
  }, []);

  return {
    status,
    error,
    isTransmitting,
    isBroadcasting: status === 'live' && isTransmitting,
    startBroadcast,
    stopBroadcast,
    updateFadeToBlack,
  };
};
