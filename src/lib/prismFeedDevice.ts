import type { Device } from '../types/device';
import { REGAL_PRISM_DEVICE_ID } from '../types/prismFeed';

export function createRegalPrismDevice(): Device {
  const now = new Date().toISOString();
  return {
    deviceId: REGAL_PRISM_DEVICE_ID,
    label: 'Regal Prism',
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

export function isPrismFeedDevice(device: Device | null | undefined): boolean {
  return device?.deviceId === REGAL_PRISM_DEVICE_ID;
}

export function mergePrismFeedIntoDevices(devices: Device[], enabled: boolean): Device[] {
  if (!enabled) return devices.filter((d) => d.deviceId !== REGAL_PRISM_DEVICE_ID);
  const without = devices.filter((d) => d.deviceId !== REGAL_PRISM_DEVICE_ID);
  return [createRegalPrismDevice(), ...without];
}
