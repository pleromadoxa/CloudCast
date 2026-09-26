import { describe, expect, it } from 'vitest';
import { resolveKeyFillDevice } from './keyFillRouting';
import { REGAL_DISPLAY_DEVICE_ID } from '../types/displayFeed';
import { REGAL_PRISM_DEVICE_ID } from '../types/prismFeed';
import type { Device } from '../types/device';

function mockDevice(id: string, label: string): Device {
  return {
    deviceId: id,
    label,
    platform: 'ios',
    deviceType: 'mobile',
    deviceRole: 'video',
    audioSource: 'camera',
    whepUrl: '',
    streamId: '',
    status: 'live',
    slotNumber: 1,
    updatedAt: new Date().toISOString(),
    isOnline: true,
    lastSeenAt: new Date().toISOString(),
  };
}

describe('resolveKeyFillDevice', () => {
  const display = mockDevice(REGAL_DISPLAY_DEVICE_ID, 'Regal Display');
  const prism = mockDevice(REGAL_PRISM_DEVICE_ID, 'Regal Prism');
  const camera = mockDevice('cam-1', 'Camera 1');

  it('uses PGM beneath display on PST preview', () => {
    expect(
      resolveKeyFillDevice({
        keyedDevice: display,
        subDevice: camera,
        pgmDevice: prism,
        pstDeviceId: REGAL_DISPLAY_DEVICE_ID,
        pgmDeviceId: REGAL_PRISM_DEVICE_ID,
      })?.deviceId,
    ).toBe(REGAL_PRISM_DEVICE_ID);
  });

  it('uses Sub beneath display on PGM', () => {
    expect(
      resolveKeyFillDevice({
        keyedDevice: display,
        subDevice: camera,
        pgmDevice: display,
        pstDeviceId: REGAL_PRISM_DEVICE_ID,
        pgmDeviceId: REGAL_DISPLAY_DEVICE_ID,
      })?.deviceId,
    ).toBe('cam-1');
  });

  it('uses Sub for non-display keyed sources', () => {
    expect(
      resolveKeyFillDevice({
        keyedDevice: prism,
        subDevice: camera,
        pgmDevice: prism,
        pstDeviceId: null,
        pgmDeviceId: REGAL_PRISM_DEVICE_ID,
      })?.deviceId,
    ).toBe('cam-1');
  });
});
