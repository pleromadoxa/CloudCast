import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DashboardControls } from '../types/controls';
import type { AudioInputSource } from '../types/audio';
import type { Device, OverlayType, StreamQuality } from '../types/device';
import { isRealDevice } from '../types/device';
import { resolvePipSubDeviceId } from '../lib/pipRouting';
import type { MixerPanel, OutputMode, PipPosition, PipSize, TransitionType, VideoAspectRatio } from '../types/mixer';
import { createEmptyLayerSettings } from '../lib/layerSettings';
import { normalizeKeySettings } from '../lib/keySettings';
import { loadStoredOverlayLayers } from '../lib/overlayStorage';
import { loadKeyboardShortcuts, saveKeyboardShortcuts } from '../lib/keyboardShortcutsStorage';
import { normalizeAudioSettings } from '../lib/audioSettings';
import { ensureAudioOutputReady, unlockDashboardAudio } from '../lib/audioOutput';
import {
  loadProductionState,
  pickPersistedProduction,
  saveProductionState,
  shouldResumeBroadcast,
} from '../lib/productionPersistence';
import type { KeyboardShortcutBindings } from '../types/keyboardShortcuts';
import { normalizeOpenPanels } from '../lib/mixerPanelLayout';
import { useGraphicsLive } from './useGraphicsLive';

const storedOverlays = typeof localStorage !== 'undefined' ? loadStoredOverlayLayers() : null;
const storedShortcuts = loadKeyboardShortcuts();
const storedProduction = loadProductionState();
const broadcastResumeAllowed = shouldResumeBroadcast(storedProduction);
const {
  audio: storedAudio,
  openPanels: storedOpenPanels,
  isOnAir: _storedOnAir,
  onAirStartedAt: storedOnAirStartedAt,
  ...storedProductionRest
} = storedProduction ?? {};
const resolvedOpenPanels = normalizeOpenPanels(
  storedOpenPanels as MixerPanel[] | undefined,
  (storedProduction?.activePanel as MixerPanel | undefined) ?? 'sources',
);

const DEFAULT_CONTROLS: DashboardControls = {
  selectedStreamIds: [],
  streamQuality: {},
  defaultQuality: 'auto',
  overlays: {},
  globalOverlay: 'none',
  statusFilter: 'all',
  viewMode: 'grid',
  focusedDeviceId: null,
  showOfflineTiles: false,
  pstDeviceId: null,
  pgmDeviceId: null,
  subDeviceId: null,
  transitionFromId: null,
  outputMode: 'main',
  activePanel: 'sources',
  isOnAir: broadcastResumeAllowed ? Boolean(_storedOnAir) : false,
  isRecording: false,
  showMultiview: false,
  fullscreenPgm: false,
  transition: {
    type: 'mix',
    durationMs: 800,
    progress: 0,
    isAnimating: false,
    autoTrans: false,
    fadeToBlack: false,
    fadeToBlackLevel: 0,
  },
  pip: {
    position: 'bottom-right',
    size: 'medium',
    border: true,
    opacity: 100,
  },
  key: {
    color: '#00ff00',
    tolerance: 40,
    enabled: false,
    fillSource: 'preset',
    backgroundId: 'gradient-broadcast',
  },
  layers: createEmptyLayerSettings(storedOverlays ?? undefined),
  pgmLayers: createEmptyLayerSettings(),
  display: {
    aspectRatio: '16:9',
  },
  selectedGraphicsLayerId: 'lower-third',
  keyboardShortcuts: storedShortcuts,
  ...storedProductionRest,
  openPanels: resolvedOpenPanels,
  audio: normalizeAudioSettings(storedAudio),
};

function pickDevice(devices: Device[], id: string | null): Device | null {
  if (!id) return null;
  const device = devices.find((d) => d.deviceId === id);
  return device && isRealDevice(device) ? device : null;
}

export function useDashboardState(devices: Device[]) {
  const [controls, setControls] = useState<DashboardControls>(DEFAULT_CONTROLS);
  const onAirStartedAtRef = useRef<number | null>(
    broadcastResumeAllowed ? (storedOnAirStartedAt ?? null) : null,
  );
  const graphics = useGraphicsLive(setControls);

  const liveDevices = useMemo(
    () => devices.filter((d) => isRealDevice(d) && d.status === 'live'),
    [devices],
  );

  const filteredDevices = useMemo(() => {
    const real = devices.filter(isRealDevice);
    if (controls.statusFilter === 'all') return real;
    return real.filter((d) => d.status === controls.statusFilter);
  }, [devices, controls.statusFilter]);

  const sourceDevices = useMemo(() => devices, [devices]);
  const pstDevice = useMemo(() => pickDevice(devices, controls.pstDeviceId), [devices, controls.pstDeviceId]);
  const pgmDevice = useMemo(() => pickDevice(devices, controls.pgmDeviceId), [devices, controls.pgmDeviceId]);
  const subDevice = useMemo(() => pickDevice(devices, controls.subDeviceId), [devices, controls.subDeviceId]);
  const transitionFromDevice = useMemo(
    () => pickDevice(devices, controls.transitionFromId),
    [devices, controls.transitionFromId],
  );

  useEffect(() => {
    if (controls.isOnAir) {
      if (!onAirStartedAtRef.current) onAirStartedAtRef.current = Date.now();
    } else {
      onAirStartedAtRef.current = null;
    }
  }, [controls.isOnAir]);

  useEffect(() => {
    const t = setTimeout(
      () => saveProductionState(pickPersistedProduction(controls, onAirStartedAtRef.current)),
      400,
    );
    return () => clearTimeout(t);
  }, [
    controls.pstDeviceId,
    controls.pgmDeviceId,
    controls.subDeviceId,
    controls.outputMode,
    controls.activePanel,
    controls.openPanels,
    controls.defaultQuality,
    controls.viewMode,
    controls.globalOverlay,
    controls.display,
    controls.pip,
    controls.key,
    controls.audio,
    controls.isOnAir,
    controls.transition.type,
    controls.transition.durationMs,
    controls.transition.autoTrans,
  ]);

  useEffect(() => {
    const live = devices.filter((d) => isRealDevice(d) && d.status === 'live');
    if (live.length === 0) return;
    setControls((prev) => {
      const next = { ...prev };
      if (!prev.pstDeviceId || !devices.some((d) => d.deviceId === prev.pstDeviceId && isRealDevice(d))) {
        next.pstDeviceId = live[0].deviceId;
      }
      if (!prev.pgmDeviceId || !devices.some((d) => d.deviceId === prev.pgmDeviceId && isRealDevice(d))) {
        next.pgmDeviceId = live[0].deviceId;
      }
      if (!prev.subDeviceId || !devices.some((d) => d.deviceId === prev.subDeviceId && isRealDevice(d))) {
        const mainId = next.pgmDeviceId ?? live[0].deviceId;
        const resolved = resolvePipSubDeviceId(devices, mainId, null);
        if (resolved) next.subDeviceId = resolved;
      }
      return next;
    });
  }, [devices]);

  const patch = useCallback((partial: Partial<DashboardControls>) => {
    setControls((prev) => ({ ...prev, ...partial }));
  }, []);

  const patchTransition = useCallback((partial: Partial<DashboardControls['transition']>) => {
    setControls((prev) => ({ ...prev, transition: { ...prev.transition, ...partial } }));
  }, []);

  const patchPip = useCallback((partial: Partial<DashboardControls['pip']>) => {
    setControls((prev) => ({ ...prev, pip: { ...prev.pip, ...partial } }));
  }, []);

  const patchKey = useCallback((partial: Partial<DashboardControls['key']>) => {
    setControls((prev) => ({
      ...prev,
      key: normalizeKeySettings({ ...prev.key, ...partial }),
    }));
  }, []);

  const patchLayers = graphics.patchLayers;

  const patchAudio = useCallback((partial: Partial<DashboardControls['audio']>) => {
    setControls((prev) => ({
      ...prev,
      audio: normalizeAudioSettings({ ...prev.audio, ...partial }),
    }));
  }, []);

  const focusDevice = useCallback((deviceId: string) => {
    setControls((prev) => ({ ...prev, pstDeviceId: deviceId, focusedDeviceId: deviceId }));
  }, []);

  const sendToPgm = useCallback((deviceId: string) => {
    setControls((prev) => ({ ...prev, pstDeviceId: deviceId }));
  }, []);

  const sendToPst = useCallback((deviceId: string) => {
    setControls((prev) => ({ ...prev, pstDeviceId: deviceId }));
  }, []);

  const sendToSub = useCallback((deviceId: string) => {
    setControls((prev) => ({ ...prev, subDeviceId: deviceId }));
  }, []);

  const setMainSource = useCallback((deviceId: string, row: 'main' | 'sub') => {
    setControls((prev) => ({
      ...prev,
      pstDeviceId: row === 'main' ? deviceId : prev.pstDeviceId,
      subDeviceId: row === 'sub' ? deviceId : prev.subDeviceId,
    }));
  }, []);

  const cutToPreview = useCallback(() => {
    setControls((prev) => {
      const pgmDeviceId = prev.pstDeviceId;
      let subDeviceId = prev.subDeviceId;
      if (prev.outputMode === 'pip' && subDeviceId === pgmDeviceId) {
        subDeviceId = resolvePipSubDeviceId(devices, pgmDeviceId, null);
      }
      return {
        ...prev,
        pgmDeviceId,
        subDeviceId,
        transitionFromId: null,
        transition: { ...prev.transition, progress: 0, isAnimating: false },
      };
    });
  }, [devices]);

  const cutToDevice = useCallback((deviceId: string) => {
    setControls((prev) => ({
      ...prev,
      pstDeviceId: deviceId,
      pgmDeviceId: deviceId,
      transitionFromId: null,
      transition: { ...prev.transition, progress: 0, isAnimating: false },
    }));
  }, []);

  const beginTransition = useCallback(() => {
    setControls((prev) => ({
      ...prev,
      transitionFromId: prev.pgmDeviceId,
      transition: { ...prev.transition, isAnimating: true },
    }));
  }, []);

  const completeTransition = useCallback(() => {
    setControls((prev) => {
      const pgmDeviceId = prev.pstDeviceId;
      let subDeviceId = prev.subDeviceId;
      if (prev.outputMode === 'pip' && subDeviceId === pgmDeviceId) {
        subDeviceId = resolvePipSubDeviceId(devices, pgmDeviceId, null);
      }
      return {
        ...prev,
        pgmDeviceId,
        subDeviceId,
        transitionFromId: null,
        transition: { ...prev.transition, progress: 0, isAnimating: false },
      };
    });
  }, [devices]);

  const abandonTransition = useCallback(() => {
    setControls((prev) => ({
      ...prev,
      transitionFromId: null,
      transition: { ...prev.transition, progress: 0, isAnimating: false },
    }));
  }, []);

  const swapPstPgm = useCallback(() => {
    setControls((prev) => ({
      ...prev,
      pstDeviceId: prev.pgmDeviceId,
      pgmDeviceId: prev.pstDeviceId,
    }));
  }, []);

  const exchangeSources = useCallback(() => {
    setControls((prev) => ({
      ...prev,
      pstDeviceId: prev.subDeviceId,
      subDeviceId: prev.pstDeviceId,
    }));
  }, []);

  const setOutputMode = useCallback((mode: OutputMode) => {
    setControls((prev) => {
      let subDeviceId = prev.subDeviceId;
      if (mode === 'pip') {
        const mainId = prev.pgmDeviceId ?? prev.pstDeviceId;
        subDeviceId = resolvePipSubDeviceId(devices, mainId, prev.subDeviceId);
      }
      return {
        ...prev,
        outputMode: mode,
        subDeviceId,
        key: { ...prev.key, enabled: mode === 'key' },
      };
    });
  }, [devices]);
  const setActivePanel = useCallback(
    (panel: MixerPanel) => {
      setControls((prev) => ({
        ...prev,
        activePanel: panel,
        openPanels: prev.openPanels.includes(panel) ? prev.openPanels : [...prev.openPanels, panel],
      }));
    },
    [],
  );

  const toggleOpenPanel = useCallback((panel: MixerPanel) => {
    setControls((prev) => {
      const isOpen = prev.openPanels.includes(panel);
      if (isOpen && prev.openPanels.length === 1) {
        return { ...prev, activePanel: panel };
      }
      const openPanels = normalizeOpenPanels(
        isOpen ? prev.openPanels.filter((id) => id !== panel) : [...prev.openPanels, panel],
        panel,
      );
      return {
        ...prev,
        activePanel: panel,
        openPanels,
      };
    });
  }, []);

  const setSelectedGraphicsLayer = useCallback((id: string | null) => {
    patch({ selectedGraphicsLayerId: id });
  }, [patch]);
  const toggleOnAir = useCallback((onAir?: boolean) => {
    setControls((prev) => ({ ...prev, isOnAir: onAir ?? !prev.isOnAir }));
  }, []);
  const toggleRecording = useCallback(() => {
    setControls((prev) => ({ ...prev, isRecording: !prev.isRecording }));
  }, []);

  const setRecording = useCallback((isRecording: boolean) => {
    patch({ isRecording });
  }, [patch]);
  const toggleMultiview = useCallback(() => {
    setControls((prev) => ({ ...prev, showMultiview: !prev.showMultiview }));
  }, []);
  const toggleFullscreen = useCallback(() => {
    setControls((prev) => ({ ...prev, fullscreenPgm: !prev.fullscreenPgm }));
  }, []);

  const setTransitionType = useCallback((type: TransitionType) => patchTransition({ type }), [patchTransition]);
  const setTransitionDuration = useCallback((durationMs: number) => patchTransition({ durationMs }), [patchTransition]);
  const setTransitionProgress = useCallback((progress: number) => patchTransition({ progress }), [patchTransition]);
  const toggleAutoTrans = useCallback(() => {
    setControls((prev) => ({
      ...prev,
      transition: { ...prev.transition, autoTrans: !prev.transition.autoTrans },
    }));
  }, []);
  const setFadeToBlackLevel = useCallback((level: number) => patchTransition({ fadeToBlackLevel: level }), [patchTransition]);

  const setPipPosition = useCallback((position: PipPosition) => patchPip({ position }), [patchPip]);
  const setPipSize = useCallback((size: PipSize) => patchPip({ size }), [patchPip]);

  const setDefaultQuality = useCallback((quality: StreamQuality) => patch({ defaultQuality: quality }), [patch]);

  const setStreamQuality = useCallback((deviceId: string, quality: StreamQuality) => {
    setControls((prev) => ({
      ...prev,
      streamQuality: { ...prev.streamQuality, [deviceId]: quality },
    }));
  }, []);

  const setOverlay = useCallback((deviceId: string, overlay: OverlayType) => {
    setControls((prev) => ({
      ...prev,
      overlays: { ...prev.overlays, [deviceId]: overlay },
    }));
  }, []);

  const setGlobalOverlay = useCallback((overlay: OverlayType) => {
    patch({ globalOverlay: overlay });
    patchLayers({ globalOverlay: overlay });
  }, [patch, patchLayers]);

  const getQualityForDevice = useCallback(
    (deviceId: string): StreamQuality => controls.streamQuality[deviceId] ?? controls.defaultQuality,
    [controls.streamQuality, controls.defaultQuality],
  );

  const getOverlayForDevice = useCallback(
    (deviceId: string): OverlayType =>
      controls.overlays[deviceId] ?? controls.layers.globalOverlay ?? controls.globalOverlay,
    [controls.overlays, controls.layers.globalOverlay, controls.globalOverlay],
  );

  const getVolumeForDevice = useCallback(
    (deviceId: string): number => {
      const { audio, pgmDeviceId } = controls;
      if (audio.masterMuted) return 0;
      if (audio.inputMuted[deviceId]) return 0;
      if (audio.soloInputId && audio.soloInputId !== deviceId) return 0;
      const inputVol = (audio.inputVolumes[deviceId] ?? 100) / 100;
      const master = audio.masterVolume / 100;
      if (audio.audioFollowVideo && deviceId !== pgmDeviceId) return 0;
      return inputVol * master;
    },
    [controls],
  );

  const setInputVolume = useCallback((deviceId: string, volume: number) => {
    setControls((prev) => ({
      ...prev,
      audio: {
        ...prev.audio,
        inputVolumes: { ...prev.audio.inputVolumes, [deviceId]: volume },
      },
    }));
  }, []);

  const toggleInputMute = useCallback((deviceId: string) => {
    setControls((prev) => ({
      ...prev,
      audio: {
        ...prev.audio,
        inputMuted: {
          ...prev.audio.inputMuted,
          [deviceId]: !prev.audio.inputMuted[deviceId],
        },
      },
    }));
  }, []);

  const toggleInputSolo = useCallback((deviceId: string) => {
    setControls((prev) => ({
      ...prev,
      audio: {
        ...prev.audio,
        soloInputId: prev.audio.soloInputId === deviceId ? null : deviceId,
      },
    }));
  }, []);

  const toggleMasterMute = useCallback(() => {
    setControls((prev) => {
      const nextMuted = !prev.audio.masterMuted;
      if (!nextMuted) void ensureAudioOutputReady();
      return {
        ...prev,
        audio: { ...prev.audio, masterMuted: nextMuted },
      };
    });
  }, []);

  const toggleViewAudioMute = useCallback((deviceId: string) => {
    setControls((prev) => {
      const currentlyMuted = prev.audio.viewAudioMuted[deviceId] ?? false;
      const nextMuted = !currentlyMuted;
      if (!nextMuted) void unlockDashboardAudio();
      return {
        ...prev,
        audio: {
          ...prev.audio,
          viewAudioMuted: {
            ...prev.audio.viewAudioMuted,
            [deviceId]: nextMuted,
          },
        },
      };
    });
  }, []);

  const isViewAudioMuted = useCallback(
    (deviceId: string): boolean => controls.audio.viewAudioMuted[deviceId] ?? false,
    [controls.audio.viewAudioMuted],
  );

  const getMonitorVolumeForDevice = useCallback(
    (deviceId: string): number => {
      const { audio } = controls;
      if (audio.monitorMasterMuted) return 0;
      if (audio.viewAudioMuted[deviceId] ?? false) return 0;
      return (audio.viewMonitorVolumes[deviceId] ?? 80) / 100;
    },
    [controls],
  );

  const setViewMonitorVolume = useCallback((deviceId: string, volume: number) => {
    if (volume > 0) void unlockDashboardAudio();
    setControls((prev) => ({
      ...prev,
      audio: {
        ...prev.audio,
        viewMonitorVolumes: { ...prev.audio.viewMonitorVolumes, [deviceId]: volume },
      },
    }));
  }, []);

  const toggleMonitorMasterMute = useCallback(() => {
    setControls((prev) => {
      const nextMuted = !prev.audio.monitorMasterMuted;
      if (!nextMuted) void unlockDashboardAudio();
      return {
        ...prev,
        audio: { ...prev.audio, monitorMasterMuted: nextMuted },
      };
    });
  }, []);

  const getMonitorAudioDeviceId = useCallback(
    (deviceId: string): string | null => {
      const source = controls.audio.inputAudioSources[deviceId] ?? 'camera';
      if (source === 'usb_audio' || source === 'capture_card') {
        return controls.audio.linkedUsbAudio[deviceId] ?? null;
      }
      return null;
    },
    [controls.audio.inputAudioSources, controls.audio.linkedUsbAudio],
  );

  const setInputAudioSource = useCallback((deviceId: string, source: AudioInputSource) => {
    setControls((prev) => ({
      ...prev,
      audio: {
        ...prev.audio,
        inputAudioSources: { ...prev.audio.inputAudioSources, [deviceId]: source },
      },
    }));
  }, []);

  const setLinkedUsbAudio = useCallback((deviceId: string, audioDeviceId: string | null) => {
    setControls((prev) => ({
      ...prev,
      audio: {
        ...prev.audio,
        linkedUsbAudio: { ...prev.audio.linkedUsbAudio, [deviceId]: audioDeviceId },
      },
    }));
  }, []);

  const hydrateDeviceAudio = useCallback(
    (entries: { deviceId: string; audioSource?: AudioInputSource; linkedAudioDeviceId?: string | null }[]) => {
      setControls((prev) => {
        const inputAudioSources = { ...prev.audio.inputAudioSources };
        const linkedUsbAudio = { ...prev.audio.linkedUsbAudio };
        for (const e of entries) {
          if (e.audioSource) inputAudioSources[e.deviceId] = e.audioSource;
          if (e.linkedAudioDeviceId !== undefined) linkedUsbAudio[e.deviceId] = e.linkedAudioDeviceId;
        }
        return {
          ...prev,
          audio: normalizeAudioSettings({
            ...prev.audio,
            inputAudioSources,
            linkedUsbAudio,
          }),
        };
      });
    },
    [],
  );

  const getAudioSourceForDevice = useCallback(
    (deviceId: string): AudioInputSource => controls.audio.inputAudioSources[deviceId] ?? 'camera',
    [controls.audio.inputAudioSources],
  );

  const setMasterVolume = useCallback((v: number) => patchAudio({ masterVolume: v }), [patchAudio]);

  const selectStream = useCallback((deviceId: string, selected?: boolean) => {
    setControls((prev) => {
      const has = prev.selectedStreamIds.includes(deviceId);
      const next =
        selected === false || (selected === undefined && has)
          ? prev.selectedStreamIds.filter((id) => id !== deviceId)
          : has
            ? prev.selectedStreamIds
            : [...prev.selectedStreamIds, deviceId];
      return { ...prev, selectedStreamIds: next };
    });
  }, []);

  const selectAllLiveStreams = useCallback(() => {
    setControls((prev) => ({
      ...prev,
      selectedStreamIds: devices.filter((d) => isRealDevice(d) && d.status === 'live').map((d) => d.deviceId),
    }));
  }, [devices]);

  const clearStreamSelection = useCallback(() => {
    patch({ selectedStreamIds: [] });
  }, [patch]);

  const setStatusFilter = useCallback(
    (status: DashboardControls['statusFilter']) => patch({ statusFilter: status }),
    [patch],
  );

  const setViewMode = useCallback((mode: DashboardControls['viewMode'], deviceId?: string) => {
    setControls((prev) => ({
      ...prev,
      viewMode: mode,
      focusedDeviceId: deviceId ?? null,
      pstDeviceId:
        deviceId && (mode === 'focus' || mode === 'single') ? deviceId : prev.pstDeviceId,
    }));
  }, []);

  const toggleOfflineTiles = useCallback((show?: boolean) => {
    setControls((prev) => ({
      ...prev,
      showOfflineTiles: show ?? !prev.showOfflineTiles,
    }));
  }, []);

  const setAspectRatio = useCallback((aspectRatio: VideoAspectRatio) => {
    setControls((prev) => ({
      ...prev,
      display: { ...prev.display, aspectRatio },
    }));
  }, []);

  const setKeyboardShortcuts = useCallback((keyboardShortcuts: KeyboardShortcutBindings) => {
    saveKeyboardShortcuts(keyboardShortcuts);
    setControls((prev) => ({ ...prev, keyboardShortcuts }));
  }, []);

  return {
    controls,
    filteredDevices,
    sourceDevices,
    liveDevices,
    pstDevice,
    pgmDevice,
    subDevice,
    transitionFromDevice,
    focusDevice,
    sendToPgm,
    sendToPst,
    sendToSub,
    setMainSource,
    cutToPreview,
    cutToDevice,
    beginTransition,
    completeTransition,
    abandonTransition,
    swapPstPgm,
    exchangeSources,
    setOutputMode,
    setActivePanel,
    toggleOpenPanel,
    setSelectedGraphicsLayer,
    toggleOnAir,
    toggleRecording,
    setRecording,
    toggleMultiview,
    toggleFullscreen,
    setTransitionType,
    setTransitionDuration,
    setTransitionProgress,
    toggleAutoTrans,
    setFadeToBlackLevel,
    setPipPosition,
    setPipSize,
    patchPip,
    patchKey,
    patchLayers,
    graphics,
    patchAudio,
    setDefaultQuality,
    setStreamQuality,
    setOverlay,
    setGlobalOverlay,
    selectStream,
    selectAllLiveStreams,
    clearStreamSelection,
    setStatusFilter,
    setViewMode,
    toggleOfflineTiles,
    getQualityForDevice,
    getOverlayForDevice,
    getVolumeForDevice,
    setInputVolume,
    toggleInputMute,
    toggleInputSolo,
    toggleMasterMute,
    setMasterVolume,
    toggleViewAudioMute,
    isViewAudioMuted,
    getMonitorVolumeForDevice,
    setViewMonitorVolume,
    toggleMonitorMasterMute,
    getMonitorAudioDeviceId,
    setInputAudioSource,
    setLinkedUsbAudio,
    hydrateDeviceAudio,
    getAudioSourceForDevice,
    setAspectRatio,
    setKeyboardShortcuts,
  };
}
