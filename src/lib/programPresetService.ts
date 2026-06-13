import type {
  ProgramPreset,
  ProgramPresetConfig,
  ProgramPresetMeta,
  ProgramPresetSyncConfig,
} from '../types/programPreset';
import { PROGRAM_PRESET_VERSION, ACTIVE_PROGRAM_PRESET_KEY } from '../types/programPreset';
import { loadProductionState, saveProductionState, type PersistedProductionState } from './productionPersistence';
import { loadStoredOverlayLayers, saveOverlayLayers } from './overlayStorage';
import { loadKeyboardShortcuts, saveKeyboardShortcuts } from './keyboardShortcutsStorage';
import { loadSavedLowerThirdPresets, saveSavedLowerThirdPresets } from './savedPresetsStorage';
import { loadAudioConsoleState, saveAudioConsoleState, type PersistedAudioMixerData } from './audioConsolePersistence';
import { loadDisplayFeedState, saveDisplayFeedState } from './displayFeedStorage';
import { createDefaultDisplayFeedState } from '../types/displayFeed';
import { normalizeBindings } from './keyboardBinding';
import { normalizeLayerSettings } from './layerSettings';
import { normalizeAudioSettings } from './audioSettings';
import { getSupabase, isSupabaseConfigured } from './supabase';

function stripEphemeralProduction(state: Partial<PersistedProductionState>): Partial<PersistedProductionState> {
  const {
    pstDeviceId: _pst,
    pgmDeviceId: _pgm,
    subDeviceId: _sub,
    isOnAir: _onAir,
    onAirStartedAt: _started,
    ...rest
  } = state;
  return rest;
}

export function createBlankProgramPresetConfig(): ProgramPresetConfig {
  return {
    version: PROGRAM_PRESET_VERSION,
    video: {
      production: stripEphemeralProduction({}),
      overlays: {},
      keyboardShortcuts: normalizeBindings(),
      lowerThirdPresets: [],
    },
    audio: {
      console: {},
      scenes: {},
      audioSources: {},
      linkedUsb: {},
    },
    display: createDefaultDisplayFeedState(),
    sync: {},
  };
}

export function collectCurrentProgramConfig(): ProgramPresetConfig {
  const production = loadProductionState() ?? {};
  const overlays = loadStoredOverlayLayers() ?? {};
  const display = loadDisplayFeedState();

  return {
    version: PROGRAM_PRESET_VERSION,
    video: {
      production: stripEphemeralProduction(production),
      overlays: normalizeLayerSettings(overlays),
      keyboardShortcuts: loadKeyboardShortcuts(),
      lowerThirdPresets: loadSavedLowerThirdPresets(),
    },
    audio: loadAudioConsoleState() ?? {
      console: {},
      scenes: {},
      audioSources: {},
      linkedUsb: {},
    },
    display: {
      ...display,
      liveSlideId: null,
      previewSlideId: display.slides[0]?.id ?? null,
    },
    sync: {
      displayTransition: display.transition,
      showNotes: display.showNotes,
    },
  };
}

export function applyProgramPresetConfig(config: ProgramPresetConfig): void {
  const base = loadProductionState() ?? {};
  const preset = stripEphemeralProduction(config.video.production);
  const mergedTransition = {
    type: 'mix' as const,
    durationMs: 800,
    autoTrans: false,
    fadeToBlack: false,
    ...base.transition,
    ...preset.transition,
    isAnimating: false,
    progress: 0,
    fadeToBlackLevel: 0,
  };

  saveProductionState({
    outputMode: 'main',
    activePanel: 'sources',
    openPanels: ['sources'],
    defaultQuality: 'auto',
    viewMode: 'grid',
    globalOverlay: 'none',
    display: { aspectRatio: '16:9' },
    pip: { position: 'bottom-right', size: 'medium', border: true, opacity: 100 },
    key: {
      keyType: 'chroma',
      color: '#00ff00',
      tolerance: 40,
      lumaThreshold: 28,
      enabled: false,
      fillSource: 'preset',
      backgroundId: 'gradient-broadcast',
    },
    ...base,
    ...preset,
    pstDeviceId: null,
    pgmDeviceId: null,
    subDeviceId: null,
    isOnAir: false,
    onAirStartedAt: null,
    audio: normalizeAudioSettings(preset.audio ?? base.audio),
    transition: mergedTransition,
  });

  const overlayLayers = normalizeLayerSettings(config.video.overlays as Parameters<typeof normalizeLayerSettings>[0]);
  saveOverlayLayers({
    imageOverlays: overlayLayers.imageOverlays,
    lowerThirdTemplate: overlayLayers.lowerThirdTemplate,
    lowerThirdCustomization: overlayLayers.lowerThirdCustomization,
    lowerThirdPresetId: overlayLayers.lowerThirdPresetId,
    lowerThirdText: overlayLayers.lowerThirdText,
    lowerThirdSubtext: overlayLayers.lowerThirdSubtext,
    showLowerThird: overlayLayers.showLowerThird,
    programLogo: overlayLayers.programLogo,
    crawler: overlayLayers.crawler,
    breakingNews: overlayLayers.breakingNews,
    showLiveButton: overlayLayers.showLiveButton,
    liveButton: overlayLayers.liveButton,
    graphicsStackOrder: overlayLayers.graphicsStackOrder,
  });

  saveKeyboardShortcuts(normalizeBindings(config.video.keyboardShortcuts));
  saveSavedLowerThirdPresets(config.video.lowerThirdPresets ?? []);

  const audioData: PersistedAudioMixerData = config.audio ?? {
    console: {},
    scenes: {},
    audioSources: {},
    linkedUsb: {},
  };
  saveAudioConsoleState(audioData);

  const displayState = {
    ...createDefaultDisplayFeedState(),
    ...config.display,
    liveSlideId: null,
    previewSlideId: config.display.previewSlideId ?? config.display.slides?.[0]?.id ?? null,
    transition: config.sync.displayTransition ?? config.display.transition,
    showNotes: config.sync.showNotes ?? config.display.showNotes,
  };
  saveDisplayFeedState(displayState);
}

export function readActiveProgramPresetId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_PROGRAM_PRESET_KEY);
  } catch {
    return null;
  }
}

export function writeActiveProgramPresetId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(ACTIVE_PROGRAM_PRESET_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_PROGRAM_PRESET_KEY);
    }
  } catch {
    /* ignore */
  }
}

function mapMeta(row: Record<string, unknown>): ProgramPresetMeta {
  return {
    id: String(row.id),
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    updatedAt: String(row.updated_at ?? row.updatedAt ?? ''),
    createdAt: String(row.created_at ?? row.createdAt ?? ''),
  };
}

function mapPreset(row: Record<string, unknown>): ProgramPreset {
  const config = (row.config ?? {}) as ProgramPresetConfig;
  return {
    ...mapMeta(row),
    config: {
      ...createBlankProgramPresetConfig(),
      ...config,
      version: PROGRAM_PRESET_VERSION,
    },
  };
}

export async function listProgramPresets(): Promise<ProgramPresetMeta[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabase().rpc('list_program_presets');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapMeta);
}

export async function fetchProgramPreset(id: string): Promise<ProgramPreset> {
  const { data, error } = await getSupabase().rpc('get_program_preset', { p_id: id });
  if (error) throw new Error(error.message);
  return mapPreset(data as Record<string, unknown>);
}

export async function saveProgramPreset(input: {
  id?: string | null;
  name: string;
  description?: string | null;
  config?: ProgramPresetConfig;
}): Promise<ProgramPreset> {
  const config = input.config ?? collectCurrentProgramConfig();
  const { data, error } = await getSupabase().rpc('upsert_program_preset', {
    p_id: input.id ?? null,
    p_name: input.name,
    p_description: input.description ?? null,
    p_config: config,
  });
  if (error) throw new Error(error.message);
  return mapPreset(data as Record<string, unknown>);
}

export async function deleteProgramPreset(id: string): Promise<void> {
  const { error } = await getSupabase().rpc('delete_program_preset', { p_id: id });
  if (error) throw new Error(error.message);
  if (readActiveProgramPresetId() === id) {
    writeActiveProgramPresetId(null);
  }
}

export async function loadAndApplyProgramPreset(id: string): Promise<ProgramPreset> {
  const preset = await fetchProgramPreset(id);
  applyProgramPresetConfig(preset.config);
  writeActiveProgramPresetId(id);
  return preset;
}

export async function createAndApplyBlankPreset(name: string, description?: string): Promise<ProgramPreset> {
  const config = createBlankProgramPresetConfig();
  applyProgramPresetConfig(config);
  const preset = await saveProgramPreset({ name, description, config });
  writeActiveProgramPresetId(preset.id);
  return preset;
}

export function mergeSyncIntoConfig(
  config: ProgramPresetConfig,
  sync: Partial<ProgramPresetSyncConfig>,
): ProgramPresetConfig {
  return {
    ...config,
    sync: { ...config.sync, ...sync },
    display: {
      ...config.display,
      transition: sync.displayTransition ?? config.display.transition,
      showNotes: sync.showNotes ?? config.display.showNotes,
    },
  };
}
