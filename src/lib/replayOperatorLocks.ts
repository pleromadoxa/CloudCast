import { getSupabase, isSupabaseConfigured } from './supabase';

export type ReplayLockScope = 'console' | 'pgm' | 'bank';

export interface ReplayOperatorLock {
  id: string;
  sessionId: string;
  operatorKey: string;
  operatorLabel: string | null;
  lockScope: ReplayLockScope;
  bankIndex: number | null;
  acquiredAt: string;
  expiresAt: string;
}

function mapLock(row: Record<string, unknown>): ReplayOperatorLock {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    operatorKey: String(row.operator_key),
    operatorLabel: row.operator_label ? String(row.operator_label) : null,
    lockScope: String(row.lock_scope) as ReplayLockScope,
    bankIndex: row.bank_index != null ? Number(row.bank_index) : null,
    acquiredAt: String(row.acquired_at),
    expiresAt: String(row.expires_at),
  };
}

export function getReplayOperatorKey(): string {
  const key = 'cloudcast-replay-operator-key';
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

export async function acquireReplayOperatorLock(
  sessionId: string,
  operatorKey: string,
  operatorLabel: string | null,
  lockScope: ReplayLockScope,
  bankIndex?: number | null,
): Promise<{ ok: boolean; lock?: ReplayOperatorLock; holder?: ReplayOperatorLock }> {
  if (!isSupabaseConfigured()) return { ok: true };

  const { data, error } = await getSupabase().rpc('acquire_replay_operator_lock', {
    p_session_id: sessionId,
    p_operator_key: operatorKey,
    p_operator_label: operatorLabel,
    p_lock_scope: lockScope,
    p_bank_index: bankIndex ?? null,
  });
  if (error) throw new Error(error.message);

  const payload = (data ?? {}) as Record<string, unknown>;
  const ok = Boolean(payload.ok);
  const lockRaw = payload.lock as Record<string, unknown> | undefined;
  const lock = lockRaw ? mapLock(lockRaw) : undefined;
  return ok ? { ok: true, lock } : { ok: false, holder: lock };
}

export async function renewReplayOperatorLock(
  sessionId: string,
  operatorKey: string,
  lockScope: ReplayLockScope,
  bankIndex?: number | null,
): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;

  const { data, error } = await getSupabase().rpc('renew_replay_operator_lock', {
    p_session_id: sessionId,
    p_operator_key: operatorKey,
    p_lock_scope: lockScope,
    p_bank_index: bankIndex ?? null,
  });
  if (error) return false;
  return Boolean(data);
}

export async function releaseReplayOperatorLock(
  sessionId: string,
  operatorKey: string,
  lockScope?: ReplayLockScope,
  bankIndex?: number | null,
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  await getSupabase().rpc('release_replay_operator_lock', {
    p_session_id: sessionId,
    p_operator_key: operatorKey,
    p_lock_scope: lockScope ?? null,
    p_bank_index: bankIndex ?? null,
  });
}

export async function fetchReplayOperatorLocks(sessionId: string): Promise<ReplayOperatorLock[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await getSupabase().rpc('list_replay_operator_locks', {
    p_session_id: sessionId,
  });
  if (error) return [];
  return ((data ?? []) as Record<string, unknown>[]).map(mapLock);
}

export function isLockHeldByOther(
  locks: ReplayOperatorLock[],
  scope: ReplayLockScope,
  operatorKey: string,
  bankIndex?: number | null,
): ReplayOperatorLock | null {
  const match = locks.find(
    (lock) =>
      lock.lockScope === scope &&
      lock.operatorKey !== operatorKey &&
      (scope !== 'bank' || lock.bankIndex === bankIndex),
  );
  return match ?? null;
}

export function holdsLock(
  locks: ReplayOperatorLock[],
  scope: ReplayLockScope,
  operatorKey: string,
  bankIndex?: number | null,
): boolean {
  return locks.some(
    (lock) =>
      lock.lockScope === scope &&
      lock.operatorKey === operatorKey &&
      (scope !== 'bank' || lock.bankIndex === bankIndex),
  );
}
