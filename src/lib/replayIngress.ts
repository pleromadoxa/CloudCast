import type { ConnectionMode } from '../types/plans';
import type { Device } from '../types/device';
import { isRealDevice } from '../types/device';
import { hasLiveVideoStream, resolveHybridVideoStream } from './deviceIngress';

export type ReplayIngressPath = 'mesh' | 'whep' | 'none';

export { hasLiveVideoStream } from './deviceIngress';

/** Prefer Regal Cloud WHEP; fall back to mesh P2P for the same device. */
export function resolveReplayDeviceStream(
  deviceId: string,
  getMeshStream: (id: string) => MediaStream | null,
  getWhepStream: (id: string) => MediaStream | null,
): MediaStream | null {
  return resolveHybridVideoStream(getMeshStream(deviceId), getWhepStream(deviceId));
}

export function resolveExpectedReplayIngress(
  device: Device,
  connectionMode: ConnectionMode,
  getMeshStream: (id: string) => MediaStream | null,
  getWhepStream: (id: string) => MediaStream | null,
): ReplayIngressPath {
  if (device.status === 'offline') return 'none';
  if (connectionMode === 'mesh') return 'mesh';
  if (device.whepUrl && hasLiveVideoStream(getWhepStream(device.deviceId))) return 'whep';
  if (device.whepUrl) return 'whep';
  if (hasLiveVideoStream(getMeshStream(device.deviceId))) return 'mesh';
  return 'mesh';
}

export function listReplayCaptureDevices(devices: Device[]): Device[] {
  return devices.filter(
    (d) =>
      isRealDevice(d) &&
      d.deviceId &&
      !d.deviceId.startsWith('slot-') &&
      (d.status === 'live' || d.status === 'connecting'),
  );
}
