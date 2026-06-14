import type { UserProfile } from '../types/plans';

const KEY = 'cloudcast-profile-v1';

interface CachedProfileRow {
  userId: string;
  profile: UserProfile;
}

export function readCachedProfile(userId: string): UserProfile | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedProfileRow;
    if (parsed.userId !== userId) return null;
    return parsed.profile;
  } catch {
    return null;
  }
}

export function writeCachedProfile(userId: string, profile: UserProfile): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ userId, profile }));
  } catch {
    /* quota / private mode */
  }
}

export function clearCachedProfile(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
