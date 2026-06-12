import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Device, DeviceStatus } from '../types/device';

/** Mobile heartbeats every 15s — treat active slots as stale shortly after. */
export const DEVICE_HEARTBEAT_STALE_MS = 22_000;
export const DEVICE_STATUS_SWEEP_MS = 5_000;
/** Paired on channel but no mesh/PC connected for this long → offline + re-offer. */
export const DEVICE_CONNECTING_TIMEOUT_MS = 40_000;

export interface DeviceReconcileContext {
  presenceOnline: boolean;
  hasMeshStream: boolean;
  peerState?: RTCPeerConnectionState;
  connectingSinceMs?: number | null;
  nowMs?: number;
}

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
  nowMs = Date.now(),
): boolean {
  if (!isActiveDeviceStatus(status)) return false;
  if (!lastSeenAt) return status === 'live';
  return nowMs - new Date(lastSeenAt).getTime() > DEVICE_HEARTBEAT_STALE_MS;
}

/**
 * Authoritative device connectivity for the dashboard.
 * - live: active mesh feed on the mixer
 * - connecting: paired app is on the session channel (not streaming yet)
 * - offline: not on channel / app disconnected (paired slot may still exist)
 */
export function reconcileDeviceConnectivity(
  device: Device,
  context: DeviceReconcileContext,
): Device {
  if (!device.deviceId || device.deviceId.startsWith('slot-')) return device;

  const nowMs = context.nowMs ?? Date.now();
  const now = new Date(nowMs).toISOString();
  const meshActive = context.hasMeshStream;
  const { presenceOnline, peerState, connectingSinceMs } = context;

  if (meshActive || peerState === 'connected') {
    return {
      ...device,
      status: 'live',
      isOnline: true,
      connectionState: 'connected',
      lastSeenAt: now,
    };
  }

  if (presenceOnline || peerState === 'connecting' || peerState === 'new') {
    const since = connectingSinceMs ?? (device.lastSeenAt ? new Date(device.lastSeenAt).getTime() : nowMs);
    const stuckConnecting = !meshActive && since > 0 && nowMs - since > DEVICE_CONNECTING_TIMEOUT_MS;

    if (stuckConnecting) {
      return {
        ...device,
        status: 'offline',
        isOnline: false,
        connectionState: 'disconnected',
        lastSeenAt: device.lastSeenAt ?? now,
      };
    }

    return {
      ...device,
      status: 'connecting',
      isOnline: true,
      connectionState: peerState ?? 'connecting',
      lastSeenAt: now,
    };
  }

  const heartbeatStale = isDeviceHeartbeatStale(device.lastSeenAt, device.status, nowMs);
  const since =
    connectingSinceMs ??
    (device.lastSeenAt ? new Date(device.lastSeenAt).getTime() : 0);
  const connectingTimedOut =
    device.status === 'connecting' &&
    since > 0 &&
    nowMs - since > DEVICE_CONNECTING_TIMEOUT_MS;

  if (heartbeatStale || connectingTimedOut || (device.status === 'live' && !meshActive)) {
    return {
      ...device,
      status: 'offline',
      isOnline: false,
      connectionState: 'disconnected',
      lastSeenAt: device.lastSeenAt ?? now,
    };
  }

  if (device.status === 'connecting') {
    return {
      ...device,
      status: 'connecting',
      isOnline: false,
      connectionState: 'disconnected',
      lastSeenAt: device.lastSeenAt ?? now,
    };
  }

  return {
    ...device,
    isOnline: false,
    status: 'offline',
    connectionState: 'disconnected',
    lastSeenAt: device.lastSeenAt,
  };
}
