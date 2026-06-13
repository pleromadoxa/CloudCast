import type { Device } from '../types/device';
import { REGAL_DISPLAY_DEVICE_ID } from '../types/displayFeed';

/** Virtual video input — Regal Display Feed (presentation / scripture output). */
export function createRegalDisplayDevice(): Device {
  const now = new Date().toISOString();
  return {
    deviceId: REGAL_DISPLAY_DEVICE_ID,
    label: 'Regal Display',
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

export function isDisplayFeedDevice(device: Device | null | undefined): boolean {
  return device?.deviceId === REGAL_DISPLAY_DEVICE_ID;
}

/** Inject Display Feed as the first source when building the mixer device list. */
export function mergeDisplayFeedIntoDevices(devices: Device[]): Device[] {
  const without = devices.filter((d) => d.deviceId !== REGAL_DISPLAY_DEVICE_ID);
  return [createRegalDisplayDevice(), ...without];
}
