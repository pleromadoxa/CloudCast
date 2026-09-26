/**
 * Shared playback clock for the 3D motion graphics engine.
 *
 * The stage drives the clock (one authoritative timeline); the panel reads it
 * for the scrub bar without re-rendering every frame. Stages mounted off-screen
 * (hidden consoles, the fullscreen preview page) keep their own private clock
 * and only the visible master claims the shared one.
 */

export interface MotionClockState {
  /** Elapsed seconds on the template timeline, already speed-scaled. */
  t: number;
  /** Template length in seconds at 1x. */
  duration: number;
  /** Playback rate (0.5 – 2). */
  speed: number;
  loop: boolean;
  finished: boolean;
  /** The `playToken` this clock was primed with — detects restarts. */
  token: number;
}

export function createMotionClock(): MotionClockState {
  return { t: 0, duration: 1, speed: 1, loop: false, finished: false, token: -1 };
}

export function primeMotionClock(
  clock: MotionClockState,
  duration: number,
  speed: number,
  loop: boolean,
  token: number,
): void {
  clock.t = 0;
  clock.duration = duration;
  clock.speed = speed;
  clock.loop = loop;
  clock.finished = false;
  clock.token = token;
}

let activeClock: MotionClockState | null = null;

export function claimMotionClock(clock: MotionClockState): void {
  activeClock = clock;
}

export function releaseMotionClock(clock: MotionClockState): void {
  if (activeClock === clock) activeClock = null;
}

export function getActiveMotionClock(): MotionClockState | null {
  return activeClock;
}

/** 0–1 progress of the current timeline (clamped, never wraps). */
export function motionClockProgress(clock: MotionClockState | null): number {
  if (!clock || clock.duration <= 0) return 0;
  return Math.min(1, clock.t / clock.duration);
}
