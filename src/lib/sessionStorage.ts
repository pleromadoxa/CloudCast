import type { StoredSession } from '../types/session';

export type SessionProduct = 'video' | 'audio';

const STORAGE_KEYS: Record<SessionProduct, string> = {
  video: 'cloudcast-session',
  audio: 'cloudcast-audio-session',
};

function storageKey(product: SessionProduct = 'video'): string {
  return STORAGE_KEYS[product];
}

export function loadStoredSession(product: SessionProduct = 'video'): StoredSession | null {
  try {
    const raw = localStorage.getItem(storageKey(product));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (parsed.sessionId && parsed.accessCode) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function saveStoredSession(session: StoredSession, product: SessionProduct = 'video'): void {
  localStorage.setItem(storageKey(product), JSON.stringify(session));
}

export function clearStoredSession(product: SessionProduct = 'video'): void {
  localStorage.removeItem(storageKey(product));
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
