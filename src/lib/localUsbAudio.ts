import type { Device } from '../types/device';

export const HOST_USB_DEVICE_PREFIX = 'host-usb-';

export function hostUsbDeviceId(mediaDeviceId: string): string {
  return `${HOST_USB_DEVICE_PREFIX}${mediaDeviceId}`;
}

export function isHostUsbDevice(deviceId: string): boolean {
  return deviceId.startsWith(HOST_USB_DEVICE_PREFIX);
}

export function hostUsbMediaDeviceId(deviceId: string): string {
  return deviceId.slice(HOST_USB_DEVICE_PREFIX.length);
}

export function createHostUsbDevice(
  mediaDeviceId: string,
  label: string,
  slotNumber: number,
): Device {
  const now = new Date().toISOString();
  return {
    deviceId: hostUsbDeviceId(mediaDeviceId),
    slotNumber,
    label: label.trim() || 'USB Microphone',
    platform: 'usb',
    deviceType: 'usb',
    deviceRole: 'audio',
    audioSource: 'usb_audio',
    whepUrl: '',
    streamId: '',
    status: 'live',
    updatedAt: now,
    isOnline: true,
    lastSeenAt: now,
  };
}

export function friendlyAudioInputLabel(device: MediaDeviceInfo): string {
  const name = device.label?.trim();
  if (name) return name;
  return `Audio input ${device.deviceId.slice(0, 8)}…`;
}
