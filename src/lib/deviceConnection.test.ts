import { describe, expect, it } from 'vitest';
import { isRoutableMixerSource, reconcileDeviceConnectivity } from './deviceConnection';
import type { Device } from '../types/device';

function baseDevice(overrides: Partial<Device> = {}): Device {
  return {
    deviceId: 'phone-1',
    label: 'Phone',
    platform: 'ios',
    deviceType: 'mobile',
    deviceRole: 'video',
    audioSource: 'camera',
    whepUrl: 'https://example.com/whep',
    streamId: 'stream-1',
    status: 'connecting',
    slotNumber: 1,
    updatedAt: new Date().toISOString(),
    isOnline: true,
    connectionState: 'connected',
    lastSeenAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('reconcileDeviceConnectivity', () => {
  it('marks Regal Cloud live when WHEP carries video', () => {
    const result = reconcileDeviceConnectivity(baseDevice(), {
      presenceOnline: true,
      hasMeshStream: true,
      hasMeshVideo: false,
      hasWhepVideo: true,
      hasWhepAudio: false,
      whepConnected: true,
      videoTransport: 'cloud',
    });
    expect(result.status).toBe('live');
  });

  it('keeps Regal Cloud on connecting when only mesh audio is linked', () => {
    const result = reconcileDeviceConnectivity(baseDevice(), {
      presenceOnline: true,
      hasMeshStream: true,
      hasMeshVideo: false,
      hasWhepVideo: false,
      hasWhepAudio: false,
      whepConnected: true,
      videoTransport: 'cloud',
    });
    expect(result.status).toBe('connecting');
  });

  it('marks free mesh live when mesh carries video', () => {
    const result = reconcileDeviceConnectivity(
      baseDevice({ whepUrl: '', status: 'connecting' }),
      {
        presenceOnline: true,
        hasMeshStream: true,
        hasMeshVideo: true,
        videoTransport: 'mesh',
      },
    );
    expect(result.status).toBe('live');
  });

  it('routes a connected camera onto the mixer before the first live frame', () => {
    expect(isRoutableMixerSource(baseDevice({ whepUrl: '', status: 'connecting' }))).toBe(true);
    expect(isRoutableMixerSource(baseDevice({ status: 'live' }))).toBe(true);
    expect(
      isRoutableMixerSource(baseDevice({ status: 'offline', isOnline: false, connectionState: 'disconnected' })),
    ).toBe(false);
  });

  it('keeps free mesh on connecting when only audio arrived for a camera', () => {
    const result = reconcileDeviceConnectivity(
      baseDevice({ whepUrl: '', status: 'connecting' }),
      {
        presenceOnline: true,
        hasMeshStream: true,
        hasMeshVideo: false,
        videoTransport: 'mesh',
      },
    );
    expect(result.status).toBe('connecting');
  });
});
