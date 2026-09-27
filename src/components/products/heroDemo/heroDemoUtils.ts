import { useEffect, useState } from 'react';

/** Tracks the OS "reduce motion" preference so demos can stay still. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  return reduced;
}

/**
 * Shared 1 Hz ticker that makes timecodes / countdowns feel alive.
 * Frozen when motion is reduced so the hero never fidgets.
 */
export function useDemoTicker(enabled: boolean): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [enabled]);
  return tick;
}

export function formatTimecode(totalSeconds: number, fps = 30): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  const ff = String(Math.floor((totalSeconds * fps) % fps)).padStart(2, '0');
  return `${hh}:${mm}:${ss}:${ff}`;
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/** Deterministic pseudo-random in [0,1) so demos look organic but stable. */
export function seeded(index: number, salt = 1): number {
  const x = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}
