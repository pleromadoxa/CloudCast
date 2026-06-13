import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  acquireReplayOperatorLock,
  fetchReplayOperatorLocks,
  getReplayOperatorKey,
  holdsLock,
  isLockHeldByOther,
  releaseReplayOperatorLock,
  renewReplayOperatorLock,
  type ReplayLockScope,
  type ReplayOperatorLock,
} from '../lib/replayOperatorLocks';

interface UseReplayOperatorLocksOptions {
  sessionId: string | null | undefined;
  operatorLabel: string | null;
  enabled: boolean;
}

export function useReplayOperatorLocks({
  sessionId,
  operatorLabel,
  enabled,
}: UseReplayOperatorLocksOptions) {
  const operatorKeyRef = useRef(getReplayOperatorKey());
  const [locks, setLocks] = useState<ReplayOperatorLock[]>([]);
  const [consoleHeld, setConsoleHeld] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [blockingHolder, setBlockingHolder] = useState<ReplayOperatorLock | null>(null);

  const refresh = useCallback(async () => {
    if (!sessionId || !enabled) {
      setLocks([]);
      return;
    }
    const rows = await fetchReplayOperatorLocks(sessionId);
    setLocks(rows);
  }, [sessionId, enabled]);

  useEffect(() => {
    if (!enabled || !sessionId) {
      setConsoleHeld(false);
      setReadOnly(false);
      setBlockingHolder(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      const result = await acquireReplayOperatorLock(
        sessionId,
        operatorKeyRef.current,
        operatorLabel,
        'console',
      );
      if (cancelled) return;
      if (result.ok) {
        setConsoleHeld(true);
        setReadOnly(false);
        setBlockingHolder(null);
      } else {
        setConsoleHeld(false);
        setReadOnly(true);
        setBlockingHolder(result.holder ?? null);
      }
      await refresh();
    })();

    return () => {
      cancelled = true;
      void releaseReplayOperatorLock(sessionId, operatorKeyRef.current, 'console');
    };
  }, [enabled, sessionId, operatorLabel, refresh]);

  useEffect(() => {
    if (!enabled || !sessionId || !consoleHeld) return;

    const renewTimer = window.setInterval(() => {
      void renewReplayOperatorLock(sessionId, operatorKeyRef.current, 'console');
    }, 15_000);

    const pollTimer = window.setInterval(() => {
      void refresh();
    }, 5_000);

    return () => {
      window.clearInterval(renewTimer);
      window.clearInterval(pollTimer);
    };
  }, [enabled, sessionId, consoleHeld, refresh]);

  const tryAcquireScope = useCallback(
    async (scope: ReplayLockScope, bankIndex?: number | null) => {
      if (!sessionId || readOnly) return { ok: false as const, holder: blockingHolder };
      const result = await acquireReplayOperatorLock(
        sessionId,
        operatorKeyRef.current,
        operatorLabel,
        scope,
        bankIndex,
      );
      await refresh();
      return result;
    },
    [sessionId, readOnly, blockingHolder, operatorLabel, refresh],
  );

  const releaseScope = useCallback(
    async (scope: ReplayLockScope, bankIndex?: number | null) => {
      if (!sessionId) return;
      await releaseReplayOperatorLock(sessionId, operatorKeyRef.current, scope, bankIndex);
      await refresh();
    },
    [sessionId, refresh],
  );

  const pgmBlockedBy = useMemo(
    () => isLockHeldByOther(locks, 'pgm', operatorKeyRef.current),
    [locks],
  );

  const holdsPgmLock = useMemo(
    () => holdsLock(locks, 'pgm', operatorKeyRef.current),
    [locks],
  );

  return {
    operatorKey: operatorKeyRef.current,
    locks,
    consoleHeld,
    readOnly,
    blockingHolder,
    pgmBlockedBy,
    holdsPgmLock,
    tryAcquireScope,
    releaseScope,
    refreshLocks: refresh,
  };
}
