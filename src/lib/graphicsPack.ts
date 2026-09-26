/**
 * CloudCast Live Production Graphics Pack — pure display math.
 *
 * Countdown/clock arithmetic, game-clock formatting and ad-carousel rotation
 * timing. Framework-free and unit tested (`graphicsPack.test.ts`).
 */

import type {
  AdCarouselEntry,
  CountdownSettings,
  SponsorBugEntry,
} from '../types/overlays';

function clampSeconds(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

/** Formats whole seconds as a broadcast game clock — "12:34", "5:07", "0:09". */
export function formatGameClock(totalSeconds: number): string {
  const safe = clampSeconds(totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Formats whole seconds as "HH:MM:SS" for countdown displays. */
export function formatCountdownClock(totalSeconds: number): string {
  const safe = clampSeconds(totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  return [hours > 0 ? String(hours).padStart(2, '0') : null, mm, String(seconds).padStart(2, '0')]
    .filter((part): part is string => part !== null)
    .join(':');
}

/** Wall-clock time for `time-of-day` mode — "17:42:09". */
export function formatTimeOfDay(date: Date): string {
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

export interface CountdownDisplay {
  /** Seconds shown on the clock (countdown → remaining, count-up → elapsed). */
  seconds: number;
  /** 0–1 progress through the target (used by the ring indicator). */
  progress: number;
  /** True when a countdown has reached zero (or a count-up hit its target). */
  done: boolean;
}

/**
 * Resolves the visible countdown value.
 * `elapsedSeconds` is the time since the operator armed the clock.
 */
export function resolveCountdownDisplay(
  settings: Pick<CountdownSettings, 'mode' | 'targetSeconds'>,
  elapsedSeconds: number,
): CountdownDisplay {
  const target = clampSeconds(settings.targetSeconds);
  const elapsed = clampSeconds(elapsedSeconds);

  if (settings.mode === 'count-up') {
    return {
      seconds: elapsed,
      progress: target > 0 ? Math.min(1, elapsed / target) : 0,
      done: target > 0 && elapsed >= target,
    };
  }

  const remaining = Math.max(0, target - elapsed);
  return {
    seconds: remaining,
    progress: target > 0 ? Math.min(1, elapsed / target) : 0,
    done: target > 0 && remaining <= 0,
  };
}

export interface CarouselTiming {
  /** Index of the creative on screen at `elapsedSeconds`. */
  index: number;
  /** 0–1 progress through the current creative's duration. */
  progress: number;
  /** Total seconds for one full rotation of the carousel. */
  totalDuration: number;
}

function entryDurations(entries: Array<{ durationSeconds?: number; seconds?: number }>): number[] {
  return entries.map((entry) => {
    const raw = entry.durationSeconds ?? entry.seconds ?? 0;
    return Number.isFinite(raw) && raw > 0 ? raw : 6;
  });
}

/**
 * Rotation math for the ad carousel / sponsor bug: cumulative durations wrap
 * around the loop. Empty carousels resolve to index 0.
 */
export function carouselTiming(
  entries: Array<Pick<AdCarouselEntry, 'durationSeconds'> | Pick<SponsorBugEntry, 'seconds'>>,
  elapsedSeconds: number,
): CarouselTiming {
  const durations = entryDurations(entries);
  const totalDuration = durations.reduce((sum, d) => sum + d, 0);
  if (totalDuration <= 0) {
    return { index: 0, progress: 0, totalDuration: 0 };
  }

  let cursor = Math.max(0, elapsedSeconds) % totalDuration;
  for (let i = 0; i < durations.length; i += 1) {
    if (cursor < durations[i]) {
      return { index: i, progress: durations[i] > 0 ? cursor / durations[i] : 0, totalDuration };
    }
    cursor -= durations[i];
  }
  return { index: durations.length - 1, progress: 1, totalDuration };
}
