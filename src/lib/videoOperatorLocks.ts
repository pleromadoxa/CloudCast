import { getSupabase, isSupabaseConfigured } from './supabase';

export type VideoLockScope = 'console' | 'pgm';

export interface VideoOperatorLock {
  id: string;
  sessionId: string;
  operatorKey: string;
  operatorLabel: string | null;
  lockScope: VideoLockScope;
  acquiredAt: string;
  expiresAt: string;
}

function mapLock(row: Record<string, unknown>): VideoOperatorLock {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    operatorKey: String(row.operator_key),
    operatorLabel: row.operator_label ? String(row.operator_label) : null,
    lockScope: String(row.lock_scope) as VideoLockScope,
    acquiredAt: String(row.acquired_at),
    expiresAt: String(row.expires_at),
  };
}

export function getVideoOperatorKey(): string {
  const key = 'cloudcast-video-operator-key';
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const next = crypto.randomUUID();
    sessionStorage.setItem(key, next);
    return next;
  } catch {
    return crypto.randomUUID();
  }
}

export async function acquireVideoOperatorLock(
  sessionId: string,
  operatorKey: string,
  operatorLabel: string | null,
  lockScope: VideoLockScope,
): Promise<{ ok: boolean; lock?: VideoOperatorLock; holder?: VideoOperatorLock }> {
  if (!isSupabaseConfigured()) return { ok: true };

  const { data, error } = await getSupabase().rpc('acquire_video_operator_lock', {
    p_session_id: sessionId,
    p_operator_key: operatorKey,
    p_operator_label: operatorLabel,
    p_lock_scope: lockScope,
  });
  if (error) throw new Error(error.message);

  const payload = (data ?? {}) as Record<string, unknown>;
  const ok = Boolean(payload.ok);
  const lockRaw = payload.lock as Record<string, unknown> | undefined;
  const lock = lockRaw ? mapLock(lockRaw) : undefined;
  return ok ? { ok: true, lock } : { ok: false, holder: lock };
}

export async function renewVideoOperatorLock(
  sessionId: string,
  operatorKey: string,
  lockScope: VideoLockScope,
): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;

  const { data, error } = await getSupabase().rpc('renew_video_operator_lock', {
    p_session_id: sessionId,
    p_operator_key: operatorKey,
    p_lock_scope: lockScope,
  });
  if (error) return false;
  return Boolean(data);
}

export async function releaseVideoOperatorLock(
  sessionId: string,
  operatorKey: string,
  lockScope?: VideoLockScope,
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  await getSupabase().rpc('release_video_operator_lock', {
    p_session_id: sessionId,
    p_operator_key: operatorKey,
    p_lock_scope: lockScope ?? null,
  });
}

export async function fetchVideoOperatorLocks(sessionId: string): Promise<VideoOperatorLock[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await getSupabase().rpc('list_video_operator_locks', { p_session_id: sessionId });
  if (error) return [];
  return ((data ?? []) as Record<string, unknown>[]).map(mapLock);
}

export function isVideoLockHeldByOther(
  locks: VideoOperatorLock[],
  scope: VideoLockScope,
  operatorKey: string,
): VideoOperatorLock | null {
  const match = locks.find((lock) => lock.lockScope === scope && lock.operatorKey !== operatorKey);
  return match ?? null;
}
