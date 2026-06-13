import type { ConnectionMode } from '../types/plans';
import type { Device } from '../types/device';
import { isRealDevice } from '../types/device';
import { hasUsableVideo } from './streamAudioHub';

export type ReplayIngressPath = 'mesh' | 'whep' | 'none';

export function hasLiveVideoStream(stream: MediaStream | null | undefined): boolean {
  if (!stream) return false;
  return stream.getVideoTracks().some((track) => track.readyState === 'live');
}

/** Prefer mesh P2P; fall back to Regal Cloud WHEP playback for the same device. */
export function resolveReplayDeviceStream(
  deviceId: string,
  getMeshStream: (id: string) => MediaStream | null,
  getWhepStream: (id: string) => MediaStream | null,
): MediaStream | null {
  const mesh = getMeshStream(deviceId);
  if (hasLiveVideoStream(mesh)) return mesh;
  if (hasUsableVideo(mesh)) return mesh;

  const whep = getWhepStream(deviceId);
  if (hasLiveVideoStream(whep)) return whep;
  if (hasUsableVideo(whep)) return whep;

  return mesh ?? whep ?? null;
}

export function resolveExpectedReplayIngress(
  device: Device,
  connectionMode: ConnectionMode,
  getMeshStream: (id: string) => MediaStream | null,
  getWhepStream: (id: string) => MediaStream | null,
): ReplayIngressPath {
  if (device.status === 'offline') return 'none';
  if (hasLiveVideoStream(getMeshStream(device.deviceId))) return 'mesh';
  if (connectionMode === 'mesh') return 'mesh';
  if (device.whepUrl && hasLiveVideoStream(getWhepStream(device.deviceId))) return 'whep';
  if (device.whepUrl) return 'whep';
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
