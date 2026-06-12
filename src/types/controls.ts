import type { KeyboardShortcutBindings } from './keyboardShortcuts';
import type { OverlayType, StreamQuality } from './device';
import type {
  AudioSettings,
  KeySettings,
  LayerSettings,
  MixerPanel,
  OutputMode,
  PipSettings,
  TransitionSettings,
  TransitionType,
  PipSize,
  DisplaySettings,
} from './mixer';

export type ViewMode = 'grid' | 'focus' | 'single';

export interface DashboardControls {
  selectedStreamIds: string[];
  streamQuality: Record<string, StreamQuality>;
  defaultQuality: StreamQuality;
  overlays: Record<string, OverlayType>;
  globalOverlay: OverlayType;
  statusFilter: import('./device').DeviceStatus | 'all';
  viewMode: ViewMode;
  focusedDeviceId: string | null;
  showOfflineTiles: boolean;

  pstDeviceId: string | null;
  pgmDeviceId: string | null;
  subDeviceId: string | null;
  transitionFromId: string | null;
  outputMode: OutputMode;
  activePanel: MixerPanel;
  /** Panels shown side-by-side in the control deck (at least one). */
  openPanels: MixerPanel[];
  isOnAir: boolean;
  isRecording: boolean;
  showMultiview: boolean;
  fullscreenPgm: boolean;

  transition: TransitionSettings;
  pip: PipSettings;
  key: KeySettings;
  /** Staged graphics — edited in Layers panel, shown on PST preview. */
  layers: LayerSettings;
  /** Live graphics on PGM — updated only via Push to PGM. */
  pgmLayers: LayerSettings;
  audio: AudioSettings;
  display: DisplaySettings;
  /** Selected graphics layer in Layers panel — highlights region on PST. */
  selectedGraphicsLayerId: string | null;
  /** User-defined keyboard bindings for mixer actions. */
  keyboardShortcuts: KeyboardShortcutBindings;
}

export interface ControlAction {
  id: string;
  label: string;
  description: string;
  category: 'stream' | 'quality' | 'overlay' | 'status' | 'layout' | 'audio' | 'mixer';
  parameters?: Record<string, { type: string; description: string; enum?: string[] }>;
}

export type { TransitionType, PipSize, OutputMode, MixerPanel, PipSettings };
