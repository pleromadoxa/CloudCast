import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface ProductionContextValue {
  /** True while PGM output is actively streaming (ON AIR). */
  isOnAir: boolean;
  setProductionOnAir: (onAir: boolean) => void;
}

const ProductionContext = createContext<ProductionContextValue | null>(null);

export function ProductionProvider({ children }: { children: ReactNode }) {
  const [isOnAir, setIsOnAir] = useState(false);

  const setProductionOnAir = useCallback((onAir: boolean) => {
    setIsOnAir(onAir);
  }, []);

  return (
    <ProductionContext.Provider value={{ isOnAir, setProductionOnAir }}>
      {children}
    </ProductionContext.Provider>
  );
}

export function useProduction() {
  const ctx = useContext(ProductionContext);
  if (!ctx) throw new Error('useProduction must be used within ProductionProvider');
  return ctx;
}
