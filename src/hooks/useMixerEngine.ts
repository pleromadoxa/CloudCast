import { useCallback, useEffect, useRef, useState } from 'react';
import type { TransitionType } from '../types/mixer';

interface UseMixerEngineOptions {
  transitionType: TransitionType;
  durationMs: number;
  onComplete: () => void;
}

export function useMixerEngine({ transitionType, durationMs, onComplete }: UseMixerEngineOptions) {
  const [progress, setProgress] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [fadeToBlackLevel, setFadeToBlackLevel] = useState(0);
  const rafRef = useRef<number>(0);
  const progressRef = useRef(0);
  const fadeRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const cancelAnimation = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    setIsAnimating(false);
  }, []);

  const animateTo = useCallback(
    (target: number, onDone?: () => void) => {
      cancelAnimation();
      setIsAnimating(true);
      const start = performance.now();
      const from = progressRef.current;

      const tick = (now: number) => {
        const elapsed = now - start;
        const t = Math.min(elapsed / durationMs, 1);
        const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
        const current = from + (target - from) * eased;
        progressRef.current = current;
        setProgress(current);

        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          progressRef.current = target;
          setProgress(target);
          setIsAnimating(false);
          onDone?.();
          if (target >= 100) {
            onCompleteRef.current();
            progressRef.current = 0;
            setProgress(0);
          }
        }
      };

      rafRef.current = requestAnimationFrame(tick);
    },
    [cancelAnimation, durationMs],
  );

  const performCut = useCallback(() => {
    cancelAnimation();
    progressRef.current = 0;
    setProgress(0);
    onCompleteRef.current();
  }, [cancelAnimation]);

  const performTake = useCallback(() => {
    if (transitionType === 'cut') {
      performCut();
      return;
    }
    animateTo(100);
  }, [transitionType, performCut, animateTo]);

  const setTbar = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(100, value));
    progressRef.current = clamped;
    setProgress(clamped);
  }, []);

  const commitTbar = useCallback(
    (value: number) => {
      if (value >= 50) {
        if (transitionType === 'cut') performCut();
        else animateTo(100);
      } else {
        progressRef.current = 0;
        setProgress(0);
      }
    },
    [transitionType, performCut, animateTo],
  );

  const fadeToBlack = useCallback(
    (active: boolean) => {
      cancelAnimation();
      setIsAnimating(true);
      const start = performance.now();
      const from = fadeRef.current;
      const target = active ? 100 : 0;

      const tick = (now: number) => {
        const t = Math.min((now - start) / durationMs, 1);
        const level = from + (target - from) * t;
        fadeRef.current = level;
        setFadeToBlackLevel(level);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          fadeRef.current = target;
          setFadeToBlackLevel(target);
          setIsAnimating(false);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [cancelAnimation, durationMs],
  );

  const resetProgress = useCallback(() => {
    cancelAnimation();
    progressRef.current = 0;
    setProgress(0);
  }, [cancelAnimation]);

  useEffect(() => () => cancelAnimation(), [cancelAnimation]);

  return {
    progress,
    isAnimating,
    fadeToBlackLevel,
    performCut,
    performTake,
    setTbar,
    commitTbar,
    fadeToBlack,
    resetProgress,
  };
}
