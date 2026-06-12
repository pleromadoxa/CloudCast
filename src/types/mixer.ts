import type { OverlayType } from './device';
import type { LayerStackId } from './graphicsStack';
import type {
  ImageOverlay,
  LowerThirdCustomization,
  LowerThirdTemplateId,
  BreakingNewsSettings,
  CrawlerSettings,
  LiveButtonSettings,
  ProgramLogoSettings,
  TransitionGraphicSettings,
} from './overlays';

export type TransitionType = 'cut' | 'mix' | 'fade' | 'wipe' | 'dip';

export type PipSize = 'small' | 'medium' | 'large';

export type OutputMode = 'main' | 'pip' | 'key';

export type PipPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';

export type MixerPanel = 'sources' | 'layers' | 'audio' | 'transitions' | 'settings' | 'devices' | 'stream';

export type VideoAspectRatio = '16:9' | '9:16' | '4:3' | '1:1';

export interface DisplaySettings {
  aspectRatio: VideoAspectRatio;
}

export type ChromaFillSource = 'preset' | 'camera';

export interface KeySettings {
  color: string;
  tolerance: number;
  enabled: boolean;
  /** Preset canvas background or aux camera fill. */
  fillSource: ChromaFillSource;
  backgroundId: string;
}

export interface PipSettings {
  position: PipPosition;
  size: PipSize;
  border: boolean;
  opacity: number;
}

export interface LayerSettings {
  globalOverlay: OverlayType;
  overlays: Record<string, OverlayType>;
  lowerThirdText: string;
  lowerThirdSubtext: string;
  lowerThirdTemplate: LowerThirdTemplateId;
  lowerThirdCustomization: LowerThirdCustomization;
  lowerThirdPresetId: string | null;
  showLowerThird: boolean;
  logoText: string;
  showLogo: boolean;
  programLogo: ProgramLogoSettings;
  showCrawler: boolean;
  crawler: CrawlerSettings;
  showBreakingNews: boolean;
  breakingNews: BreakingNewsSettings;
  showLiveButton: boolean;
  liveButton: LiveButtonSettings;
  transitionGraphic: TransitionGraphicSettings;
  showSafeZone: boolean;
  showCrosshair: boolean;
  imageOverlays: ImageOverlay[];
  /** Front-to-back layer order (index 0 = top / highest z). */
  graphicsStackOrder: LayerStackId[];
}

import type { AudioInputSource } from './audio';

export interface AudioSettings {
  masterVolume: number;
  masterMuted: boolean;
  audioFollowVideo: boolean;
  inputVolumes: Record<string, number>;
  inputMuted: Record<string, boolean>;
  /** Per-view preview mute — silence audio on source tiles / multiview without muting PGM bus. */
  viewAudioMuted: Record<string, boolean>;
  /** Per-input monitor fader (0–100). Local audition only — never sent on program/broadcast. */
  viewMonitorVolumes: Record<string, number>;
  /** Mutes all preview/monitor outputs without affecting PGM / live bus. */
  monitorMasterMuted: boolean;
  /** Active audio source per video input (also persisted on paired_devices). */
  inputAudioSources: Record<string, AudioInputSource>;
  /** USB audio-only device linked to a video input slot. */
  linkedUsbAudio: Record<string, string | null>;
  soloInputId: string | null;
}

export interface TransitionSettings {
  type: TransitionType;
  durationMs: number;
  progress: number;
  isAnimating: boolean;
  autoTrans: boolean;
  fadeToBlack: boolean;
  fadeToBlackLevel: number;
}

export interface MixerBusState {
  pstDeviceId: string | null;
  pgmDeviceId: string | null;
  subDeviceId: string | null;
  outputMode: OutputMode;
  isOnAir: boolean;
  isRecording: boolean;
  showMultiview: boolean;
  fullscreenPgm: boolean;
}

export const PIP_SIZE_MAP: Record<PipSize, { w: string; h: string }> = {
  small: { w: '25%', h: '22%' },
  medium: { w: '35%', h: '28%' },
  large: { w: '45%', h: '38%' },
};

export const TRANSITION_DURATIONS = [300, 500, 800, 1200, 2000];
