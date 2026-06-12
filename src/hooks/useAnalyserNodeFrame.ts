import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnalyserFrame, AudioAnalyserLevels } from './useMediaStreamAnalyser';

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

/** Poll an existing AnalyserNode (post-DSP mixer taps). */
export function useAnalyserNodeFrame(analyser: AnalyserNode | null, enabled = true) {
  const frameRef = useRef<AnalyserFrame>(emptyFrame());
  const listenersRef = useRef(new Set<() => void>());
  const [levels, setLevels] = useState<AudioAnalyserLevels>({ l: 0, r: 0 });
  const lPeakRef = useRef(0);
  const rPeakRef = useRef(0);
  const meterTickRef = useRef(0);

  const subscribe = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => listenersRef.current.delete(listener);
  }, []);

  useEffect(() => {
    if (!enabled || !analyser) {
      frameRef.current = emptyFrame();
      setLevels({ l: 0, r: 0 });
      listenersRef.current.forEach((fn) => fn());
      return;
    }

    const freqData = new Uint8Array(analyser.frequencyBinCount);
    const timeData = new Uint8Array(analyser.fftSize);
    let raf = 0;

    const tick = () => {
      analyser.getByteFrequencyData(freqData);
      analyser.getByteTimeDomainData(timeData);

      const mid = Math.floor(freqData.length / 2);
      let lSum = 0;
      let rSum = 0;
      for (let i = 0; i < mid; i++) lSum += freqData[i];
      for (let i = mid; i < freqData.length; i++) rSum += freqData[i];
      const l = Math.min(100, (lSum / mid / 255) * 160);
      const r = Math.min(100, (rSum / (freqData.length - mid) / 255) * 160);

      lPeakRef.current = Math.max(l, lPeakRef.current * PEAK_DECAY);
      rPeakRef.current = Math.max(r, rPeakRef.current * PEAK_DECAY);

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

      frameRef.current = {
        l,
        r,
        lPeak: lPeakRef.current,
        rPeak: rPeakRef.current,
        spectrum,
        waveform,
        active: l > 0.5 || r > 0.5 || spectrum.some((v) => v > 0.03),
      };

      listenersRef.current.forEach((fn) => fn());

      meterTickRef.current += 1;
      if (meterTickRef.current % 4 === 0) {
        setLevels({ l, r });
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [analyser, enabled]);

  return { levels, frameRef, subscribe };
}
