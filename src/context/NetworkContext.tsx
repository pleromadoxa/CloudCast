import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

interface NetworkContextValue {
  /** Browser online flag (`navigator.onLine`). */
  isOnline: boolean;
  /** Increments each time connectivity is restored — use to trigger resume logic. */
  reconnectToken: number;
  /** Epoch ms when the current offline period started, or null when online. */
  offlineSince: number | null;
  /** True for a short window after returning online (UI “resuming…” state). */
  isRecovering: boolean;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

const RECOVERING_MS = 8_000;

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine,
  );
  const [reconnectToken, setReconnectToken] = useState(0);
  const [offlineSince, setOfflineSince] = useState<number | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const recoveringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markOnline = useCallback(() => {
    setIsOnline(true);
    setOfflineSince(null);
    setReconnectToken((n) => n + 1);
    setIsRecovering(true);
    if (recoveringTimerRef.current) clearTimeout(recoveringTimerRef.current);
    recoveringTimerRef.current = setTimeout(() => {
      setIsRecovering(false);
      recoveringTimerRef.current = null;
    }, RECOVERING_MS);
  }, []);

  const markOffline = useCallback(() => {
    setIsOnline(false);
    setOfflineSince((prev) => prev ?? Date.now());
    setIsRecovering(false);
    if (recoveringTimerRef.current) {
      clearTimeout(recoveringTimerRef.current);
      recoveringTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const onOnline = () => markOnline();
    const onOffline = () => markOffline();

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      if (recoveringTimerRef.current) clearTimeout(recoveringTimerRef.current);
    };
  }, [markOnline, markOffline]);

  return (
    <NetworkContext.Provider
      value={{ isOnline, reconnectToken, offlineSince, isRecovering }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error('useNetwork must be used within NetworkProvider');
  return ctx;
}

/** Safe when NetworkProvider may be absent (marketing pages). */
export function useNetworkOptional(): NetworkContextValue {
  const ctx = useContext(NetworkContext);
  return (
    ctx ?? {
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      reconnectToken: 0,
      offlineSince: null,
      isRecovering: false,
    }
  );
}
