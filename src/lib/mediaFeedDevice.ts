import type { Device } from '../types/device';
import { REGAL_MEDIA_DEVICE_ID } from '../types/mediaFeed';
import { isDisplayFeedDevice } from './displayFeedDevice';
import { isPrismFeedDevice } from './prismFeedDevice';

export function createRegalMediaDevice(): Device {
  const now = new Date().toISOString();
  return {
    deviceId: REGAL_MEDIA_DEVICE_ID,
    label: 'Media',
    platform: 'unknown',
    deviceType: 'mobile',
    deviceRole: 'video',
    audioSource: 'camera',
    whepUrl: '',
    streamId: '',
    status: 'live',
    slotNumber: 0,
    updatedAt: now,
    isOnline: true,
    lastSeenAt: now,
  };
}

export function isMediaFeedDevice(device: Device | null | undefined): boolean {
  return device?.deviceId === REGAL_MEDIA_DEVICE_ID;
}

/** Virtual video inputs without mesh/WHEP audio routing. */
export function isVirtualFeedDevice(device: Device | null | undefined): boolean {
  return (
    isDisplayFeedDevice(device) ||
    isPrismFeedDevice(device) ||
    isMediaFeedDevice(device) ||
    device?.deviceId === 'regal-browser-feed'
  );
}

/** Inject Media Feed after Regal Prism in the mixer source list. */
export function mergeMediaFeedIntoDevices(devices: Device[]): Device[] {
  const without = devices.filter((d) => d.deviceId !== REGAL_MEDIA_DEVICE_ID);
  const prismIdx = without.findIndex((d) => d.deviceId === 'regal-prism-feed');
  if (prismIdx >= 0) {
    return [
      ...without.slice(0, prismIdx + 1),
      createRegalMediaDevice(),
      ...without.slice(prismIdx + 1),
    ];
  }
  const displayIdx = without.findIndex((d) => d.deviceId === 'regal-display-feed');
  if (displayIdx >= 0) {
    return [
      ...without.slice(0, displayIdx + 1),
      createRegalMediaDevice(),
      ...without.slice(displayIdx + 1),
    ];
  }
  return [createRegalMediaDevice(), ...without];
}
