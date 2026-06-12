import type { DeviceStatus } from './device';
import type { ConnectionMode, PlanTier } from './plans';

export interface MixerSession {
  sessionId: string;
  accessCode: string;
  maxDevices: number;
  maxMobileDevices: number;
  maxUsbDevices: number;
  planId: PlanTier;
  planName?: string;
  connectionMode: ConnectionMode;
  realtimeChannel: string;
  deviceCount: number;
  expiresAt?: string;
  createdAt?: string;
}

export interface PairedDeviceRow {
  id: string;
  session_id: string;
  device_id: string;
  slot_number: number;
  label: string;
  platform: 'ios' | 'android' | 'usb' | 'unknown';
  device_type: 'mobile' | 'usb';
  device_role?: 'video' | 'audio';
  audio_source?: 'camera' | 'capture_card' | 'usb_audio';
  linked_audio_device_id?: string | null;
  whep_url: string | null;
  whip_url: string | null;
  stream_id: string | null;
  status: DeviceStatus;
  battery_level: number | null;
  network_type: string | null;
  paired_at: string;
  last_seen_at: string;
  updated_at: string;
}

export interface StoredSession {
  sessionId: string;
  accessCode: string;
  /** Auth user id — prevents restoring another user's session on shared browsers. */
  ownerId?: string;
}
