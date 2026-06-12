import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { probeCloudCastReachability } from '../lib/reachability';

interface NetworkContextValue {
  /** True when the CloudCast backend is reachable (not just `navigator.onLine`). */
  isOnline: boolean;
  /** Increments each time connectivity is restored — use to trigger resume logic. */
  reconnectToken: number;
  /** Epoch ms when the current offline period started, or null when online. */
  offlineSince: number | null;
  /** True for a short window after returning online (UI “resuming…” state). */
  isRecovering: boolean;
  /** Re-run reachability probe (banner “Check again”). */
  recheckConnectivity: () => Promise<boolean>;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

const RECOVERING_MS = 8_000;
const PROBE_INTERVAL_MS = 15_000;
const OFFLINE_DEBOUNCE_MS = 2_500;
const OFFLINE_FAIL_THRESHOLD = 2;

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine,
  );
  const [reconnectToken, setReconnectToken] = useState(0);
  const [offlineSince, setOfflineSince] = useState<number | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);

  const isOnlineRef = useRef(isOnline);
  isOnlineRef.current = isOnline;

  const recoveringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offlineDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const probeFailStreakRef = useRef(0);
  const probingRef = useRef(false);

  const markOnline = useCallback(() => {
    const wasOffline = !isOnlineRef.current;
    probeFailStreakRef.current = 0;
    setIsOnline(true);
    setOfflineSince(null);
    if (!wasOffline) return;

    setReconnectToken((n) => n + 1);
    setIsRecovering(true);
    if (recoveringTimerRef.current) clearTimeout(recoveringTimerRef.current);
    recoveringTimerRef.current = setTimeout(() => {
      setIsRecovering(false);
      recoveringTimerRef.current = null;
    }, RECOVERING_MS);
  }, []);

  const markOffline = useCallback(() => {
    if (isOnlineRef.current) {
      setOfflineSince(Date.now());
    }
    setIsOnline(false);
    setIsRecovering(false);
    if (recoveringTimerRef.current) {
      clearTimeout(recoveringTimerRef.current);
      recoveringTimerRef.current = null;
    }
  }, []);

  const runProbe = useCallback(async (): Promise<boolean> => {
    if (probingRef.current) return isOnlineRef.current;
    probingRef.current = true;
    try {
      const reachable = await probeCloudCastReachability();
      if (reachable) {
        markOnline();
        return true;
      }
      probeFailStreakRef.current += 1;
      if (
        probeFailStreakRef.current >= OFFLINE_FAIL_THRESHOLD ||
        (typeof navigator !== 'undefined' && !navigator.onLine)
      ) {
        markOffline();
      }
      return false;
    } finally {
      probingRef.current = false;
    }
  }, [markOnline, markOffline]);

  const recheckConnectivity = useCallback(async () => {
    probeFailStreakRef.current = 0;
    return runProbe();
  }, [runProbe]);

  useEffect(() => {
    void runProbe();

    const interval = window.setInterval(() => {
      void runProbe();
    }, PROBE_INTERVAL_MS);

    const onOnline = () => {
      if (offlineDebounceRef.current) {
        clearTimeout(offlineDebounceRef.current);
        offlineDebounceRef.current = null;
      }
      probeFailStreakRef.current = 0;
      void runProbe();
    };

    const onOffline = () => {
      if (offlineDebounceRef.current) clearTimeout(offlineDebounceRef.current);
      offlineDebounceRef.current = setTimeout(() => {
        offlineDebounceRef.current = null;
        void runProbe();
      }, OFFLINE_DEBOUNCE_MS);
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      if (recoveringTimerRef.current) clearTimeout(recoveringTimerRef.current);
      if (offlineDebounceRef.current) clearTimeout(offlineDebounceRef.current);
    };
  }, [runProbe]);

  return (
    <NetworkContext.Provider
      value={{ isOnline, reconnectToken, offlineSince, isRecovering, recheckConnectivity }}
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
      recheckConnectivity: async () => true,
    }
  );
}
