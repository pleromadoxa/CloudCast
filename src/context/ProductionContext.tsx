import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { ReplayPushRequest } from '../types/replay';

interface ProductionContextValue {
  /** True while PGM output is actively streaming (ON AIR). */
  isOnAir: boolean;
  setProductionOnAir: (onAir: boolean) => void;
  /** Clip queued for instant replay on the video mixer PGM bus. */
  replayPush: ReplayPushRequest | null;
  pushReplayToPgm: (clip: ReplayPushRequest) => void;
  clearReplayPush: () => void;
}

const ProductionContext = createContext<ProductionContextValue | null>(null);

export function ProductionProvider({ children }: { children: ReactNode }) {
  const [isOnAir, setIsOnAir] = useState(false);
  const [replayPush, setReplayPush] = useState<ReplayPushRequest | null>(null);

  const setProductionOnAir = useCallback((onAir: boolean) => {
    setIsOnAir(onAir);
  }, []);

  const pushReplayToPgm = useCallback((clip: ReplayPushRequest) => {
    setReplayPush(clip);
  }, []);

  const clearReplayPush = useCallback(() => {
    setReplayPush(null);
  }, []);

  return (
    <ProductionContext.Provider
      value={{
        isOnAir,
        setProductionOnAir,
        replayPush,
        pushReplayToPgm,
        clearReplayPush,
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
