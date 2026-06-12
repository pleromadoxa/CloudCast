/** HTML5 drag-and-drop payload types for CloudCast Symphony. */

export const DND_LOOP = 'application/x-cloudcast-symphony-loop';
export const DND_INSTRUMENT = 'application/x-cloudcast-symphony-instrument';
export const DND_REGION = 'application/x-cloudcast-symphony-region';

export const BAR_WIDTH = 80;
export const TRACK_HEIGHT = 52;
export const BEATS_PER_BAR = 4;
export const TICKS_PER_BEAT = 960;
export const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export type PlayheadPosition = { bar: number; beat: number; tick: number };

export function snapBar(rawBar: number, snap = true): number {
  return snap ? Math.max(0, Math.round(rawBar)) : Math.max(0, rawBar);
}

export function barFromClientX(
  clientX: number, containerLeft: number, scrollLeft: number, barWidth = BAR_WIDTH,
): number {
  const x = clientX - containerLeft + scrollLeft;
  return x / barWidth;
}

export function playheadToPx(
  bar: number, beat: number, tick: number, barWidth = BAR_WIDTH,
): number {
  return positionToBeats(bar, beat, tick) * (barWidth / BEATS_PER_BAR);
}

export function positionToBeats(bar: number, beat: number, tick: number): number {
  return (bar - 1) * BEATS_PER_BAR + (beat - 1) + tick / TICKS_PER_BEAT;
}

export function beatsToPosition(beats: number): PlayheadPosition {
  const clamped = Math.max(0, beats);
  const bar = Math.floor(clamped / BEATS_PER_BAR) + 1;
  const beatInBar = clamped % BEATS_PER_BAR;
  const beat = Math.floor(beatInBar) + 1;
  const tick = Math.floor((beatInBar % 1) * TICKS_PER_BEAT);
  return { bar, beat, tick };
}

export function pxToPosition(px: number, snap = true, barWidth = BAR_WIDTH): PlayheadPosition {
  const beats = Math.max(0, px / (barWidth / BEATS_PER_BAR));
  if (snap) {
    const barIndex = Math.round(beats / BEATS_PER_BAR);
    return { bar: barIndex + 1, beat: 1, tick: 0 };
  }
  return beatsToPosition(beats);
}

export function pxToBar(px: number, snap = true, barWidth = BAR_WIDTH): number {
  const bar = px / barWidth;
  return snapBar(bar, snap);
}
