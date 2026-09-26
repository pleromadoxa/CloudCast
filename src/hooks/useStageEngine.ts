/**
 * React binding for the Stage Engine registry.
 *
 * Keeps the operator's engine choice, the device probe result and the resolved
 * active engine in one hook so the Prism workspace and the mixer settings deck
 * read the same source of truth.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_STAGE_ENGINE_SETTINGS,
  fallbackFor,
  getStageEngine,
  getStageEngineStore,
  interactiveStageEngines,
  normalizeStageEngineSettings,
  probeStageEngines,
  resolveActiveEngine,
} from '../lib/stageEngines';
import type {
  StageEngineAvailability,
  StageEngineDescriptor,
  StageEngineId,
  StageEngineSettings,
} from '../lib/stageEngines';

export interface UseStageEngineResult {
  settings: StageEngineSettings;
  availability: StageEngineAvailability[];
  probing: boolean;
  /** The engine the stage should mount right now. */
  activeEngine: StageEngineId;
  /** True when the operator's first choice could not run and we fell back. */
  fellBack: boolean;
  descriptor: StageEngineDescriptor;
  engines: StageEngineDescriptor[];
  setEngine: (id: StageEngineId) => void;
  patchSettings: (partial: Partial<StageEngineSettings>) => void;
  patchBabylon: (partial: Partial<StageEngineSettings['babylon']>) => void;
  patchUnreal: (partial: Partial<StageEngineSettings['unreal']>) => void;
  reset: () => void;
  reprobe: () => void;
}

export function useStageEngine(): UseStageEngineResult {
  const store = useMemo(() => getStageEngineStore(), []);
  const [settings, setSettings] = useState<StageEngineSettings>(() => store.get());
  const [availability, setAvailability] = useState<StageEngineAvailability[]>([]);
  const [probing, setProbing] = useState(true);
  const probeToken = useRef(0);

  useEffect(() => store.subscribe(() => setSettings(store.get())), [store]);

  const runProbe = useCallback(() => {
    const token = ++probeToken.current;
    setProbing(true);
    void probeStageEngines(store.get())
      .then((result) => {
        if (token !== probeToken.current) return;
        setAvailability(result);
      })
      .finally(() => {
        if (token === probeToken.current) setProbing(false);
      });
  }, [store]);

  useEffect(() => {
    runProbe();
  }, [runProbe, settings.unreal.signallingUrl]);

  const activeEngine = useMemo(() => {
    if (availability.length === 0) return settings.engine;
    return resolveActiveEngine(
      settings.engine,
      settings.fallbackEngine,
      settings.autoFallback,
      availability,
    );
  }, [availability, settings]);

  const setEngine = useCallback(
    (id: StageEngineId) => {
      store.patch({ engine: id, fallbackEngine: fallbackFor(id) });
    },
    [store],
  );

  const patchSettings = useCallback(
    (partial: Partial<StageEngineSettings>) => {
      store.patch(normalizeStageEngineSettings({ ...store.get(), ...partial }));
    },
    [store],
  );

  const patchBabylon = useCallback(
    (partial: Partial<StageEngineSettings['babylon']>) => {
      const current = store.get();
      store.patch({ babylon: { ...current.babylon, ...partial } });
    },
    [store],
  );

  const patchUnreal = useCallback(
    (partial: Partial<StageEngineSettings['unreal']>) => {
      const current = store.get();
      store.patch({ unreal: { ...current.unreal, ...partial } });
    },
    [store],
  );

  const reset = useCallback(() => {
    store.replace(DEFAULT_STAGE_ENGINE_SETTINGS);
  }, [store]);

  return {
    settings,
    availability,
    probing,
    activeEngine,
    fellBack: activeEngine !== settings.engine,
    descriptor: getStageEngine(activeEngine),
    engines: interactiveStageEngines(),
    setEngine,
    patchSettings,
    patchBabylon,
    patchUnreal,
    reset,
    reprobe: runProbe,
  };
}
