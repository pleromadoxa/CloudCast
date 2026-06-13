import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import type { ReplayPushRequest, ReplayRundownItem } from '../types/replay';

export type DisplayRouteTarget = 'pst' | 'pgm';

interface ProductionContextValue {
  /** True while PGM output is actively streaming (ON AIR). */
  isOnAir: boolean;
  setProductionOnAir: (onAir: boolean) => void;
  /** Audio console was opened this session — keeps mixer engine alive off-route. */
  audioConsoleActive: boolean;
  setAudioConsoleActive: (active: boolean) => void;
  /** Replay console was opened this session — keeps buffer alive off-route. */
  replayConsoleActive: boolean;
  setReplayConsoleActive: (active: boolean) => void;
  /** Clip currently on the video mixer PGM bus. */
  replayPush: ReplayPushRequest | null;
  /** Clips queued after the current PGM replay take. */
  replayRundownRemaining: ReplayRundownItem[];
  pushReplayToPgm: (clip: ReplayPushRequest) => void;
  playReplayRundown: (items: ReplayRundownItem[]) => void;
  /** Advance to the next rundown item; clears PGM when queue is empty. */
  advanceReplayRundown: () => ReplayRundownItem | null;
  clearReplayPush: () => void;
  clearReplayRundown: () => void;
  /** Request routing Display Feed to PST or PGM on the video mixer. */
  displayRouteRequest: DisplayRouteTarget | null;
  requestDisplayRoute: (target: DisplayRouteTarget) => void;
  clearDisplayRoute: () => void;
}

const ProductionContext = createContext<ProductionContextValue | null>(null);

export function ProductionProvider({ children }: { children: ReactNode }) {
  const [isOnAir, setIsOnAir] = useState(false);
  const [audioConsoleActive, setAudioConsoleActive] = useState(false);
  const [replayConsoleActive, setReplayConsoleActive] = useState(false);
  const [replayPush, setReplayPush] = useState<ReplayPushRequest | null>(null);
  const [replayRundownRemaining, setReplayRundownRemaining] = useState<ReplayRundownItem[]>([]);
  const rundownRef = useRef<ReplayRundownItem[]>([]);
  const [displayRouteRequest, setDisplayRouteRequest] = useState<DisplayRouteTarget | null>(null);

  const syncRundownRef = useCallback((items: ReplayRundownItem[]) => {
    rundownRef.current = items;
    setReplayRundownRemaining(items);
  }, []);

  const setProductionOnAir = useCallback((onAir: boolean) => {
    setIsOnAir(onAir);
  }, []);

  const pushReplayToPgm = useCallback((clip: ReplayPushRequest) => {
    syncRundownRef([]);
    setReplayPush(clip);
  }, [syncRundownRef]);

  const playReplayRundown = useCallback((items: ReplayRundownItem[]) => {
    if (items.length === 0) return;
    setReplayPush(items[0]!);
    syncRundownRef(items.slice(1));
  }, [syncRundownRef]);

  const advanceReplayRundown = useCallback((): ReplayRundownItem | null => {
    const remaining = rundownRef.current;
    if (remaining.length === 0) {
      setReplayPush(null);
      syncRundownRef([]);
      return null;
    }
    const [next, ...rest] = remaining;
    setReplayPush(next);
    syncRundownRef(rest);
    return next;
  }, [syncRundownRef]);

  const clearReplayPush = useCallback(() => {
    setReplayPush(null);
  }, []);

  const clearReplayRundown = useCallback(() => {
    setReplayPush(null);
    syncRundownRef([]);
  }, [syncRundownRef]);

  const requestDisplayRoute = useCallback((target: DisplayRouteTarget) => {
    setDisplayRouteRequest(target);
  }, []);

  const clearDisplayRoute = useCallback(() => {
    setDisplayRouteRequest(null);
  }, []);

  return (
    <ProductionContext.Provider
      value={{
        isOnAir,
        setProductionOnAir,
        audioConsoleActive,
        setAudioConsoleActive,
        replayConsoleActive,
        setReplayConsoleActive,
        replayPush,
        replayRundownRemaining,
        pushReplayToPgm,
        playReplayRundown,
        advanceReplayRundown,
        clearReplayPush,
        clearReplayRundown,
        displayRouteRequest,
        requestDisplayRoute,
        clearDisplayRoute,
      }}
    >
      {children}
    </ProductionContext.Provider>
  );
}

export function useProduction() {
  const ctx = useContext(ProductionContext);
  if (!ctx) throw new Error('useProduction must be used within ProductionProvider');
  return ctx;
}
