import type { Device } from '../types/device';
import { REGAL_BROWSER_DEVICE_ID } from '../types/browserFeed';

export function createRegalBrowserDevice(): Device {
  const now = new Date().toISOString();
  return {
    deviceId: REGAL_BROWSER_DEVICE_ID,
    label: 'Browser',
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

export function isBrowserFeedDevice(device: Device | null | undefined): boolean {
  return device?.deviceId === REGAL_BROWSER_DEVICE_ID;
}

/** Inject Browser Shot after Media in the mixer source list. */
export function mergeBrowserFeedIntoDevices(devices: Device[]): Device[] {
  const without = devices.filter((d) => d.deviceId !== REGAL_BROWSER_DEVICE_ID);
  const mediaIdx = without.findIndex((d) => d.deviceId === 'regal-media-feed');
  if (mediaIdx >= 0) {
    return [
      ...without.slice(0, mediaIdx + 1),
      createRegalBrowserDevice(),
      ...without.slice(mediaIdx + 1),
    ];
  }
  const prismIdx = without.findIndex((d) => d.deviceId === 'regal-prism-feed');
  if (prismIdx >= 0) {
    return [
      ...without.slice(0, prismIdx + 1),
      createRegalBrowserDevice(),
      ...without.slice(prismIdx + 1),
    ];
  }
  const displayIdx = without.findIndex((d) => d.deviceId === 'regal-display-feed');
  if (displayIdx >= 0) {
    return [
      ...without.slice(0, displayIdx + 1),
      createRegalBrowserDevice(),
      ...without.slice(displayIdx + 1),
    ];
  }
  return [createRegalBrowserDevice(), ...without];
}
