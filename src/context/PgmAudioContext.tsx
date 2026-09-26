import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
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
  registerPgmSupplementStream: (stream: MediaStream | null) => void;
  setPgmGain: (gain: number) => void;
  setPgmPrimaryGain: (gain: number) => void;
  setPgmSupplementGain: (gain: number) => void;
  getBroadcastAudioStream: () => MediaStream | null;
  levels: { l: number; r: number };
}

const PgmAudioContext = createContext<PgmAudioContextValue | null>(null);
const METER_UI_INTERVAL_MS = 80;

export function PgmAudioProvider({
  children,
  localPlayback = true,
}: {
  children: ReactNode;
  /** When false, PGM bus is meter/broadcast only (mixer engine drives speakers). */
  localPlayback?: boolean;
}) {
  const streamRef = useRef<MediaStream | null>(null);
  const supplementRef = useRef<MediaStream | null>(null);
  const trackListenersRef = useRef<{
    stream: MediaStream;
    onTrackChange: () => void;
  } | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const primaryGainRef = useRef<GainNode | null>(null);
  const supplementGainRef = useRef<GainNode | null>(null);
  const broadcastDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const gainValueRef = useRef(1);
  const primaryGainValueRef = useRef(1);
  const supplementGainValueRef = useRef(1);
  const trackChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [levels, setLevels] = useState({ l: 0, r: 0 });

  const localPlaybackRef = useRef(localPlayback);
  useEffect(() => {
    localPlaybackRef.current = localPlayback;
  }, [localPlayback]);

  const wireStreamRef = useRef<
    (primary: MediaStream | null, supplement: MediaStream | null) => Promise<void>
  >(async () => undefined);

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
    if (ctx) {
      if (streamRef.current) releaseStreamSource(ctx, streamRef.current);
      if (supplementRef.current) releaseStreamSource(ctx, supplementRef.current);
    }
    try {
      analyserRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      primaryGainRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      supplementGainRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    analyserRef.current = null;
    gainRef.current = null;
    primaryGainRef.current = null;
    supplementGainRef.current = null;
    broadcastDestRef.current = null;
  }, [detachTrackListeners]);

  const wireStream = useCallback(
    async (primary: MediaStream | null, supplement: MediaStream | null) => {
      await teardownGraph();
      streamRef.current = primary;
      supplementRef.current = supplement;

      const streams = [primary, supplement].filter(
        (s): s is MediaStream => Boolean(s && hasUsableAudio(s)),
      );
      const pending = [primary, supplement].filter(
        (s): s is MediaStream => Boolean(s && !hasUsableAudio(s)),
      );

      if (streams.length === 0) {
        if (pending.length > 0) {
          const waitStream = pending[0];
          detachTrackListeners();
          const onTrackChange = () => {
            if (trackChangeTimerRef.current) clearTimeout(trackChangeTimerRef.current);
            trackChangeTimerRef.current = setTimeout(() => {
              trackChangeTimerRef.current = null;
              void wireStreamRef.current(streamRef.current, supplementRef.current);
            }, 150);
          };
          waitStream.addEventListener('addtrack', onTrackChange);
          waitStream.addEventListener('removetrack', onTrackChange);
          trackListenersRef.current = { stream: waitStream, onTrackChange };
        }
        return;
      }

      await ensureAudioOutputReady();
      if (streamRef.current !== primary || supplementRef.current !== supplement) return;

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

        const mixGain = ctx.createGain();
        mixGain.gain.value = 1;
        mixGain.connect(analyser);

        const primaryGain = ctx.createGain();
        primaryGainRef.current = primaryGain;
        primaryGain.gain.value = primaryGainValueRef.current;
        primaryGain.connect(mixGain);

        const supplementGain = ctx.createGain();
        supplementGainRef.current = supplementGain;
        supplementGain.gain.value = supplementGainValueRef.current;
        supplementGain.connect(mixGain);

        analyser.connect(gain);
        if (localPlaybackRef.current) {
          gain.connect(ctx.destination);
        }
        gain.connect(broadcastDest);

        let wired = 0;
        if (primary && hasUsableAudio(primary)) {
          const source = acquireStreamSource(ctx, primary);
          if (source) {
            source.connect(primaryGain);
            wired += 1;
          }
        }
        if (supplement && hasUsableAudio(supplement)) {
          const source = acquireStreamSource(ctx, supplement);
          if (source) {
            source.connect(supplementGain);
            wired += 1;
          }
        }
        if (wired === 0) return;

        rampGainUp(gain, gainValueRef.current);

        const listenStream = primary ?? supplement;
        if (listenStream) {
          detachTrackListeners();
          const onTrackChange = () => {
            if (trackChangeTimerRef.current) clearTimeout(trackChangeTimerRef.current);
            trackChangeTimerRef.current = setTimeout(() => {
              trackChangeTimerRef.current = null;
              void wireStreamRef.current(streamRef.current, supplementRef.current);
            }, 150);
          };
          listenStream.addEventListener('addtrack', onTrackChange);
          listenStream.addEventListener('removetrack', onTrackChange);
          trackListenersRef.current = { stream: listenStream, onTrackChange };
        }
      } catch (err) {
        console.warn('[CloudCast] PGM audio bus wiring failed:', err);
      }
    },
    [teardownGraph, detachTrackListeners],
  );

  useEffect(() => {
    wireStreamRef.current = wireStream;
  }, [wireStream]);

  const registerPgmPlaybackStream = useCallback(
    (stream: MediaStream | null) => {
      streamRef.current = stream;
      void wireStream(stream, supplementRef.current);
    },
    [wireStream],
  );

  const registerPgmSupplementStream = useCallback(
    (stream: MediaStream | null) => {
      supplementRef.current = stream;
      void wireStream(streamRef.current, stream);
    },
    [wireStream],
  );

  const applyGain = useCallback((node: GainNode | null, valueRef: MutableRefObject<number>, gain: number) => {
    valueRef.current = Math.min(1, Math.max(0, gain));
    const ctx = ctxRef.current;
    if (!node || !ctx) return;
    const now = ctx.currentTime;
    try {
      node.gain.cancelScheduledValues(now);
      node.gain.setTargetAtTime(valueRef.current, now, 0.015);
    } catch {
      node.gain.value = valueRef.current;
    }
  }, []);

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

  const setPgmPrimaryGain = useCallback(
    (gain: number) => {
      applyGain(primaryGainRef.current, primaryGainValueRef, gain);
      if (gain > 0) void ensureAudioOutputReady().then(() => ctxRef.current?.resume());
    },
    [applyGain],
  );

  const setPgmSupplementGain = useCallback(
    (gain: number) => {
      applyGain(supplementGainRef.current, supplementGainValueRef, gain);
      if (gain > 0) void ensureAudioOutputReady().then(() => ctxRef.current?.resume());
    },
    [applyGain],
  );

  const getBroadcastAudioStream = useCallback((): MediaStream | null => {
    return broadcastDestRef.current?.stream ?? null;
  }, []);

  useEffect(() => {
    let raf = 0;
    let lastUiMs = 0;
    const freqData = new Uint8Array(2048);

    const tick = (now: number) => {
      const analyser = analyserRef.current;
      const stream = streamRef.current;
      const hasSignal =
        analyser &&
        stream &&
        (hasUsableAudio(stream) || (supplementRef.current && hasUsableAudio(supplementRef.current)));

      if (hasSignal) {
        analyser.getByteFrequencyData(freqData);
        const mid = Math.floor(freqData.length / 2);
        let lSum = 0;
        let rSum = 0;
        for (let i = 0; i < mid; i++) lSum += freqData[i];
        for (let i = mid; i < freqData.length; i++) rSum += freqData[i];
        const l = Math.min(100, (lSum / mid / 255) * 160);
        const r = Math.min(100, (rSum / (freqData.length - mid) / 255) * 160);
        if (now - lastUiMs >= METER_UI_INTERVAL_MS) {
          lastUiMs = now;
          setLevels({ l, r });
        }
      } else if (now - lastUiMs >= METER_UI_INTERVAL_MS) {
        lastUiMs = now;
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
        await wireStream(streamRef.current, supplementRef.current);
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

  const providerValue = useMemo(
    () => ({
      registerPgmPlaybackStream,
      registerPgmSupplementStream,
      setPgmGain,
      setPgmPrimaryGain,
      setPgmSupplementGain,
      getBroadcastAudioStream,
      levels,
    }),
    [
      registerPgmPlaybackStream,
      registerPgmSupplementStream,
      setPgmGain,
      setPgmPrimaryGain,
      setPgmSupplementGain,
      getBroadcastAudioStream,
      levels,
    ],
  );

  return (
    <PgmAudioContext.Provider value={providerValue}>
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
