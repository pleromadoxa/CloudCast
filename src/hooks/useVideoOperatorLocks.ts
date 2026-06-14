import { useCallback, useEffect, useRef, useState } from 'react';
import {
  acquireVideoOperatorLock,
  fetchVideoOperatorLocks,
  getVideoOperatorKey,
  releaseVideoOperatorLock,
  renewVideoOperatorLock,
  type VideoLockScope,
  type VideoOperatorLock,
} from '../lib/videoOperatorLocks';

interface UseVideoOperatorLocksOptions {
  sessionId: string | null | undefined;
  operatorLabel: string | null;
  enabled: boolean;
}

export function useVideoOperatorLocks({
  sessionId,
  operatorLabel,
  enabled,
}: UseVideoOperatorLocksOptions) {
  const operatorKeyRef = useRef(getVideoOperatorKey());
  const [locks, setLocks] = useState<VideoOperatorLock[]>([]);
  const [consoleHeld, setConsoleHeld] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [blockingHolder, setBlockingHolder] = useState<VideoOperatorLock | null>(null);

  const refresh = useCallback(async () => {
    if (!sessionId || !enabled) {
      setLocks([]);
      return;
    }
    setLocks(await fetchVideoOperatorLocks(sessionId));
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
      try {
        const result = await acquireVideoOperatorLock(
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
      } catch {
        if (cancelled) return;
        setConsoleHeld(true);
        setReadOnly(false);
        setBlockingHolder(null);
      }
    })();

    return () => {
      cancelled = true;
      void releaseVideoOperatorLock(sessionId, operatorKeyRef.current, 'console');
    };
  }, [enabled, sessionId, operatorLabel, refresh]);

  useEffect(() => {
    if (!enabled || !sessionId || !consoleHeld) return;

    const renewTimer = window.setInterval(() => {
      void renewVideoOperatorLock(sessionId, operatorKeyRef.current, 'console');
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
    async (scope: VideoLockScope) => {
      if (!sessionId || readOnly) return { ok: false as const, holder: blockingHolder };
      return acquireVideoOperatorLock(sessionId, operatorKeyRef.current, operatorLabel, scope);
    },
    [sessionId, readOnly, blockingHolder, operatorLabel],
  );

  return {
    operatorKey: operatorKeyRef.current,
    locks,
    consoleHeld,
    readOnly,
    blockingHolder,
    tryAcquireScope,
    refreshLocks: refresh,
  };
}
