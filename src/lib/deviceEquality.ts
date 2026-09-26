import type { Device } from '../types/device';

const CONNECTIVITY_FIELDS = [
  'status',
  'isOnline',
  'connectionState',
  'lastSeenAt',
  'whepUrl',
  'streamId',
  'updatedAt',
] as const satisfies readonly (keyof Device)[];

/** Shallow compare for presence reconciliation — skip React state when unchanged. */
export function deviceConnectivityEqual(a: Device, b: Device): boolean {
  if (a.deviceId !== b.deviceId || a.slotNumber !== b.slotNumber) return false;
  for (const key of CONNECTIVITY_FIELDS) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

export function devicesConnectivityEqual(prev: Device[], next: Device[]): boolean {
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    if (!deviceConnectivityEqual(prev[i], next[i])) return false;
  }
  return true;
}
