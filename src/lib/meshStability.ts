/** Mesh WebRTC stability tuning — multi-device signaling and recovery. */

export const MESH_REOFFER_GLOBAL_COOLDOWN_MS = 800;
export const MESH_REOFFER_PER_DEVICE_COOLDOWN_MS = 2_500;
export const MESH_CONNECTED_NO_MEDIA_GRACE_MS = 4_000;
export const MESH_DEVICE_STAGGER_MAX_MS = 2_400;
export const MESH_REJOIN_RETRY_MS = [0, 600, 1_500, 3_500, 7_000, 12_000] as const;
export const MESH_MAX_CONCURRENT_ANSWERS = 6;
export const MESH_ICE_GATHER_TIMEOUT_MS = 5_000;
export const MESH_PEER_FAILED_REOFFER_MS = 2_500;
export const MESH_HEALTH_SWEEP_MS = 6_000;
export const MESH_ICE_RESTART_DELAY_MS = 500;
export const MESH_PEER_DISCONNECT_GRACE_MS = 8_000;

export function meshReofferStaggerMs(deviceId: string, deviceCount: number): number {
  const spread = Math.min(Math.max(deviceCount, 1) * 280, MESH_DEVICE_STAGGER_MAX_MS);
  let hash = 0;
  for (let i = 0; i < deviceId.length; i += 1) {
    hash = (hash * 31 + deviceId.charCodeAt(i)) >>> 0;
  }
  return hash % spread;
}
