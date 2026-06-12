import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ensureAudioOutputReady } from '../lib/audioOutput';
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

export function PgmAudioProvider({ children }: { children: ReactNode }) {
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
  const [levels, setLevels] = useState({ l: 0, r: 0 });

  const detachTrackListeners = useCallback(() => {
    const attached = trackListenersRef.current;
    if (!attached) return;
    attached.stream.removeEventListener('addtrack', attached.onTrackChange);
    attached.stream.removeEventListener('removetrack', attached.onTrackChange);
    trackListenersRef.current = null;
  }, []);

  const teardownGraph = useCallback(() => {
    detachTrackListeners();
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
      teardownGraph();
      streamRef.current = stream;

      if (!stream || !hasUsableAudio(stream)) return;

      await ensureAudioOutputReady();
      if (streamRef.current !== stream) return;

      try {
        if (!ctxRef.current || ctxRef.current.state === 'closed') {
          ctxRef.current = new AudioContext();
        }
        const ctx = ctxRef.current;
        if (ctx.state === 'suspended') await ctx.resume();

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.72;
        analyserRef.current = analyser;

        const gain = ctx.createGain();
        gain.gain.value = gainValueRef.current;
        gainRef.current = gain;

        const broadcastDest = ctx.createMediaStreamDestination();
        broadcastDestRef.current = broadcastDest;

        const source = acquireStreamSource(ctx, stream);
        if (!source) return;

        source.connect(analyser);
        analyser.connect(gain);
        gain.connect(ctx.destination);
        gain.connect(broadcastDest);

        detachTrackListeners();
        const onTrackChange = () => {
          void wireStream(streamRef.current);
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
      if (streamRef.current === stream) return;
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
    return () => {
      cancelAnimationFrame(raf);
      teardownGraph();
      void ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, [teardownGraph]);

  return (
    <PgmAudioContext.Provider
      value={{ registerPgmPlaybackStream, setPgmGain, getBroadcastAudioStream, levels }}
    >
      {children}
    </PgmAudioContext.Provider>
  );
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
