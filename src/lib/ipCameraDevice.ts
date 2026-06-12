import type { Device } from '../types/device';
import type { IpCameraConfig } from '../types/ipCamera';

export const IP_CAMERA_DEVICE_PREFIX = 'ipcam-';

export function isIpCameraDevice(device: Device): boolean {
  return device.deviceId.startsWith(IP_CAMERA_DEVICE_PREFIX) || device.deviceType === 'ip_camera';
}

export function buildIpCameraDevice(config: IpCameraConfig): Device {
  const now = new Date().toISOString();
  return {
    deviceId: `${IP_CAMERA_DEVICE_PREFIX}${config.id}`,
    slotNumber: config.slotNumber,
    label: config.label.trim() || 'IP Camera',
    platform: 'ip',
    deviceType: 'ip_camera',
    deviceRole: 'video',
    audioSource: 'camera',
    linkedAudioDeviceId: null,
    whepUrl: config.url.trim(),
    streamId: config.id,
    status: config.enabled && config.url.trim() ? 'live' : 'offline',
    updatedAt: now,
    isOnline: config.enabled && Boolean(config.url.trim()),
    lastSeenAt: now,
  };
}

/** Place IP camera on its configured slot within the mixer input list. */
export function mergeIpCameraIntoDevices(
  devices: Device[],
  config: IpCameraConfig | null,
): Device[] {
  if (!config?.enabled || !config.url.trim()) return devices;

  const ipDevice = buildIpCameraDevice(config);
  const targetSlot = config.slotNumber;

  const hasSlot = devices.some((d) => d.slotNumber === targetSlot);
  if (!hasSlot) {
    return [...devices, ipDevice].sort((a, b) => (a.slotNumber ?? 0) - (b.slotNumber ?? 0));
  }

  return devices.map((d) => ((d.slotNumber ?? 0) === targetSlot ? ipDevice : d));
}
