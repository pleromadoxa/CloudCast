import type { AutomationPoint } from '../../types/symphony';

/** Linear interpolation of automation value (0–100) at absolute beat position. */
export function volumeAtBeat(points: AutomationPoint[] | undefined, beat: number, fallback: number): number {
  if (!points || points.length === 0) return fallback;
  const sorted = [...points].sort((a, b) => a.bar * 4 + a.beat - (b.bar * 4 + b.beat));
  const abs = (p: AutomationPoint) => p.bar * 4 + p.beat;
  const target = beat;

  if (target <= abs(sorted[0])) return sorted[0].value;
  if (target >= abs(sorted[sorted.length - 1])) return sorted[sorted.length - 1].value;

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const aBeat = abs(a);
    const bBeat = abs(b);
    if (target >= aBeat && target <= bBeat) {
      const t = bBeat === aBeat ? 0 : (target - aBeat) / (bBeat - aBeat);
      return a.value + t * (b.value - a.value);
    }
  }
  return fallback;
}

export function normalizeAutomationPoint(bar: number, beat: number, value: number): AutomationPoint {
  return {
    bar: Math.max(0, bar),
    beat: Math.max(0, Math.min(3.999, beat)),
    value: Math.max(0, Math.min(100, value)),
  };
}
