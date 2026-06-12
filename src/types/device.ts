import type { AudioInputSource, DeviceRole } from './audio';

export type DeviceStatus = 'live' | 'offline' | 'connecting' | 'error';

export type StreamQuality = 'auto' | 'high' | 'medium' | 'low';

export type OverlayType = 'none' | 'timestamp' | 'device-label' | 'crosshair' | 'safe-zone';

export interface DevicePresence {
  deviceId: string;
  label: string;
  platform: 'ios' | 'android' | 'usb' | 'ip' | 'unknown';
  deviceType?: 'mobile' | 'usb' | 'ip_camera';
  deviceRole?: DeviceRole;
  audioSource?: AudioInputSource;
  linkedAudioDeviceId?: string | null;
  whepUrl: string;
  streamId: string;
  status: DeviceStatus;
  slotNumber?: number;
  batteryLevel?: number;
  networkType?: string;
  updatedAt: string;
}

export interface Device extends DevicePresence {
  isOnline: boolean;
  lastSeenAt: string;
  connectionState?: RTCPeerConnectionState;
}

/** Placeholder for an empty mixer input slot (1–10). */
export function createEmptySlot(slotNumber: number): Device {
  return {
    deviceId: `slot-${slotNumber}`,
    slotNumber,
    label: `Input ${slotNumber}`,
    platform: 'unknown',
    deviceType: 'mobile',
    deviceRole: 'video',
    audioSource: 'camera',
    whepUrl: '',
    streamId: '',
    status: 'offline',
    updatedAt: new Date().toISOString(),
    isOnline: false,
    lastSeenAt: new Date().toISOString(),
  };
}

export function isRealDevice(device: Device): boolean {
  return !device.deviceId.startsWith('slot-');
}

export function isVideoDevice(device: Device): boolean {
  return isRealDevice(device) && device.deviceRole !== 'audio';
}

export function isAudioOnlyDevice(device: Device): boolean {
  return isRealDevice(device) && device.deviceRole === 'audio';
}
