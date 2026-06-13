import { useCallback, useEffect, useRef, useState } from 'react';
import {
  acquireAudioOperatorLock,
  fetchAudioOperatorLocks,
  getAudioOperatorKey,
  releaseAudioOperatorLock,
  renewAudioOperatorLock,
  type AudioLockScope,
  type AudioOperatorLock,
} from '../lib/audioOperatorLocks';

interface UseAudioOperatorLocksOptions {
  sessionId: string | null | undefined;
  operatorLabel: string | null;
  enabled: boolean;
}

export function useAudioOperatorLocks({
  sessionId,
  operatorLabel,
  enabled,
}: UseAudioOperatorLocksOptions) {
  const operatorKeyRef = useRef(getAudioOperatorKey());
  const [locks, setLocks] = useState<AudioOperatorLock[]>([]);
  const [consoleHeld, setConsoleHeld] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [blockingHolder, setBlockingHolder] = useState<AudioOperatorLock | null>(null);

  const refresh = useCallback(async () => {
    if (!sessionId || !enabled) {
      setLocks([]);
      return;
    }
    setLocks(await fetchAudioOperatorLocks(sessionId));
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
      const result = await acquireAudioOperatorLock(
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
      void releaseAudioOperatorLock(sessionId, operatorKeyRef.current, 'console');
    };
  }, [enabled, sessionId, operatorLabel, refresh]);

  useEffect(() => {
    if (!enabled || !sessionId || !consoleHeld) return;

    const renewTimer = window.setInterval(() => {
      void renewAudioOperatorLock(sessionId, operatorKeyRef.current, 'console');
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
    async (scope: AudioLockScope, sceneId?: string | null) => {
      if (!sessionId || readOnly) return { ok: false as const, holder: blockingHolder };
      return acquireAudioOperatorLock(
        sessionId,
        operatorKeyRef.current,
        operatorLabel,
        scope,
        sceneId,
      );
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
