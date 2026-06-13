import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { ReplayPushRequest } from '../types/replay';

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
  /** Clip queued for instant replay on the video mixer PGM bus. */
  replayPush: ReplayPushRequest | null;
  pushReplayToPgm: (clip: ReplayPushRequest) => void;
  clearReplayPush: () => void;
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
  const [displayRouteRequest, setDisplayRouteRequest] = useState<DisplayRouteTarget | null>(null);

  const setProductionOnAir = useCallback((onAir: boolean) => {
    setIsOnAir(onAir);
  }, []);

  const pushReplayToPgm = useCallback((clip: ReplayPushRequest) => {
    setReplayPush(clip);
  }, []);

  const clearReplayPush = useCallback(() => {
    setReplayPush(null);
  }, []);

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
        pushReplayToPgm,
        clearReplayPush,
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
