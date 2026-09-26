/**
 * React bindings for the CloudCast Render Engine.
 *
 * `RenderEngineProvider` keeps the background engine alive for the whole
 * production shell (start on mount, stop on unmount). Hooks read engine state
 * through `useSyncExternalStore`, so any component can subscribe cheaply:
 *
 *   const settings = useRenderEngineSettings();
 *   const status   = useRenderEngineStatus();
 *
 * The hooks work without the provider too — they talk to the module
 * singleton — so panels deep in the mixer tree never need prop drilling.
 */
/* eslint-disable react-refresh/only-export-components -- hooks ship with their provider (same pattern as AuthContext) */
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { getRenderEngine } from '../lib/renderEngine/engine';
import type { RenderEngine } from '../lib/renderEngine/engine';
import type { RenderEngineSettings, RenderEngineStatus } from '../lib/renderEngine/types';

export function RenderEngineProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const engine = getRenderEngine();
    engine.start();
    return () => {
      // Keep the device warm across route changes — only the scheduler stops
      // when the production shell unmounts for good.
      engine.stop();
    };
  }, []);
  return <>{children}</>;
}

export function useRenderEngine(): RenderEngine {
  return getRenderEngine();
}

export function useRenderEngineStatus(): RenderEngineStatus {
  const engine = getRenderEngine();
  const subscribe = useCallback((listener: () => void) => engine.subscribeStatus(listener), [engine]);
  const snapshot = useCallback(() => engine.getStatus(), [engine]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function useRenderEngineSettings(): RenderEngineSettings {
  const engine = getRenderEngine();
  const subscribe = useCallback(
    (listener: () => void) => {
      const unsubA = engine.settings.subscribe(listener);
      const unsubB = engine.subscribeSettings(listener);
      return () => {
        unsubA();
        unsubB();
      };
    },
    [engine],
  );
  const snapshot = useCallback(() => engine.settings.get(), [engine]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/**
 * Patch engine settings from UI controls. Returns a stable callback.
 */
export function usePatchRenderEngineSettings(): (
  partial: Partial<RenderEngineSettings>,
) => void {
  const engine = getRenderEngine();
  return useCallback(
    (partial: Partial<RenderEngineSettings>) => {
      engine.settings.patch(partial);
    },
    [engine],
  );
}
