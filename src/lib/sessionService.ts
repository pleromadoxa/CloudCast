import { getSupabase } from './supabase';
import type { PlanTier } from '../types/plans';
import { normalizeConnectionMode } from './branding';
import { resolveRealtimeChannelName } from './realtimeChannel';
import type { DeviceStatus } from '../types/device';
import type { MixerSession, PairedDeviceRow } from '../types/session';

function mapSession(data: Record<string, unknown>): MixerSession {
  const sessionId = String(data.session_id ?? '');
  return {
    sessionId,
    accessCode: String(data.access_code),
    maxDevices: Number(data.max_devices ?? 2),
    maxMobileDevices: Number(data.max_mobile_devices ?? 2),
    maxUsbDevices: Number(data.max_usb_devices ?? 0),
    planId: (data.plan_id as PlanTier) ?? 'free',
    planName: data.plan_name ? String(data.plan_name) : undefined,
    connectionMode: normalizeConnectionMode(data.connection_mode as string),
    realtimeChannel: resolveRealtimeChannelName(sessionId, String(data.realtime_channel ?? '')),
    deviceCount: Number(data.device_count ?? 0),
    expiresAt: data.expires_at ? String(data.expires_at) : undefined,
    createdAt: data.created_at ? String(data.created_at) : undefined,
  };
}

export async function createMixerSession(): Promise<MixerSession> {
  const { data, error } = await getSupabase().rpc('create_mixer_session');
  if (error) throw new Error(error.message);
  return mapSession(data as Record<string, unknown>);
}

/** Returns the user's active session or creates one with a globally unique access code. */
export async function getOrCreateOwnerSession(): Promise<MixerSession> {
  const { data, error } = await getSupabase().rpc('get_or_create_owner_session');
  if (error) throw new Error(error.message);
  return mapSession(data as Record<string, unknown>);
}

/** @deprecated Audio mixer uses the shared owner session — same access code as Video Mixer. */
export async function getOrCreateAudioOwnerSession(): Promise<MixerSession> {
  return getOrCreateOwnerSession();
}

export async function linkVideoToAudioBridge(
  videoSessionId: string,
  bridgeCode: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await getSupabase().rpc('link_video_to_audio_bridge', {
    p_video_session_id: videoSessionId,
    p_bridge_code: bridgeCode.trim().toUpperCase(),
  });
  if (error) throw new Error(error.message);
  return (data ?? {}) as Record<string, unknown>;
}

export async function restoreMixerSession(
  sessionId: string,
  accessCode: string,
): Promise<MixerSession> {
  const { data, error } = await getSupabase().rpc('get_mixer_session_by_id', {
    p_session_id: sessionId,
    p_access_code: accessCode,
  });
  if (error) throw new Error(error.message);
  return mapSession(data as Record<string, unknown>);
}

/** Align session device limits with the authenticated owner's current plan. */
export async function syncMixerSessionPlan(
  sessionId: string,
  accessCode: string,
): Promise<MixerSession> {
  const { data, error } = await getSupabase().rpc('sync_mixer_session_plan', {
    p_session_id: sessionId,
    p_access_code: accessCode,
  });
  if (error) throw new Error(error.message);
  return mapSession(data as Record<string, unknown>);
}

export async function regenerateAccessCode(
  sessionId: string,
  currentAccessCode: string,
): Promise<MixerSession> {
  const { data, error } = await getSupabase().rpc('regenerate_access_code', {
    p_session_id: sessionId,
    p_current_access_code: currentAccessCode,
  });
  if (error) throw new Error(error.message);
  return mapSession(data as Record<string, unknown>);
}

export async function fetchPairedDevices(
  sessionId: string,
  accessCode: string,
): Promise<PairedDeviceRow[]> {
  const { data, error } = await getSupabase().rpc('list_paired_devices_by_session', {
    p_session_id: sessionId,
    p_access_code: accessCode,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as PairedDeviceRow[];
}

export function pairedRowToDevice(row: PairedDeviceRow) {
  return {
    deviceId: row.device_id,
    slotNumber: row.slot_number,
    label: row.label,
    platform: row.platform,
    deviceType: row.device_type ?? 'mobile',
    deviceRole: row.device_role ?? 'video',
    audioSource: row.audio_source ?? 'camera',
    linkedAudioDeviceId: row.linked_audio_device_id ?? null,
    whepUrl: row.whep_url ?? '',
    streamId: row.stream_id ?? '',
    status: row.status,
    batteryLevel: row.battery_level ?? undefined,
    networkType: row.network_type ?? undefined,
    updatedAt: row.updated_at,
    isOnline: row.status === 'live' || row.status === 'connecting',
    lastSeenAt: row.last_seen_at,
  };
}

export { resolveRealtimeChannelName, sessionChannel } from './realtimeChannel';

export async function updatePairedDeviceStatus(
  accessCode: string,
  deviceId: string,
  status: DeviceStatus,
): Promise<void> {
  const { error } = await getSupabase().rpc('update_paired_device', {
    p_access_code: accessCode,
    p_device_id: deviceId,
    p_status: status,
  });
  if (error) throw new Error(error.message);
}

export async function unpairDevice(accessCode: string, deviceId: string): Promise<void> {
  const { error } = await getSupabase().rpc('unpair_device', {
    p_access_code: accessCode,
    p_device_id: deviceId,
  });
  if (error) throw new Error(error.message);
}
