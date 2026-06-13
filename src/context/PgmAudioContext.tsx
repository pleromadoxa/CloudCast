import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { rampGainDown, rampGainUp } from '../lib/audioFade';
import { ensureAudioOutputReady, registerDashboardAudioContext } from '../lib/audioOutput';
import {
  acquireStreamSource,
  hasUsableAudio,
  releaseStreamSource,
} from '../lib/streamAudioHub';

interface PgmAudioContextValue {
  registerPgmPlaybackStream: (stream: MediaStream | null) => void;
  setPgmGain: (gain: number) => void;
  getBroadcastAudioStream: () => MediaStream | null;
  levels: { l: number; r: number };
}

const PgmAudioContext = createContext<PgmAudioContextValue | null>(null);

export function PgmAudioProvider({
  children,
  localPlayback = true,
}: {
  children: ReactNode;
  /** When false, PGM bus is meter/broadcast only (mixer engine drives speakers). */
  localPlayback?: boolean;
}) {
  const streamRef = useRef<MediaStream | null>(null);
  const trackListenersRef = useRef<{
    stream: MediaStream;
    onTrackChange: () => void;
  } | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const broadcastDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const gainValueRef = useRef(1);
  const trackChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [levels, setLevels] = useState({ l: 0, r: 0 });

  const localPlaybackRef = useRef(localPlayback);
  localPlaybackRef.current = localPlayback;

  const detachTrackListeners = useCallback(() => {
    const attached = trackListenersRef.current;
    if (!attached) return;
    attached.stream.removeEventListener('addtrack', attached.onTrackChange);
    attached.stream.removeEventListener('removetrack', attached.onTrackChange);
    trackListenersRef.current = null;
  }, []);

  const teardownGraph = useCallback(async () => {
    if (trackChangeTimerRef.current) {
      clearTimeout(trackChangeTimerRef.current);
      trackChangeTimerRef.current = null;
    }

    detachTrackListeners();

    const gain = gainRef.current;
    if (gain) {
      await rampGainDown(gain);
    }

    const ctx = ctxRef.current;
    const stream = streamRef.current;
    if (ctx && stream) {
      releaseStreamSource(ctx, stream);
    }
    try {
      analyserRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      gainRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    analyserRef.current = null;
    gainRef.current = null;
    broadcastDestRef.current = null;
  }, [detachTrackListeners]);

  const wireStream = useCallback(
    async (stream: MediaStream | null) => {
      await teardownGraph();
      streamRef.current = stream;

      if (!stream) return;

      await ensureAudioOutputReady();
      if (streamRef.current !== stream) return;

      try {
        if (!ctxRef.current || ctxRef.current.state === 'closed') {
          ctxRef.current = new AudioContext();
          registerDashboardAudioContext(ctxRef.current);
        }
        const ctx = ctxRef.current;
        if (typeof window !== 'undefined') {
          (window as Window & { __cloudcastPgmCtx?: AudioContext }).__cloudcastPgmCtx = ctx;
        }
        if (ctx.state === 'suspended') await ctx.resume();

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.72;
        analyserRef.current = analyser;

        const gain = ctx.createGain();
        gainRef.current = gain;

        const broadcastDest = ctx.createMediaStreamDestination();
        broadcastDestRef.current = broadcastDest;

        if (!hasUsableAudio(stream)) {
          detachTrackListeners();
          const onTrackChange = () => {
            if (trackChangeTimerRef.current) clearTimeout(trackChangeTimerRef.current);
            trackChangeTimerRef.current = setTimeout(() => {
              trackChangeTimerRef.current = null;
              void wireStream(streamRef.current);
            }, 150);
          };
          stream.addEventListener('addtrack', onTrackChange);
          stream.addEventListener('removetrack', onTrackChange);
          trackListenersRef.current = { stream, onTrackChange };
          return;
        }

        const source = acquireStreamSource(ctx, stream);
        if (!source) return;

        source.connect(analyser);
        analyser.connect(gain);
        if (localPlaybackRef.current) {
          gain.connect(ctx.destination);
        }
        gain.connect(broadcastDest);
        rampGainUp(gain, gainValueRef.current);

        detachTrackListeners();
        const onTrackChange = () => {
          if (trackChangeTimerRef.current) clearTimeout(trackChangeTimerRef.current);
          trackChangeTimerRef.current = setTimeout(() => {
            trackChangeTimerRef.current = null;
            void wireStream(streamRef.current);
          }, 150);
        };
        stream.addEventListener('addtrack', onTrackChange);
        stream.addEventListener('removetrack', onTrackChange);
        trackListenersRef.current = { stream, onTrackChange };
      } catch (err) {
        console.warn('[CloudCast] PGM audio bus wiring failed:', err);
      }
    },
    [teardownGraph, detachTrackListeners],
  );

  const registerPgmPlaybackStream = useCallback(
    (stream: MediaStream | null) => {
      streamRef.current = stream;
      void wireStream(stream);
    },
    [wireStream],
  );

  const setPgmGain = useCallback((gain: number) => {
    gainValueRef.current = Math.min(1, Math.max(0, gain));
    const node = gainRef.current;
    const ctx = ctxRef.current;
    if (!node || !ctx) return;

    const now = ctx.currentTime;
    try {
      node.gain.cancelScheduledValues(now);
      node.gain.setTargetAtTime(gainValueRef.current, now, 0.015);
    } catch {
      node.gain.value = gainValueRef.current;
    }

    if (gainValueRef.current > 0) {
      void ensureAudioOutputReady().then(() => ctx.resume());
    }
  }, []);

  const getBroadcastAudioStream = useCallback((): MediaStream | null => {
    return broadcastDestRef.current?.stream ?? null;
  }, []);

  useEffect(() => {
    let raf = 0;
    const freqData = new Uint8Array(2048);

    const tick = () => {
      const analyser = analyserRef.current;
      const stream = streamRef.current;
      const hasSignal = analyser && stream && hasUsableAudio(stream);

      if (hasSignal) {
        analyser.getByteFrequencyData(freqData);
        const mid = Math.floor(freqData.length / 2);
        let lSum = 0;
        let rSum = 0;
        for (let i = 0; i < mid; i++) lSum += freqData[i];
        for (let i = mid; i < freqData.length; i++) rSum += freqData[i];
        const l = Math.min(100, (lSum / mid / 255) * 160);
        const r = Math.min(100, (rSum / (freqData.length - mid) / 255) * 160);
        setLevels({ l, r });
      } else {
        setLevels((prev) => ({
          l: Math.max(0, prev.l - 4),
          r: Math.max(0, prev.r - 4),
        }));
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    const onUnlock = () => {
      void (async () => {
        const ctx = ctxRef.current;
        if (ctx && ctx.state === 'suspended') {
          try {
            await ctx.resume();
          } catch {
            /* ignore */
          }
        }
        await wireStream(streamRef.current);
      })();
    };
    window.addEventListener('cloudcast-audio-unlocked', onUnlock);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('cloudcast-audio-unlocked', onUnlock);
      teardownGraph();
      void ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, [teardownGraph, wireStream]);

  return (
    <PgmAudioContext.Provider
      value={{ registerPgmPlaybackStream, setPgmGain, getBroadcastAudioStream, levels }}
    >
      {children}
    </PgmAudioContext.Provider>
  );
}

export function usePgmAudioOptional() {
  return useContext(PgmAudioContext);
}

export function usePgmAudio() {
  const ctx = useContext(PgmAudioContext);
  if (!ctx) throw new Error('usePgmAudio must be used within PgmAudioProvider');
  return ctx;
}

/** Safe hook when provider may be absent (meters in deck). */
export function usePgmAudioLevels(): { l: number; r: number } {
  const ctx = useContext(PgmAudioContext);
  return ctx?.levels ?? { l: 0, r: 0 };
}
