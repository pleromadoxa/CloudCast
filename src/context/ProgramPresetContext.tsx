import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import type { ProgramPresetMeta } from '../types/programPreset';
import {
  collectCurrentProgramConfig,
  createAndApplyBlankPreset,
  deleteProgramPreset,
  listProgramPresets,
  loadAndApplyProgramPreset,
  readActiveProgramPresetId,
  saveProgramPreset,
  writeActiveProgramPresetId,
} from '../lib/programPresetService';

interface ProgramPresetContextValue {
  presets: ProgramPresetMeta[];
  activePresetId: string | null;
  activePreset: ProgramPresetMeta | null;
  loading: boolean;
  error: string | null;
  needsSelection: boolean;
  refreshPresets: () => Promise<void>;
  selectPreset: (id: string) => Promise<void>;
  createPreset: (name: string, description?: string) => Promise<void>;
  saveActivePreset: () => Promise<void>;
  saveAsNewPreset: (name: string, description?: string) => Promise<void>;
  removePreset: (id: string) => Promise<void>;
  clearActivePreset: () => void;
  dismissSelectionGate: () => void;
}

const ProgramPresetContext = createContext<ProgramPresetContextValue | null>(null);

const GATE_DISMISSED_KEY = 'cloudcast-preset-gate-dismissed';

function readGateDismissed(): boolean {
  try {
    return sessionStorage.getItem(GATE_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeGateDismissed(): void {
  try {
    sessionStorage.setItem(GATE_DISMISSED_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function ProgramPresetProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [presets, setPresets] = useState<ProgramPresetMeta[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(() => readActiveProgramPresetId());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gateDismissed, setGateDismissed] = useState(() => readGateDismissed());

  const refreshPresets = useCallback(async () => {
    if (!user) {
      setPresets([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await listProgramPresets();
      setPresets(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load program presets.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refreshPresets();
  }, [refreshPresets]);

  useEffect(() => {
    setActivePresetId(readActiveProgramPresetId());
  }, [user]);

  const activePreset = useMemo(
    () => presets.find((p) => p.id === activePresetId) ?? null,
    [presets, activePresetId],
  );

  const needsSelection = Boolean(user && !activePresetId && !gateDismissed);

  const reloadAfterApply = useCallback(() => {
    window.location.reload();
  }, []);

  const selectPreset = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);
      try {
        await loadAndApplyProgramPreset(id);
        setActivePresetId(id);
        writeGateDismissed();
        setGateDismissed(true);
        reloadAfterApply();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load preset.');
        setLoading(false);
      }
    },
    [reloadAfterApply],
  );

  const createPreset = useCallback(
    async (name: string, description?: string) => {
      setLoading(true);
      setError(null);
      try {
        const preset = await createAndApplyBlankPreset(name, description);
        setActivePresetId(preset.id);
        await refreshPresets();
        writeGateDismissed();
        setGateDismissed(true);
        reloadAfterApply();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not create preset.');
        setLoading(false);
      }
    },
    [refreshPresets, reloadAfterApply],
  );

  const saveActivePreset = useCallback(async () => {
    if (!activePresetId) return;
    setLoading(true);
    setError(null);
    try {
      const config = collectCurrentProgramConfig();
      await saveProgramPreset({
        id: activePresetId,
        name: activePreset?.name ?? 'Program',
        description: activePreset?.description,
        config,
      });
      await refreshPresets();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save preset.');
    } finally {
      setLoading(false);
    }
  }, [activePresetId, activePreset, refreshPresets]);

  const saveAsNewPreset = useCallback(
    async (name: string, description?: string) => {
      setLoading(true);
      setError(null);
      try {
        const config = collectCurrentProgramConfig();
        const preset = await saveProgramPreset({ name, description, config });
        writeActiveProgramPresetId(preset.id);
        setActivePresetId(preset.id);
        await refreshPresets();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save preset.');
      } finally {
        setLoading(false);
      }
    },
    [refreshPresets],
  );

  const removePreset = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);
      try {
        await deleteProgramPreset(id);
        if (activePresetId === id) {
          setActivePresetId(null);
        }
        await refreshPresets();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not delete preset.');
      } finally {
        setLoading(false);
      }
    },
    [activePresetId, refreshPresets],
  );

  const clearActivePreset = useCallback(() => {
    writeActiveProgramPresetId(null);
    setActivePresetId(null);
    setGateDismissed(false);
    try {
      sessionStorage.removeItem(GATE_DISMISSED_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const dismissSelectionGate = useCallback(() => {
    writeGateDismissed();
    setGateDismissed(true);
  }, []);

  const value = useMemo<ProgramPresetContextValue>(
    () => ({
      presets,
      activePresetId,
      activePreset,
      loading,
      error,
      needsSelection,
      refreshPresets,
      selectPreset,
      createPreset,
      saveActivePreset,
      saveAsNewPreset,
      removePreset,
      clearActivePreset,
      dismissSelectionGate,
    }),
    [
      presets,
      activePresetId,
      activePreset,
      loading,
      error,
      needsSelection,
      refreshPresets,
      selectPreset,
      createPreset,
      saveActivePreset,
      saveAsNewPreset,
      removePreset,
      clearActivePreset,
      dismissSelectionGate,
    ],
  );

  return (
    <ProgramPresetContext.Provider value={value}>{children}</ProgramPresetContext.Provider>
  );
}

export function useProgramPresets(): ProgramPresetContextValue {
  const ctx = useContext(ProgramPresetContext);
  if (!ctx) {
    throw new Error('useProgramPresets must be used within ProgramPresetProvider');
  }
  return ctx;
}

export function useProgramPresetsOptional(): ProgramPresetContextValue | null {
  return useContext(ProgramPresetContext);
}
