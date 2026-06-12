import type { AudioConsoleState, FatChannelParams } from '../hooks/useAudioConsoleState';
import type { NoiseCancelSettings } from '../lib/noiseCancellation';

const STORAGE_KEY = 'cloudcast-audio-console-v1';

export type PersistedAudioConsole = Pick<
  AudioConsoleState,
  | 'masterVolume'
  | 'masterMuted'
  | 'monitorMuted'
  | 'monitorVolume'
  | 'selectedChannel'
  | 'activeBank'
  | 'inputVolumes'
  | 'inputMuted'
  | 'soloId'
  | 'mixEnabled'
  | 'fatChannel'
  | 'noiseCancel'
  | 'noiseFloors'
  | 'mixSends'
  | 'fxEnabled'
  | 'fxMix'
  | 'channelLabels'
>;

export type SceneId = 'A' | 'B' | 'C' | 'D';

export interface ConsoleSceneSnapshot {
  inputVolumes: Record<string, number>;
  inputMuted: Record<string, boolean>;
  mixEnabled: Record<string, boolean>;
  fatChannel: Record<string, FatChannelParams>;
  noiseCancel: Record<string, NoiseCancelSettings>;
  noiseFloors: Record<string, number>;
  mixSends: AudioConsoleState['mixSends'];
  masterVolume: number;
  masterMuted: boolean;
  monitorMuted: boolean;
  monitorVolume: number;
  soloId: string | null;
  fxEnabled: AudioConsoleState['fxEnabled'];
  fxMix: AudioConsoleState['fxMix'];
  channelLabels: Record<string, string>;
  selectedChannel: number;
  activeBank: AudioConsoleState['activeBank'];
}

export interface PersistedAudioMixerData {
  console: Partial<PersistedAudioConsole>;
  scenes: Partial<Record<SceneId, ConsoleSceneSnapshot>>;
  audioSources: Record<string, string>;
  linkedUsb: Record<string, string | null>;
}

export function loadAudioConsoleState(): PersistedAudioMixerData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedAudioMixerData;
  } catch {
    return null;
  }
}

export function saveAudioConsoleState(data: PersistedAudioMixerData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota */
  }
}

export function captureSceneSnapshot(state: AudioConsoleState): ConsoleSceneSnapshot {
  return {
    inputVolumes: { ...state.inputVolumes },
    inputMuted: { ...state.inputMuted },
    mixEnabled: { ...state.mixEnabled },
    fatChannel: { ...state.fatChannel },
    noiseCancel: { ...state.noiseCancel },
    noiseFloors: { ...state.noiseFloors },
    mixSends: { ...state.mixSends },
    masterVolume: state.masterVolume,
    masterMuted: state.masterMuted,
    monitorMuted: state.monitorMuted,
    monitorVolume: state.monitorVolume,
    soloId: state.soloId,
    fxEnabled: { ...state.fxEnabled },
    fxMix: { ...state.fxMix },
    channelLabels: { ...state.channelLabels },
    selectedChannel: state.selectedChannel,
    activeBank: state.activeBank,
  };
}

export function pickPersistedConsole(state: AudioConsoleState): PersistedAudioConsole {
  return {
    masterVolume: state.masterVolume,
    masterMuted: state.masterMuted,
    monitorMuted: state.monitorMuted,
    monitorVolume: state.monitorVolume,
    selectedChannel: state.selectedChannel,
    activeBank: state.activeBank,
    inputVolumes: state.inputVolumes,
    inputMuted: state.inputMuted,
    soloId: state.soloId,
    mixEnabled: state.mixEnabled,
    fatChannel: state.fatChannel,
    noiseCancel: state.noiseCancel,
    noiseFloors: state.noiseFloors,
    mixSends: state.mixSends,
    fxEnabled: state.fxEnabled,
    fxMix: state.fxMix,
    channelLabels: state.channelLabels,
  };
}
