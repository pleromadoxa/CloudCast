import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Device, DeviceStatus } from '../types/device';
import { isRealDevice } from '../types/device';

/** Mobile heartbeats every 15s — treat active slots as stale shortly after. */
export const DEVICE_HEARTBEAT_STALE_MS = 22_000;
export const DEVICE_STATUS_SWEEP_MS = 5_000;
/** Paired on channel but no mesh/PC connected for this long → offline + re-offer. */
export const DEVICE_CONNECTING_TIMEOUT_MS = 40_000;

export type VideoTransport = 'mesh' | 'cloud';

export interface DeviceReconcileContext {
  presenceOnline: boolean;
  hasMeshStream: boolean;
  /** Mesh carries video (not audio-only bridge on Regal Cloud). */
  hasMeshVideo?: boolean;
  peerState?: RTCPeerConnectionState;
  connectingSinceMs?: number | null;
  nowMs?: number;
  /** Regal Cloud video uses WHEP playback — not the mesh stream map. */
  videoTransport?: VideoTransport;
}

/** Device publishes through Regal Cloud (WHEP), not mesh video. */
export function deviceHasCloudPlayback(
  device: Device,
  videoTransport?: VideoTransport,
): boolean {
  return videoTransport === 'cloud' || Boolean(device.whepUrl?.trim());
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
  if (hasStream) return 'live';
  if (
    presenceOnline ||
    peerState === 'connecting' ||
    peerState === 'new' ||
    peerState === 'connected'
  ) {
    return 'connecting';
  }
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

/** Paired on the session channel and acknowledged — waiting for Go Live / first frame. */
export function isDeviceLinkedOnSession(device: Device): boolean {
  if (device.status === 'live') return true;
  if (device.status !== 'connecting') return false;
  return Boolean(device.isOnline || device.connectionState === 'connected');
}

/** UI-facing connection phase (distinct from DB `DeviceStatus`). */
export type DeviceConnectionDisplay =
  | 'offline'
  | 'pairing'
  | 'connecting'
  | 'connected'
  | 'live';

export const DEVICE_CONNECTION_LABELS: Record<DeviceConnectionDisplay, string> = {
  offline: 'OFFLINE',
  pairing: 'PAIRING',
  connecting: 'CONNECTING',
  connected: 'CONNECTED',
  live: 'LIVE',
};

export interface DeviceConnectionDisplayOptions {
  presenceOnline?: boolean;
  /** True when preview has usable video (or full live picture). */
  hasActiveStream?: boolean;
  /** True when WHEP or mesh carries video — false for audio-only mesh bridge on Regal Cloud. */
  hasVideoStream?: boolean;
}

/**
 * Derive the operator-facing connection label for a paired device.
 * - pairing: slot paired, phone not on the session channel yet
 * - connecting: on channel, WebRTC / WHEP handshake in progress
 * - connected: linked on session, waiting for Go Live
 * - live: active feed on the mixer
 */
export function deriveDeviceConnectionDisplay(
  device: Device,
  options?: DeviceConnectionDisplayOptions,
): DeviceConnectionDisplay {
  if (device.status === 'error') return 'offline';

  if (options?.hasActiveStream) return 'live';

  if (isDeviceLinkedOnSession(device)) {
    const awaitingCloudVideo =
      Boolean(device.whepUrl?.trim()) && options?.hasVideoStream === false;
    if (awaitingCloudVideo) return 'connecting';
    return 'connected';
  }

  if (device.status === 'connecting') {
    const onChannel = options?.presenceOnline ?? device.isOnline;
    const peerNegotiating =
      device.connectionState === 'connecting' || device.connectionState === 'new';

    if (!onChannel && !peerNegotiating) return 'pairing';
    return 'connecting';
  }

  if (isRealDevice(device) && device.status === 'offline') return 'offline';

  return 'offline';
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
  const meshVideo = context.hasMeshVideo ?? false;
  const { presenceOnline, peerState, connectingSinceMs, videoTransport } = context;
  const cloudPlayback = deviceHasCloudPlayback(device, videoTransport);

  if (meshActive && (videoTransport === 'mesh' || meshVideo)) {
    return {
      ...device,
      status: 'live',
      isOnline: true,
      connectionState: 'connected',
      lastSeenAt: now,
    };
  }

  /** Regal Cloud: mesh audio bridge is linked — not live picture until WHEP or mesh video. */
  if (meshActive && cloudPlayback && !meshVideo) {
    return {
      ...device,
      status: 'connecting',
      isOnline: true,
      connectionState: peerState ?? 'connected',
      lastSeenAt: now,
    };
  }

  if (cloudPlayback && device.status === 'live') {
    return {
      ...device,
      status: 'live',
      isOnline: presenceOnline || device.isOnline,
      connectionState: 'connected',
      lastSeenAt: now,
    };
  }

  if (peerState === 'connected') {
    return {
      ...device,
      status: 'connecting',
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

  const staleLiveWithoutFeed =
    device.status === 'live' &&
    !meshActive &&
    !cloudPlayback &&
    !presenceOnline;

  if (heartbeatStale || connectingTimedOut || staleLiveWithoutFeed) {
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
