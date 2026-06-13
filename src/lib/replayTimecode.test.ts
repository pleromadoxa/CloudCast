import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REPLAY_FPS,
  formatSmpte,
  formatSmpteFromSeconds,
  secondsToTimecode,
  snapMarkRange,
  snapToFrameBoundary,
} from './replayTimecode';

describe('replayTimecode', () => {
  it('snaps seconds to frame boundaries', () => {
    expect(snapToFrameBoundary(1.016, 30)).toBe(1);
    expect(snapToFrameBoundary(1 + 15 / 30, 30)).toBe(1.5);
    expect(snapToFrameBoundary(0, 30)).toBe(0);
  });

  it('formats SMPTE from seconds', () => {
    expect(formatSmpteFromSeconds(3661.5, 30)).toBe('01:01:01:15');
  });

  it('converts seconds to timecode components', () => {
    const tc = secondsToTimecode(61.5, 30);
    expect(tc.minutes).toBe(1);
    expect(tc.seconds).toBe(1);
    expect(tc.frames).toBe(15);
    expect(formatSmpte(tc)).toBe('00:01:01:15');
  });

  it('snaps mark range with minimum one frame', () => {
    const range = snapMarkRange(1.0, 1.01, DEFAULT_REPLAY_FPS);
    expect(range.outSec - range.inSec).toBeCloseTo(1 / DEFAULT_REPLAY_FPS, 5);
  });

  it('orders inverted in/out marks', () => {
    const range = snapMarkRange(2.5, 1.0, 30);
    expect(range.inSec).toBeLessThan(range.outSec);
  });
});
