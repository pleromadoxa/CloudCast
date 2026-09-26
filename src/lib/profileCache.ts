import type { UserProfile } from '../types/plans';

const KEY = 'cloudcast-profile-v3';
const LEGACY_KEYS = ['cloudcast-profile-v2', 'cloudcast-profile-v1'] as const;

interface CachedProfileRow {
  userId: string;
  profile: UserProfile;
}

function readRow(): CachedProfileRow | null {
  for (const storage of [sessionStorage, localStorage]) {
    try {
      const raw = storage.getItem(KEY);
      if (!raw) continue;
      return JSON.parse(raw) as CachedProfileRow;
    } catch {
      /* try next storage */
    }
  }
  // Drop legacy caches so stale paid entitlements are not trusted after billing pause.
  for (const storage of [sessionStorage, localStorage]) {
    for (const key of LEGACY_KEYS) {
      try {
        storage.removeItem(key);
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}

export function readCachedProfile(userId: string): UserProfile | null {
  try {
    const parsed = readRow();
    if (!parsed || parsed.userId !== userId) return null;
    return parsed.profile;
  } catch {
    return null;
  }
}

export function writeCachedProfile(userId: string, profile: UserProfile): void {
  const row = JSON.stringify({ userId, profile } satisfies CachedProfileRow);
  for (const storage of [sessionStorage, localStorage]) {
    try {
      storage.setItem(KEY, row);
    } catch {
      /* quota / private mode */
    }
  }
}

export function clearCachedProfile(): void {
  for (const storage of [sessionStorage, localStorage]) {
    try {
      storage.removeItem(KEY);
      for (const key of LEGACY_KEYS) storage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}
