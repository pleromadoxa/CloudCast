import { describe, expect, it } from 'vitest';
import { createReplayStreamResolver, multiAngleDuration } from './replayMultiAngle';

function mockStream(liveVideo = true): MediaStream {
  return {
    getVideoTracks: () =>
      liveVideo ? [{ kind: 'video', readyState: 'live' } as MediaStreamTrack] : [],
    getAudioTracks: () => [],
  } as unknown as MediaStream;
}

describe('replayMultiAngle', () => {
  it('computes duration from marks', () => {
    expect(multiAngleDuration(1, 4)).toBe(3);
    expect(multiAngleDuration(null, null, 5)).toBe(5);
    expect(multiAngleDuration(10, 50)).toBe(30);
  });

  it('prefers mesh stream over whep in resolver', () => {
    const mesh = mockStream(true);
    const whep = mockStream(true);
    const resolve = createReplayStreamResolver(
      () => mesh,
      () => whep,
    );
    expect(resolve('cam-1')).toBe(mesh);
  });

  it('falls back to whep when mesh has no live video', () => {
    const whep = mockStream(true);
    const resolve = createReplayStreamResolver(
      () => mockStream(false),
      () => whep,
    );
    expect(resolve('cam-1')).toBe(whep);
  });
});
