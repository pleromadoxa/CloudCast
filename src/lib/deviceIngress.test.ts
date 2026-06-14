import { describe, expect, it } from 'vitest';
import {
  activeHybridVideoSource,
  resolveHybridAudioStream,
  resolveHybridVideoStream,
} from './deviceIngress';

function mockStream(opts: { liveVideo?: boolean; liveAudio?: boolean }): MediaStream {
  const videoTracks =
    opts.liveVideo !== undefined
      ? [{ kind: 'video', readyState: opts.liveVideo ? 'live' : 'ended' } as MediaStreamTrack]
      : [];
  const audioTracks =
    opts.liveAudio !== undefined
      ? [{ kind: 'audio', readyState: opts.liveAudio ? 'live' : 'ended' } as MediaStreamTrack]
      : [];
  return {
    getVideoTracks: () => videoTracks,
    getAudioTracks: () => audioTracks,
  } as unknown as MediaStream;
}

describe('deviceIngress', () => {
  it('prefers WHEP video over mesh on Pro hybrid paths', () => {
    const mesh = mockStream({ liveVideo: true });
    const whep = mockStream({ liveVideo: true });
    expect(resolveHybridVideoStream(mesh, whep)).toBe(whep);
    expect(activeHybridVideoSource(mesh, whep)).toBe('whep');
  });

  it('falls back to mesh video when WHEP is unavailable', () => {
    const mesh = mockStream({ liveVideo: true });
    expect(resolveHybridVideoStream(mesh, null)).toBe(mesh);
    expect(activeHybridVideoSource(mesh, null)).toBe('mesh');
  });

  it('prefers mesh audio for low-latency monitoring', () => {
    const mesh = mockStream({ liveAudio: true });
    const whep = mockStream({ liveAudio: true });
    expect(resolveHybridAudioStream(mesh, whep)).toBe(mesh);
  });

  it('uses WHEP audio when mesh audio is unavailable', () => {
    const whep = mockStream({ liveAudio: true });
    expect(resolveHybridAudioStream(null, whep)).toBe(whep);
  });
});
