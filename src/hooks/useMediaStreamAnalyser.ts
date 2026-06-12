import { useCallback, useEffect, useRef, useState } from 'react';
import {
  acquireStreamSource,
  hasUsableAudio,
  releaseStreamSource,
} from '../lib/streamAudioHub';

export interface AudioAnalyserLevels {
  l: number;
  r: number;
}

export interface AnalyserFrame {
  l: number;
  r: number;
  lPeak: number;
  rPeak: number;
  /** 48 normalized frequency bands 0–1 */
  spectrum: number[];
  /** 96 time-domain samples 0–1 */
  waveform: number[];
  active: boolean;
}

const SPECTRUM_BANDS = 48;
const WAVEFORM_SAMPLES = 96;
const PEAK_DECAY = 0.92;

const emptyFrame = (): AnalyserFrame => ({
  l: 0,
  r: 0,
  lPeak: 0,
  rPeak: 0,
  spectrum: Array(SPECTRUM_BANDS).fill(0),
  waveform: Array(WAVEFORM_SAMPLES).fill(0.5),
  active: false,
});

let sharedAudioContext: AudioContext | null = null;

function getSharedAudioContext(): AudioContext {
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new AudioContext();
  }
  if (sharedAudioContext.state === 'suspended') void sharedAudioContext.resume();
  return sharedAudioContext;
}

type SharedAnalyserEntry = {
  stream: MediaStream;
  consumers: number;
  frameRef: { current: AnalyserFrame };
  listeners: Set<() => void>;
  levels: AudioAnalyserLevels;
  levelListeners: Set<(levels: AudioAnalyserLevels) => void>;
  raf: number;
  analyser: AnalyserNode;
  lPeak: number;
  rPeak: number;
  meterTick: number;
};

const analyserCache = new Map<string, SharedAnalyserEntry>();

function notifyFrame(entry: SharedAnalyserEntry) {
  entry.listeners.forEach((fn) => fn());
}

function notifyLevels(entry: SharedAnalyserEntry) {
  entry.levelListeners.forEach((fn) => fn(entry.levels));
}

function startAnalyserLoop(entry: SharedAnalyserEntry) {
  const { analyser, stream } = entry;
  const freqData = new Uint8Array(analyser.frequencyBinCount);
  const timeData = new Uint8Array(analyser.fftSize);

  const tick = () => {
    if (!analyserCache.has(stream.id) || analyserCache.get(stream.id) !== entry) return;

    if (!hasUsableAudio(stream)) {
      entry.frameRef.current = emptyFrame();
      entry.levels = { l: 0, r: 0 };
      notifyFrame(entry);
      notifyLevels(entry);
      entry.raf = requestAnimationFrame(tick);
      return;
    }

    analyser.getByteFrequencyData(freqData);
    analyser.getByteTimeDomainData(timeData);

    const mid = Math.floor(freqData.length / 2);
    let lSum = 0;
    let rSum = 0;
    for (let i = 0; i < mid; i++) lSum += freqData[i];
    for (let i = mid; i < freqData.length; i++) rSum += freqData[i];
    const l = Math.min(100, (lSum / mid / 255) * 160);
    const r = Math.min(100, (rSum / (freqData.length - mid) / 255) * 160);

    entry.lPeak = Math.max(l, entry.lPeak * PEAK_DECAY);
    entry.rPeak = Math.max(r, entry.rPeak * PEAK_DECAY);

    const spectrum: number[] = [];
    const bandSize = Math.max(1, Math.floor(freqData.length / SPECTRUM_BANDS));
    for (let b = 0; b < SPECTRUM_BANDS; b++) {
      let sum = 0;
      const start = b * bandSize;
      for (let i = start; i < start + bandSize && i < freqData.length; i++) {
        sum += freqData[i];
      }
      spectrum.push(Math.min(1, (sum / bandSize / 255) * 1.35));
    }

    const waveform: number[] = [];
    const step = Math.max(1, Math.floor(timeData.length / WAVEFORM_SAMPLES));
    for (let i = 0; i < WAVEFORM_SAMPLES; i++) {
      waveform.push(timeData[i * step] / 255);
    }

    entry.frameRef.current = {
      l,
      r,
      lPeak: entry.lPeak,
      rPeak: entry.rPeak,
      spectrum,
      waveform,
      active: l > 0.5 || r > 0.5 || spectrum.some((v) => v > 0.03),
    };

    notifyFrame(entry);

    entry.meterTick += 1;
    if (entry.meterTick % 4 === 0) {
      entry.levels = { l, r };
      notifyLevels(entry);
    }

    entry.raf = requestAnimationFrame(tick);
  };

  entry.raf = requestAnimationFrame(tick);
}

function acquireSharedAnalyser(stream: MediaStream): SharedAnalyserEntry | null {
  const key = stream.id;
  const existing = analyserCache.get(key);
  if (existing) {
    existing.consumers += 1;
    return existing;
  }

  const ctx = getSharedAudioContext();
  const source = acquireStreamSource(ctx, stream);
  if (!source) return null;

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.78;
  source.connect(analyser);

  const entry: SharedAnalyserEntry = {
    stream,
    consumers: 1,
    frameRef: { current: emptyFrame() },
    listeners: new Set(),
    levels: { l: 0, r: 0 },
    levelListeners: new Set(),
    raf: 0,
    analyser,
    lPeak: 0,
    rPeak: 0,
    meterTick: 0,
  };

  analyserCache.set(key, entry);
  startAnalyserLoop(entry);
  return entry;
}

function releaseSharedAnalyser(stream: MediaStream): void {
  const key = stream.id;
  const entry = analyserCache.get(key);
  if (!entry) return;

  entry.consumers -= 1;
  if (entry.consumers > 0) return;

  cancelAnimationFrame(entry.raf);
  try {
    entry.analyser.disconnect();
  } catch {
    /* ignore */
  }
  releaseStreamSource(getSharedAudioContext(), stream);
  analyserCache.delete(key);
}

export function useMediaStreamAnalyser(stream: MediaStream | null, enabled = true) {
  const frameRef = useRef<AnalyserFrame>(emptyFrame());
  const listenersRef = useRef(new Set<() => void>());
  const [levels, setLevels] = useState<AudioAnalyserLevels>({ l: 0, r: 0 });
  const entryRef = useRef<SharedAnalyserEntry | null>(null);

  const subscribe = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !stream || !hasUsableAudio(stream)) {
      frameRef.current = emptyFrame();
      setLevels({ l: 0, r: 0 });
      listenersRef.current.forEach((fn) => fn());
      return;
    }

    const entry = acquireSharedAnalyser(stream);
    if (!entry) {
      frameRef.current = emptyFrame();
      setLevels({ l: 0, r: 0 });
      listenersRef.current.forEach((fn) => fn());
      return;
    }

    entryRef.current = entry;

    const onFrame = () => {
      frameRef.current = entry.frameRef.current;
      listenersRef.current.forEach((fn) => fn());
    };

    const onLevels = (next: AudioAnalyserLevels) => {
      setLevels(next);
    };

    entry.listeners.add(onFrame);
    entry.levelListeners.add(onLevels);
    onFrame();
    onLevels(entry.levels);

    return () => {
      entry.listeners.delete(onFrame);
      entry.levelListeners.delete(onLevels);
      entryRef.current = null;
      releaseSharedAnalyser(stream);
      frameRef.current = emptyFrame();
      setLevels({ l: 0, r: 0 });
    };
  }, [stream, enabled]);

  return {
    levels,
    waveform: frameRef.current.waveform,
    frameRef,
    subscribe,
  };
}
