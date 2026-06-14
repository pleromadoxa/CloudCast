import { describe, expect, it } from 'vitest';
import { resolveExpectedReplayIngress, resolveReplayDeviceStream } from './replayIngress';
import type { Device } from '../types/device';

const baseDevice: Device = {
  deviceId: 'cam-1',
  label: 'Cam 1',
  platform: 'ios',
  deviceType: 'mobile',
  whepUrl: 'https://example.com/whep',
  streamId: '',
  status: 'live',
  slotNumber: 1,
  updatedAt: new Date().toISOString(),
  isOnline: true,
  lastSeenAt: new Date().toISOString(),
};

function mockStream(liveVideo = true): MediaStream {
  return {
    getVideoTracks: () =>
      liveVideo ? [{ kind: 'video', readyState: 'live' } as MediaStreamTrack] : [],
    getAudioTracks: () => [],
  } as unknown as MediaStream;
}

describe('replayIngress', () => {
  it('prefers whep over mesh on regal plan', () => {
    const mesh = mockStream(true);
    const whep = mockStream(true);
    expect(resolveReplayDeviceStream('cam-1', () => mesh, () => whep)).toBe(whep);
  });

  it('uses whep when mesh unavailable on regal plan', () => {
    const whep = mockStream(true);
    expect(resolveReplayDeviceStream('cam-1', () => null, () => whep)).toBe(whep);
  });

  it('expects whep ingress when whep url configured on regal', () => {
    expect(resolveExpectedReplayIngress(baseDevice, 'regal', () => null, () => null)).toBe('whep');
  });

  it('expects mesh on free plan', () => {
    expect(resolveExpectedReplayIngress(baseDevice, 'mesh', () => null, () => null)).toBe('mesh');
  });
});
