import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Device, DeviceStatus } from '../types/device';

/** Mobile heartbeats every 30s — treat live/connecting as stale shortly after. */
export const DEVICE_HEARTBEAT_STALE_MS = 35_000;
export const DEVICE_STATUS_SWEEP_MS = 10_000;

export interface DevicePresenceMeta {
  role?: string;
  clientType?: string;
  deviceId?: string;
  platform?: string;
  joinedAt?: string;
}

/** Collect mobile/device presence keys from a Supabase presence snapshot. */
export function presenceDeviceIds(channel: RealtimeChannel): Set<string> {
  const online = new Set<string>();
  const state = channel.presenceState<DevicePresenceMeta>();

  for (const [key, entries] of Object.entries(state)) {
    if (key.startsWith('dashboard-')) continue;

    for (const entry of entries) {
      const id = entry.deviceId?.trim() || key;
      if (id && !id.startsWith('dashboard-') && !id.startsWith('slot-')) {
        online.add(id);
      }
    }
  }

  return online;
}

export function isDashboardPresenceKey(key: string): boolean {
  return key.startsWith('dashboard-');
}

export function deriveStatusFromConnection(
  hasStream: boolean,
  presenceOnline: boolean,
  peerState?: RTCPeerConnectionState,
): DeviceStatus {
  if (hasStream || peerState === 'connected') return 'live';
  if (presenceOnline || peerState === 'connecting' || peerState === 'new') return 'connecting';
  return 'offline';
}

export function isMeshStreamActive(stream: MediaStream | null | undefined): boolean {
  if (!stream) return false;
  const tracks = stream.getTracks();
  return tracks.length > 0 && tracks.some((track) => track.readyState === 'live');
}

/** Stream still attached — tracks may be `new` before `live` (do not stop these). */
export function isMeshStreamPresent(stream: MediaStream | null | undefined): boolean {
  if (!stream) return false;
  const tracks = stream.getTracks();
  return tracks.length > 0 && tracks.some((track) => track.readyState !== 'ended');
}

export function isActiveDeviceStatus(status: DeviceStatus): boolean {
  return status === 'live' || status === 'connecting';
}

export function isDeviceHeartbeatStale(
  lastSeenAt: string | undefined,
  status: DeviceStatus,
): boolean {
  if (status !== 'live') return false;
  if (!lastSeenAt) return true;
  return Date.now() - new Date(lastSeenAt).getTime() > DEVICE_HEARTBEAT_STALE_MS;
}

/**
 * Authoritative device connectivity for the dashboard.
 * - live: active mesh feed on the mixer
 * - connecting: paired app is on the session channel (not streaming yet)
 * - offline: not on channel / app disconnected (paired slot may still exist)
 */
export function reconcileDeviceConnectivity(
  device: Device,
  context: { presenceOnline: boolean; hasMeshStream: boolean },
): Device {
  if (!device.deviceId || device.deviceId.startsWith('slot-')) return device;

  const now = new Date().toISOString();
  const meshActive = context.hasMeshStream;
  const { presenceOnline } = context;

  if (meshActive) {
    return {
      ...device,
      status: 'live',
      isOnline: true,
      connectionState: 'connected',
      lastSeenAt: now,
    };
  }

  if (presenceOnline) {
    return {
      ...device,
      status: 'connecting',
      isOnline: true,
      connectionState: 'connecting',
      lastSeenAt: now,
    };
  }

  const heartbeatStale = isDeviceHeartbeatStale(device.lastSeenAt, device.status);
  if (isActiveDeviceStatus(device.status) || heartbeatStale) {
    return {
      ...device,
      status: 'offline',
      isOnline: false,
      connectionState: 'disconnected',
      lastSeenAt: now,
    };
  }

  return { ...device, isOnline: false, status: 'offline', connectionState: 'disconnected' };
}
