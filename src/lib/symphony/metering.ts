/**
 * Meter ballistics for the console VU meters.
 * Models analog-style meter physics: fast attack, dB-scaled decay, peak hold.
 */

export interface MeterReading {
  /** Displayed level 0–100. */
  level: number;
  /** Peak-hold marker 0–100. */
  peak: number;
}

const LEVEL_FLOOR_DB = -60;

/** Convert linear amplitude (0–1+) to 0–100 meter scale (dB mapped −60…0). */
export function amplitudeToMeter(amp: number): number {
  const db = 20 * Math.log10(Math.max(1e-5, amp));
  if (db <= LEVEL_FLOOR_DB) return 0;
  return Math.min(100, ((db - LEVEL_FLOOR_DB) / -LEVEL_FLOOR_DB) * 100);
}

export class MeterBallistics {
  private readings = new Map<string, MeterReading>();
  private peakTimes = new Map<string, number>();
  private peakHoldMs: number;
  private decayDbPerSec: number;

  constructor(peakHoldMs = 1600, decayDbPerSec = 24) {
    this.peakHoldMs = peakHoldMs;
    this.decayDbPerSec = decayDbPerSec;
  }

  configure(peakHoldMs: number, decayDbPerSec: number): void {
    this.peakHoldMs = peakHoldMs;
    this.decayDbPerSec = decayDbPerSec;
  }

  /** Push instantaneous levels (0–100 meter scale), returns smoothed readings. */
  push(levels: Record<string, number>, now = performance.now()): Record<string, MeterReading> {
    const out: Record<string, MeterReading> = {};
    const decayStep = this.decayDbPerSec * 0.06; // ≈ per-update at 60ms cadence
    const decayPct = (decayStep / -LEVEL_FLOOR_DB) * 100;

    for (const [id, instant] of Object.entries(levels)) {
      const prev = this.readings.get(id) ?? { level: 0, peak: 0 };
      const level = instant >= prev.level ? instant : Math.max(instant, prev.level - decayPct);
      let peak = prev.peak;
      if (instant >= peak || now - (this.peakTimes.get(id) ?? 0) > this.peakHoldMs) {
        if (instant >= peak) {
          peak = instant;
          this.peakTimes.set(id, now);
        } else {
          peak = level;
        }
      }
      const reading = { level, peak };
      this.readings.set(id, reading);
      out[id] = reading;
    }
    return out;
  }

  reset(): void {
    this.readings.clear();
    this.peakTimes.clear();
  }
}
