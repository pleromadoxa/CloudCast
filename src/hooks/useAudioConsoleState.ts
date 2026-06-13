import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AudioInputSource } from '../types/audio';
import type { Device } from '../types/device';
import { isRealDevice } from '../types/device';
import {
  captureSceneSnapshot,
  loadAudioConsoleState,
  pickPersistedConsole,
  saveAudioConsoleState,
  type ConsoleSceneSnapshot,
  type PersistedAudioMixerData,
  type SceneId,
} from '../lib/audioConsolePersistence';
import {
  DEFAULT_NOISE_CANCEL,
  type NoiseCancelSettings,
} from '../lib/noiseCancellation';

export type { NoiseCancelSettings };

export interface FatChannelParams {
  gain: number;
  pan: number;
  comp: number;
  hpf: number;
  hpfBypass: boolean;
}

export type ConsoleBank = 'inputs' | 'mix' | 'fx' | 'routing';

export interface AudioConsoleState {
  /** Console power — when false, all buses are silent. */
  consoleEnabled: boolean;
  /** Peak-hold mode for master meters (latching peak LEDs). */
  peakHoldEnabled: boolean;
  masterVolume: number;
  masterMuted: boolean;
  monitorMuted: boolean;
  monitorVolume: number;
  selectedChannel: number;
  activeBank: ConsoleBank;
  inputVolumes: Record<string, number>;
  inputMuted: Record<string, boolean>;
  soloId: string | null;
  mixEnabled: Record<string, boolean>;
  fatChannel: Record<string, FatChannelParams>;
  noiseCancel: Record<string, NoiseCancelSettings>;
  noiseFloors: Record<string, number>;
  mixSends: Record<string, Partial<Record<1 | 2 | 3 | 4, number>>>;
  fxEnabled: Record<'A' | 'B' | 'C' | 'D', boolean>;
  fxMix: Record<'A' | 'B' | 'C' | 'D', number>;
  channelLabels: Record<string, string>;
}

const DEFAULT_FAT: FatChannelParams = { gain: 50, pan: 0, comp: 0, hpf: 0, hpfBypass: false };

export const CONSOLE_BANKS: { id: ConsoleBank; label: string }[] = [
  { id: 'inputs', label: 'Inputs' },
  { id: 'mix', label: 'Mix 1-4' },
  { id: 'fx', label: 'FX A-D' },
  { id: 'routing', label: 'Routing' },
];

export const FX_SLOTS: { id: 'A' | 'B' | 'C' | 'D'; name: string }[] = [
  { id: 'A', name: 'Hall Reverb' },
  { id: 'B', name: 'Stereo Delay' },
  { id: 'C', name: 'Chorus' },
  { id: 'D', name: 'Noise Gate' },
];

export const SCENE_IDS: SceneId[] = ['A', 'B', 'C', 'D'];

function defaultConsoleState(): AudioConsoleState {
  return {
    consoleEnabled: true,
    peakHoldEnabled: false,
    masterVolume: 80,
    masterMuted: false,
    monitorMuted: false,
    monitorVolume: 80,
    selectedChannel: 0,
    activeBank: 'inputs',
    inputVolumes: {},
    inputMuted: {},
    soloId: null,
    mixEnabled: {},
    fatChannel: {},
    noiseCancel: {},
    noiseFloors: {},
    mixSends: {},
    fxEnabled: { A: false, B: false, C: false, D: false },
    fxMix: { A: 25, B: 30, C: 20, D: 40 },
    channelLabels: {},
  };
}

function mergeLoadedState(base: AudioConsoleState, loaded: ReturnType<typeof loadAudioConsoleState>): AudioConsoleState {
  if (!loaded?.console) return base;
  const c = loaded.console;
  return {
    ...base,
    ...c,
    inputVolumes: { ...base.inputVolumes, ...c.inputVolumes },
    inputMuted: { ...base.inputMuted, ...c.inputMuted },
    mixEnabled: { ...base.mixEnabled, ...c.mixEnabled },
    fatChannel: { ...base.fatChannel, ...c.fatChannel },
    noiseCancel: { ...base.noiseCancel, ...c.noiseCancel },
    noiseFloors: { ...base.noiseFloors, ...c.noiseFloors },
    mixSends: { ...base.mixSends, ...c.mixSends },
    fxEnabled: { ...base.fxEnabled, ...c.fxEnabled },
    fxMix: { ...base.fxMix, ...c.fxMix },
    channelLabels: { ...base.channelLabels, ...c.channelLabels },
  };
}

export function getFatChannelParams(
  state: AudioConsoleState,
  deviceId: string,
): FatChannelParams {
  return { ...DEFAULT_FAT, ...state.fatChannel[deviceId] };
}

export function getNoiseCancelSettings(
  state: AudioConsoleState,
  deviceId: string,
): NoiseCancelSettings {
  return { ...DEFAULT_NOISE_CANCEL, ...state.noiseCancel[deviceId] };
}

export function getLearnedNoiseFloor(state: AudioConsoleState, deviceId: string): number {
  return state.noiseFloors[deviceId] ?? 35;
}

export function isMixEnabled(state: AudioConsoleState, deviceId: string): boolean {
  return state.mixEnabled[deviceId] !== false;
}

export function getVolumeForDevice(state: AudioConsoleState, deviceId: string | null): number {
  if (!deviceId || !state.consoleEnabled) return 0;
  if (state.masterMuted) return 0;
  if (state.inputMuted[deviceId]) return 0;
  if (state.soloId) {
    if (state.soloId !== deviceId) return 0;
  } else if (!isMixEnabled(state, deviceId)) {
    return 0;
  }

  const inputVol = (state.inputVolumes[deviceId] ?? 75) / 100;
  const master = state.masterVolume / 100;
  const gain = getFatChannelParams(state, deviceId).gain / 50;
  return Math.min(1, inputVol * master * gain);
}

export function getMonitorVolume(state: AudioConsoleState, deviceId: string | null): number {
  if (!deviceId || state.monitorMuted || !state.consoleEnabled) return 0;
  return (state.monitorVolume / 100) * ((state.inputVolumes[deviceId] ?? 75) / 100);
}

export function useAudioConsoleState(devices: Device[]) {
  const loadedRef = useRef(loadAudioConsoleState());
  const [state, setState] = useState<AudioConsoleState>(() =>
    mergeLoadedState(defaultConsoleState(), loadedRef.current),
  );
  const [scenes, setScenes] = useState<Partial<Record<SceneId, ConsoleSceneSnapshot>>>(
    () => loadedRef.current?.scenes ?? {},
  );
  const [audioSources, setAudioSources] = useState<Record<string, AudioInputSource>>(() => {
    const raw = loadedRef.current?.audioSources ?? {};
    const out: Record<string, AudioInputSource> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v === 'camera' || v === 'capture_card' || v === 'usb_audio') out[k] = v;
    }
    return out;
  });
  const [linkedUsb, setLinkedUsb] = useState<Record<string, string | null>>(
    () => loadedRef.current?.linkedUsb ?? {},
  );

  const [learningNoiseFor, setLearningNoiseFor] = useState<string | null>(null);

  const patch = useCallback((partial: Partial<AudioConsoleState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const getAudioSourceForDevice = useCallback(
    (id: string) => audioSources[id] ?? 'camera',
    [audioSources],
  );

  const hydrateFromDevices = useCallback((deviceList: Device[]) => {
    const sources: Record<string, AudioInputSource> = {};
    const linked: Record<string, string | null> = {};
    const mixEnabled: Record<string, boolean> = {};
    for (const d of deviceList.filter(isRealDevice)) {
      if (d.audioSource) sources[d.deviceId] = d.audioSource;
      if (d.linkedAudioDeviceId) linked[d.deviceId] = d.linkedAudioDeviceId;
      if (d.status !== 'offline') mixEnabled[d.deviceId] = true;
    }
    if (Object.keys(sources).length > 0) {
      setAudioSources((prev) => ({ ...prev, ...sources }));
    }
    if (Object.keys(linked).length > 0) {
      setLinkedUsb((prev) => ({ ...prev, ...linked }));
    }
    if (Object.keys(mixEnabled).length > 0) {
      setState((prev) => ({
        ...prev,
        mixEnabled: { ...prev.mixEnabled, ...mixEnabled },
      }));
    }
  }, []);

  const setInputAudioSource = useCallback((deviceId: string, source: AudioInputSource) => {
    setAudioSources((prev) => ({ ...prev, [deviceId]: source }));
  }, []);

  const setLinkedUsbAudio = useCallback((deviceId: string, audioDeviceId: string | null) => {
    setLinkedUsb((prev) => ({ ...prev, [deviceId]: audioDeviceId }));
  }, []);

  const onSelectChannel = useCallback((index: number) => {
    patch({ selectedChannel: index });
  }, [patch]);

  const onSetBank = useCallback((activeBank: ConsoleBank) => {
    patch({ activeBank });
  }, [patch]);

  const onToggleMix = useCallback((deviceId: string) => {
    setState((prev) => ({
      ...prev,
      mixEnabled: {
        ...prev.mixEnabled,
        [deviceId]: !isMixEnabled(prev, deviceId),
      },
    }));
  }, []);

  const onToggleMute = useCallback((deviceId: string) => {
    setState((prev) => ({
      ...prev,
      inputMuted: { ...prev.inputMuted, [deviceId]: !prev.inputMuted[deviceId] },
    }));
  }, []);

  const onToggleSolo = useCallback((deviceId: string) => {
    setState((prev) => ({
      ...prev,
      soloId: prev.soloId === deviceId ? null : deviceId,
    }));
  }, []);

  const onSetVolume = useCallback((deviceId: string, value: number) => {
    setState((prev) => ({
      ...prev,
      inputVolumes: { ...prev.inputVolumes, [deviceId]: value },
    }));
  }, []);

  const onSetMasterVolume = useCallback((masterVolume: number) => {
    patch({ masterVolume });
  }, [patch]);

  const onSetMonitorVolume = useCallback((monitorVolume: number) => {
    patch({ monitorVolume });
  }, [patch]);

  const onToggleMasterMute = useCallback(() => {
    setState((prev) => ({ ...prev, masterMuted: !prev.masterMuted }));
  }, []);

  const onToggleMonitorMute = useCallback(() => {
    setState((prev) => ({ ...prev, monitorMuted: !prev.monitorMuted }));
  }, []);

  const onToggleConsoleEnabled = useCallback(() => {
    setState((prev) => ({ ...prev, consoleEnabled: !prev.consoleEnabled }));
  }, []);

  const onTogglePeakHold = useCallback(() => {
    setState((prev) => ({ ...prev, peakHoldEnabled: !prev.peakHoldEnabled }));
  }, []);

  const onSetFatParam = useCallback(
    (deviceId: string, key: keyof FatChannelParams, value: number | boolean) => {
      setState((prev) => ({
        ...prev,
        fatChannel: {
          ...prev.fatChannel,
          [deviceId]: {
            ...getFatChannelParams(prev, deviceId),
            [key]: value,
          },
        },
      }));
    },
    [],
  );

  const onToggleHpfBypass = useCallback((deviceId: string) => {
    setState((prev) => {
      const fat = getFatChannelParams(prev, deviceId);
      return {
        ...prev,
        fatChannel: {
          ...prev.fatChannel,
          [deviceId]: { ...fat, hpfBypass: !fat.hpfBypass },
        },
      };
    });
  }, []);

  const onPatchNoiseCancel = useCallback(
    (deviceId: string, patchNc: Partial<NoiseCancelSettings>) => {
      setState((prev) => ({
        ...prev,
        noiseCancel: {
          ...prev.noiseCancel,
          [deviceId]: {
            ...getNoiseCancelSettings(prev, deviceId),
            ...patchNc,
          },
        },
      }));
    },
    [],
  );

  const onLearnNoiseFloor = useCallback((deviceId: string) => {
    setLearningNoiseFor(deviceId);
  }, []);

  const onNoiseFloorLearned = useCallback((deviceId: string, floor: number) => {
    setState((prev) => ({
      ...prev,
      noiseFloors: { ...prev.noiseFloors, [deviceId]: floor },
    }));
    setLearningNoiseFor((current) => (current === deviceId ? null : current));
  }, []);

  const onSetMixSend = useCallback(
    (deviceId: string, bus: 1 | 2 | 3 | 4, value: number) => {
      setState((prev) => ({
        ...prev,
        mixSends: {
          ...prev.mixSends,
          [deviceId]: { ...prev.mixSends[deviceId], [bus]: value },
        },
      }));
    },
    [],
  );

  const onToggleFx = useCallback((slot: 'A' | 'B' | 'C' | 'D') => {
    setState((prev) => ({
      ...prev,
      fxEnabled: { ...prev.fxEnabled, [slot]: !prev.fxEnabled[slot] },
    }));
  }, []);

  const onSetFxMix = useCallback((slot: 'A' | 'B' | 'C' | 'D', value: number) => {
    setState((prev) => ({
      ...prev,
      fxMix: { ...prev.fxMix, [slot]: value },
    }));
  }, []);

  const onSetChannelLabel = useCallback((deviceId: string, label: string) => {
    setState((prev) => ({
      ...prev,
      channelLabels: { ...prev.channelLabels, [deviceId]: label.trim() },
    }));
  }, []);

  const onStoreScene = useCallback((sceneId: SceneId) => {
    const snapshot = captureSceneSnapshot(state);
    setScenes((prev) => ({ ...prev, [sceneId]: snapshot }));
  }, [state]);

  const onRecallScene = useCallback((sceneId: SceneId) => {
    const scene = scenes[sceneId];
    if (!scene) return;
    setState((prev) => ({
      ...prev,
      inputVolumes: { ...prev.inputVolumes, ...scene.inputVolumes },
      inputMuted: { ...prev.inputMuted, ...scene.inputMuted },
      mixEnabled: { ...prev.mixEnabled, ...scene.mixEnabled },
      fatChannel: { ...prev.fatChannel, ...scene.fatChannel },
      noiseCancel: { ...prev.noiseCancel, ...scene.noiseCancel },
      noiseFloors: { ...prev.noiseFloors, ...scene.noiseFloors },
      mixSends: { ...prev.mixSends, ...scene.mixSends },
      masterVolume: scene.masterVolume,
      masterMuted: scene.masterMuted ?? prev.masterMuted,
      monitorMuted: scene.monitorMuted ?? prev.monitorMuted,
      monitorVolume: scene.monitorVolume ?? prev.monitorVolume,
      soloId: scene.soloId ?? null,
      fxEnabled: scene.fxEnabled ? { ...prev.fxEnabled, ...scene.fxEnabled } : prev.fxEnabled,
      fxMix: scene.fxMix ? { ...prev.fxMix, ...scene.fxMix } : prev.fxMix,
      channelLabels: scene.channelLabels ? { ...prev.channelLabels, ...scene.channelLabels } : prev.channelLabels,
      selectedChannel: scene.selectedChannel ?? prev.selectedChannel,
      activeBank: scene.activeBank ?? prev.activeBank,
    }));
  }, [scenes]);

  const applyPersistedConfig = useCallback((data: PersistedAudioMixerData) => {
    setState((prev) => mergeLoadedState(prev, data));
    if (data.scenes) setScenes(data.scenes);
    if (data.audioSources) {
      const out: Record<string, AudioInputSource> = {};
      for (const [k, v] of Object.entries(data.audioSources)) {
        if (v === 'camera' || v === 'capture_card' || v === 'usb_audio') out[k] = v;
      }
      setAudioSources((prev) => ({ ...prev, ...out }));
    }
    if (data.linkedUsb) setLinkedUsb((prev) => ({ ...prev, ...data.linkedUsb }));
  }, []);

  const buildPersistedConfig = useCallback((): PersistedAudioMixerData => ({
    console: pickPersistedConsole(state),
    scenes,
    audioSources,
    linkedUsb,
  }), [state, scenes, audioSources, linkedUsb]);

  const liveDevices = useMemo(
    () => devices.filter((d) => isRealDevice(d) && d.status !== 'offline'),
    [devices],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      saveAudioConsoleState({
        console: pickPersistedConsole(state),
        scenes,
        audioSources,
        linkedUsb,
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [state, scenes, audioSources, linkedUsb]);

  return {
    state,
    scenes,
    audioSources,
    linkedUsb,
    liveDeviceCount: liveDevices.length,
    getAudioSourceForDevice,
    hydrateFromDevices,
    setInputAudioSource,
    setLinkedUsbAudio,
    onSelectChannel,
    onSetBank,
    onToggleMix,
    onToggleMute,
    onToggleSolo,
    onSetVolume,
    onSetMasterVolume,
    onSetMonitorVolume,
    onToggleMasterMute,
    onToggleMonitorMute,
    onToggleConsoleEnabled,
    onTogglePeakHold,
    onSetFatParam,
    onToggleHpfBypass,
    onPatchNoiseCancel,
    onLearnNoiseFloor,
    onNoiseFloorLearned,
    learningNoiseFor,
    onSetMixSend,
    onToggleFx,
    onSetFxMix,
    onSetChannelLabel,
    onStoreScene,
    onRecallScene,
    applyPersistedConfig,
    buildPersistedConfig,
  };
}
