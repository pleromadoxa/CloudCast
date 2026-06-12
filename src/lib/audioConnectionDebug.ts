import type { ConnectionMode } from '../types/plans';
import type { Device } from '../types/device';
import { isMeshStreamPresent } from './deviceConnection';
import { hasUsableAudio } from './streamAudioHub';
import type { WhepPoolSnapshot } from './whepStreamPool';

export type IngressPath = 'mesh' | 'whep' | 'pending' | 'none';

export interface TrackSummary {
  kind: string;
  readyState: string;
  enabled: boolean;
  muted: boolean;
}

export interface DeviceConnectionDebugRow {
  deviceId: string;
  label: string;
  status: Device['status'];
  role: string;
  platform: string;
  expectedIngress: IngressPath;
  whepConfigured: boolean;
  whepState: string | null;
  whepError: string | null;
  peerState: string | null;
  streamInMap: boolean;
  usableAudio: boolean;
  audioTracks: number;
  videoTracks: number;
  tracks: TrackSummary[];
}

export function summarizeTracks(stream: MediaStream | null | undefined): TrackSummary[] {
  if (!stream) return [];
  return stream.getTracks().map((track) => ({
    kind: track.kind,
    readyState: track.readyState,
    enabled: track.enabled,
    muted: track.muted,
  }));
}

export function resolveExpectedIngress(
  connectionMode: ConnectionMode,
  device: Device,
): IngressPath {
  if (device.status === 'offline') return 'none';
  if (connectionMode === 'mesh') return 'mesh';
  if (device.whepUrl) return 'whep';
  return 'pending';
}

export function buildDeviceConnectionDebugRow(
  device: Device,
  connectionMode: ConnectionMode,
  stream: MediaStream | null,
  whepSnap: WhepPoolSnapshot | null,
): DeviceConnectionDebugRow {
  const audioTracks = stream?.getAudioTracks() ?? [];
  const videoTracks = stream?.getVideoTracks() ?? [];

  return {
    deviceId: device.deviceId,
    label: device.label,
    status: device.status,
    role: device.deviceRole ?? 'video',
    platform: device.platform,
    expectedIngress: resolveExpectedIngress(connectionMode, device),
    whepConfigured: Boolean(device.whepUrl),
    whepState: whepSnap?.connectionState ?? null,
    whepError: whepSnap?.error ?? null,
    peerState: device.connectionState ?? null,
    streamInMap: isMeshStreamPresent(stream),
    usableAudio: hasUsableAudio(stream),
    audioTracks: audioTracks.length,
    videoTracks: videoTracks.length,
    tracks: summarizeTracks(stream),
  };
}

export function formatConnectionDebugSnapshot(payload: {
  connectionMode: ConnectionMode;
  sessionId: string | null;
  accessCode: string | null;
  isPresenceConnected: boolean;
  isSignalingConnected: boolean;
  isSignalingLeader: boolean;
  devices: DeviceConnectionDebugRow[];
}): string {
  return JSON.stringify(
    {
      capturedAt: new Date().toISOString(),
      ...payload,
    },
    null,
    2,
  );
}
