import type { PersistedAudioMixerData } from '../lib/audioConsolePersistence';
import type { PersistedProductionState } from '../lib/productionPersistence';
import type { DisplayFeedState } from './displayFeed';
import type { KeyboardShortcutBindings } from './keyboardShortcuts';
import type { SavedLowerThirdPreset } from './overlays';

export const PROGRAM_PRESET_VERSION = 1;
export const ACTIVE_PROGRAM_PRESET_KEY = 'cloudcast-active-program-preset-id';

/** Overlay layers subset persisted with video mixer. */
export type ProgramPresetOverlayLayers = {
  imageOverlays?: unknown[];
  lowerThirdTemplate?: string;
  lowerThirdCustomization?: unknown;
  lowerThirdPresetId?: string | null;
  lowerThirdText?: string;
  lowerThirdSubtext?: string;
  showLowerThird?: boolean;
  programLogo?: unknown;
  crawler?: unknown;
  breakingNews?: unknown;
  showLiveButton?: boolean;
  liveButton?: unknown;
  graphicsStackOrder?: string[];
};

/** Cross-product sync preferences (stream routing, display output). */
export interface ProgramPresetSyncConfig {
  selectedStreamDestinationIds?: string[];
  displayTransition?: DisplayFeedState['transition'];
  showNotes?: boolean;
}

export interface ProgramPresetConfig {
  version: typeof PROGRAM_PRESET_VERSION;
  video: {
    production: Partial<PersistedProductionState>;
    overlays: ProgramPresetOverlayLayers;
    keyboardShortcuts: KeyboardShortcutBindings;
    lowerThirdPresets: SavedLowerThirdPreset[];
  };
  audio: PersistedAudioMixerData;
  display: DisplayFeedState;
  sync: ProgramPresetSyncConfig;
}

export interface ProgramPresetMeta {
  id: string;
  name: string;
  description?: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface ProgramPreset extends ProgramPresetMeta {
  config: ProgramPresetConfig;
}
