import type { IpCameraConfig } from '../types/ipCamera';

const STORAGE_KEY = 'cloudcast-ip-camera';

export function loadIpCameraConfig(sessionId: string): IpCameraConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IpCameraConfig;
    if (parsed.sessionId !== sessionId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveIpCameraConfig(config: IpCameraConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    /* quota */
  }
}

export function clearIpCameraConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
