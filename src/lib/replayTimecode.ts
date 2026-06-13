/** SMPTE-style timecode helpers for CloudCast Replay (30 fps default). */

export const DEFAULT_REPLAY_FPS = 30;

export interface ReplayTimecode {
  hours: number;
  minutes: number;
  seconds: number;
  frames: number;
  fps: number;
}

export function snapToFrameBoundary(seconds: number, fps = DEFAULT_REPLAY_FPS): number {
  if (!Number.isFinite(seconds) || fps <= 0) return 0;
  return Math.round(seconds * fps) / fps;
}

export function secondsToTimecode(totalSeconds: number, fps = DEFAULT_REPLAY_FPS): ReplayTimecode {
  const safe = Math.max(0, totalSeconds);
  const wholeSeconds = Math.floor(safe);
  const frames = Math.min(fps - 1, Math.round((safe - wholeSeconds) * fps));
  return {
    hours: Math.floor(wholeSeconds / 3600) % 24,
    minutes: Math.floor((wholeSeconds % 3600) / 60),
    seconds: wholeSeconds % 60,
    frames,
    fps,
  };
}

export function formatSmpte(tc: ReplayTimecode, dropFrame = false): string {
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const sep = dropFrame ? ';' : ':';
  return `${pad2(tc.hours)}:${pad2(tc.minutes)}:${pad2(tc.seconds)}${sep}${pad2(tc.frames)}`;
}

export function formatSmpteFromSeconds(totalSeconds: number, fps = DEFAULT_REPLAY_FPS, dropFrame = false): string {
  return formatSmpte(secondsToTimecode(totalSeconds, fps), dropFrame);
}

/** House clock: elapsed since show/replay session anchor. */
export function houseClockSeconds(anchorMs: number, nowMs = Date.now()): number {
  return Math.max(0, (nowMs - anchorMs) / 1000);
}

export function bufferOffsetToHouseSmpte(
  bufferOffsetSec: number,
  houseAnchorMs: number,
  fps = DEFAULT_REPLAY_FPS,
): string {
  const absoluteSec = houseClockSeconds(houseAnchorMs) - (performance.now() / 1000 - bufferOffsetSec);
  return formatSmpteFromSeconds(Math.max(0, absoluteSec), fps);
}

export function snapMarkRange(
  inSec: number,
  outSec: number,
  fps = DEFAULT_REPLAY_FPS,
): { inSec: number; outSec: number } {
  const a = snapToFrameBoundary(Math.min(inSec, outSec), fps);
  const b = snapToFrameBoundary(Math.max(inSec, outSec), fps);
  if (b - a < 1 / fps) {
    return { inSec: a, outSec: a + 1 / fps };
  }
  return { inSec: a, outSec: b };
}
