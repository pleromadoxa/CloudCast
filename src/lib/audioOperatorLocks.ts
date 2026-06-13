import { getSupabase, isSupabaseConfigured } from './supabase';

export type AudioLockScope = 'console' | 'pgm' | 'scene';

export interface AudioOperatorLock {
  id: string;
  sessionId: string;
  operatorKey: string;
  operatorLabel: string | null;
  lockScope: AudioLockScope;
  sceneId: string | null;
  acquiredAt: string;
  expiresAt: string;
}

function mapLock(row: Record<string, unknown>): AudioOperatorLock {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    operatorKey: String(row.operator_key),
    operatorLabel: row.operator_label ? String(row.operator_label) : null,
    lockScope: String(row.lock_scope) as AudioLockScope,
    sceneId: row.scene_id ? String(row.scene_id) : null,
    acquiredAt: String(row.acquired_at),
    expiresAt: String(row.expires_at),
  };
}

export function getAudioOperatorKey(): string {
  const key = 'cloudcast-audio-operator-key';
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

export async function acquireAudioOperatorLock(
  sessionId: string,
  operatorKey: string,
  operatorLabel: string | null,
  lockScope: AudioLockScope,
  sceneId?: string | null,
): Promise<{ ok: boolean; lock?: AudioOperatorLock; holder?: AudioOperatorLock }> {
  if (!isSupabaseConfigured()) return { ok: true };

  const { data, error } = await getSupabase().rpc('acquire_audio_operator_lock', {
    p_session_id: sessionId,
    p_operator_key: operatorKey,
    p_operator_label: operatorLabel,
    p_lock_scope: lockScope,
    p_scene_id: sceneId ?? null,
  });
  if (error) throw new Error(error.message);

  const payload = (data ?? {}) as Record<string, unknown>;
  const ok = Boolean(payload.ok);
  const lockRaw = payload.lock as Record<string, unknown> | undefined;
  const lock = lockRaw ? mapLock(lockRaw) : undefined;
  return ok ? { ok: true, lock } : { ok: false, holder: lock };
}

export async function renewAudioOperatorLock(
  sessionId: string,
  operatorKey: string,
  lockScope: AudioLockScope,
  sceneId?: string | null,
): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;

  const { data, error } = await getSupabase().rpc('renew_audio_operator_lock', {
    p_session_id: sessionId,
    p_operator_key: operatorKey,
    p_lock_scope: lockScope,
    p_scene_id: sceneId ?? null,
  });
  if (error) return false;
  return Boolean(data);
}

export async function releaseAudioOperatorLock(
  sessionId: string,
  operatorKey: string,
  lockScope?: AudioLockScope,
  sceneId?: string | null,
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  await getSupabase().rpc('release_audio_operator_lock', {
    p_session_id: sessionId,
    p_operator_key: operatorKey,
    p_lock_scope: lockScope ?? null,
    p_scene_id: sceneId ?? null,
  });
}

export async function fetchAudioOperatorLocks(sessionId: string): Promise<AudioOperatorLock[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await getSupabase().rpc('list_audio_operator_locks', { p_session_id: sessionId });
  if (error) return [];
  return ((data ?? []) as Record<string, unknown>[]).map(mapLock);
}

export function isAudioLockHeldByOther(
  locks: AudioOperatorLock[],
  scope: AudioLockScope,
  operatorKey: string,
  sceneId?: string | null,
): AudioOperatorLock | null {
  const match = locks.find(
    (lock) =>
      lock.lockScope === scope &&
      lock.operatorKey !== operatorKey &&
      (scope !== 'scene' || lock.sceneId === sceneId),
  );
  return match ?? null;
}
