import type { StoredSession } from '../types/session';

export type SessionProduct = 'video' | 'audio';

const STORAGE_KEYS: Record<SessionProduct, string> = {
  video: 'cloudcast-session',
  audio: 'cloudcast-audio-session',
};

/** Video + Audio dashboards share one pairing session (same access code for CloudCast Mobile). */
export const PAIRING_SESSION_PRODUCT: SessionProduct = 'video';

export function getPairingSessionProduct(): SessionProduct {
  return PAIRING_SESSION_PRODUCT;
}

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
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy copy */
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
