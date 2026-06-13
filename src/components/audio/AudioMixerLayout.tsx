import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid, LogOut, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useProduction } from '../../context/ProductionContext';
import { reconnectWhepPoolDevice } from '../../lib/whepStreamPool';
import { useCloudCast } from '../../context/CloudCastContext';
import { AccessCodePanel } from '../session/AccessCodePanel';
import { CloudCastLogo } from '../brand/CloudCastLogo';
import { CLOUDCAST_NAV_LOGO } from '../../lib/branding';
import { resolveProductPlan, canLinkAudioVideoMixers, canUseAudioFatChannel } from '../../lib/productEntitlements';
import { useAudioConsoleState } from '../../hooks/useAudioConsoleState';
import { useAudioMixerEngine } from '../../hooks/useAudioMixerEngine';
import { useAudioConsoleShortcuts } from '../../hooks/useAudioConsoleShortcuts';
import { useLocalHostAudioInputs } from '../../hooks/useLocalHostAudioInputs';
import { useAudioOperatorLocks } from '../../hooks/useAudioOperatorLocks';
import { useAudioSessionSyncPublisher, useAudioSessionSyncSubscriber } from '../../hooks/useAudioSessionSync';
import { updateDeviceAudioSettings } from '../../lib/streamingService';
import { logAudioAudit } from '../../lib/audioAuditService';
import type { AudioSessionSyncPayload } from '../../lib/audioSessionSync';
import { StudioLiveConsole } from './StudioLiveConsole';
import { AudioUnlockBanner } from './AudioUnlockBanner';
import { VideoBridgePanel } from './VideoBridgePanel';
import { AudioMixerEngineProvider } from '../../context/AudioMixerEngineContext';
import { AudioStreamResolverProvider } from '../../context/AudioStreamResolverContext';
import { AudioOperatorLockBanner } from './AudioOperatorLockBanner';
import { AudioSessionSyncPanel } from './AudioSessionSyncPanel';
import { AudioMixerDebugPanel } from './AudioMixerDebugPanel';
import { AudioAuditPanel } from './AudioAuditPanel';
import { AudioShowPresetsPanel } from './AudioShowPresetsPanel';
import { usePgmBridgePublisher } from '../../lib/pgmBridgeTransport';
import { AUDIO_MIXER_MAX_CHANNELS, audioChannelsForPlan } from '../../config/products';
import { createEmptyAudioSlot, isRealDevice } from '../../types/device';
import type { AudioInputSource } from '../../types/audio';
import type { SceneId } from '../../lib/audioConsolePersistence';
import { useAudioConsoleSnapshotPublisher } from '../../hooks/useAudioConsoleSnapshot';
import { fetchAudioShowPresets, type AudioShowPreset } from '../../lib/audioShowPresets';
import { fetchAudioShowLibrary, promoteAudioShowToLibrary, type AudioShowLibraryEntry } from '../../lib/audioShowLibrary';
import { importAudioShowByShareCode, publishAudioShowShareCode } from '../../lib/audioShowShare';
import {
  enqueueAudioOpsDigest,
  fetchAudioOpsDigestPrefs,
  maybeSendScheduledAudioOpsDigest,
  saveAudioOpsDigestPrefs,
  type AudioOpsDigestPrefs,
} from '../../lib/audioOpsDigest';
import {
  fetchLatestAudioConsoleSnapshot,
  snapshotAgeMinutes,
  type AudioConsoleSnapshot,
} from '../../lib/audioConsoleSnapshot';
import {
  AudioConsoleSnapshotPanel,
  AudioOpsDigestPanel,
  AudioShowLibraryPanel,
  AudioShowSharePanel,
} from './AudioPhase2Panels';
import { ProgramPresetToolbar } from '../presets/ProgramPresetToolbar';
import { AudioSceneDiffPanel, AudioSceneRundownPanel } from './AudioPhase3Panels';
import { AudioFxDiffPanel, AudioSceneRundownSharePanel } from './AudioPhase4Panels';
import { AudioSceneBackupPanel, AudioSceneRundownLibraryPanel } from './AudioPhase5Panels';
import {
  AudioChannelInventoryPanel,
  AudioConsoleLifecyclePanel,
  AudioRundownRunSheetPanel,
} from './AudioPhase6Panels';
import {
  applyAudioLifecyclePolicy,
  fetchAudioLifecyclePrefs,
  maybeApplyAudioLifecyclePolicy,
  saveAudioLifecyclePrefs,
  type AudioLifecyclePrefs,
} from '../../lib/audioConsoleLifecycle';
import {
  AudioComplianceBundlePanel,
  AudioComplianceExportPresetsPanel,
} from './AudioPhase7Panels';
import type { AudioComplianceExportPreset } from '../../lib/audioComplianceExportPresets';
import { resolveDefaultComplianceExportPreset } from '../../lib/audioComplianceExportPresets';
import { fetchAudioSceneRundownTemplates, type AudioSceneRundownItem } from '../../lib/audioSceneRundown';
import { importSceneRundownByShareCode, publishSceneRundownShareCode } from '../../lib/audioSceneRundownShare';
import {
  fetchAudioSceneRundownLibrary,
  promoteSceneRundownToLibrary,
  type AudioSceneRundownLibraryEntry,
} from '../../lib/audioSceneRundownLibrary';
import { fetchAudioSceneBackups, upsertAudioSceneBackup, type AudioSceneBackupRow } from '../../lib/audioSceneBackup';
import { captureSceneSnapshot } from '../../lib/audioConsolePersistence';
import { getFollowRundownMirrorPref, setFollowRundownMirrorPref } from '../../lib/audioFollowerPrefs';
import { cn } from '../../lib/utils';
import { PRODUCTION_OFFSCREEN_STYLE, productionShellClass } from '../../lib/productionShell';

interface AudioMixerLayoutProps {
  hidden?: boolean;
}

export function AudioMixerLayout({ hidden = false }: AudioMixerLayoutProps) {
  const { profile, signOut } = useAuth();
  const { setAudioConsoleActive } = useProduction();
  const { session, sessionLoading, devices, regenerateCode, isRegenerating, reconnect, error, getMeshStream } =
    useCloudCast();
  const planId = resolveProductPlan(profile, 'audio_mixer');
  const canBridge = canLinkAudioVideoMixers(profile);
  const canCloud = planId !== 'free';
  const canFatChannel = canUseAudioFatChannel(planId);
  const [bridgeCode, setBridgeCode] = useState<string | null>(null);
  const [remoteSync, setRemoteSync] = useState<AudioSessionSyncPayload | null>(null);
  const [lastRecalledScene, setLastRecalledScene] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState<AudioShowPreset[]>([]);
  const [showLibrary, setShowLibrary] = useState<AudioShowLibraryEntry[]>([]);
  const [consoleSnapshot, setConsoleSnapshot] = useState<AudioConsoleSnapshot | null>(null);
  const [opsDigestPrefs, setOpsDigestPrefs] = useState<AudioOpsDigestPrefs | null>(null);
  const [rundownSync, setRundownSync] = useState({
    active: false,
    stepIndex: null as number | null,
    total: 0,
    scenes: [] as string[],
    currentScene: null as string | null,
  });
  const [rundownTemplates, setRundownTemplates] = useState<Array<{ id: string; name: string }>>([]);
  const [rundownLibrary, setRundownLibrary] = useState<AudioSceneRundownLibraryEntry[]>([]);
  const [sceneBackups, setSceneBackups] = useState<AudioSceneBackupRow[]>([]);
  const [rundownDraftLoad, setRundownDraftLoad] = useState<{
    items: AudioSceneRundownItem[];
    name: string;
    token: number;
  } | null>(null);
  const [followRundownMirror, setFollowRundownMirror] = useState(() => getFollowRundownMirrorPref());
  const [rundownDraft, setRundownDraft] = useState<AudioSceneRundownItem[]>([]);
  const [rundownDraftName, setRundownDraftName] = useState('Scene rundown');
  const [lifecyclePrefs, setLifecyclePrefs] = useState<AudioLifecyclePrefs | null>(null);
  const [complianceExportPreset, setComplianceExportPreset] = useState<AudioComplianceExportPreset>(
    () => resolveDefaultComplianceExportPreset([]),
  );
  const followerRundownSceneRef = useRef<string | null>(null);
  const bridgeConnectedRef = useRef(false);

  const sessionId = session?.sessionId ?? null;
  const operatorLabel = profile?.full_name ?? profile?.email ?? 'A1 operator';
  const operatorLocks = useAudioOperatorLocks({
    sessionId,
    operatorLabel,
    enabled: Boolean(sessionId) && !hidden,
  });

  const {
    state,
    scenes,
    linkedUsb,
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
  } = useAudioConsoleState(devices);

  const maxHostUsbInputs = session?.maxUsbDevices ?? 2;
  const hostUsb = useLocalHostAudioInputs(maxHostUsbInputs);

  const mergedDevices = useMemo(() => {
    const paired = devices.filter(isRealDevice);
    const withHost = [...paired, ...hostUsb.localDevices];
    const padded = [...withHost];
    while (padded.length < AUDIO_MIXER_MAX_CHANNELS) {
      padded.push(createEmptyAudioSlot(padded.length + 1));
    }
    return padded.slice(0, AUDIO_MIXER_MAX_CHANNELS);
  }, [devices, hostUsb.localDevices]);

  const resolveAudioStream = useCallback(
    (deviceId: string) => hostUsb.localStreams.get(deviceId) ?? getMeshStream(deviceId),
    [getMeshStream, hostUsb.localStreams],
  );

  const { meters } = useAudioMixerEngine({
    devices: mergedDevices,
    state,
    getAudioSourceForDevice,
    linkedUsbAudio: linkedUsb,
    learningNoiseFor,
    onNoiseFloorLearned,
    resolveStream: resolveAudioStream,
  });

  usePgmBridgePublisher({
    bridgeCode,
    getPgmStream: meters.getPgmStream,
    enabled: canBridge && Boolean(bridgeCode) && !operatorLocks.readOnly,
  });

  const bridgeConnected = canBridge && Boolean(bridgeCode) && !operatorLocks.readOnly;

  useEffect(() => {
    if (bridgeConnected && !bridgeConnectedRef.current) {
      bridgeConnectedRef.current = true;
      void logAudioAudit({
        eventType: 'pgm_bridge_connect',
        sessionId,
        label: bridgeCode ?? undefined,
      });
    }
    if (!bridgeConnected && bridgeConnectedRef.current) {
      bridgeConnectedRef.current = false;
      void logAudioAudit({ eventType: 'pgm_bridge_disconnect', sessionId });
    }
  }, [bridgeConnected, bridgeCode, sessionId]);

  const channelDeviceIds = useMemo(
    () => mergedDevices.map((d) => (isRealDevice(d) ? d.deviceId : '')),
    [mergedDevices],
  );

  const storedSceneCount = useMemo(() => Object.keys(scenes).length, [scenes]);
  const activeChannels = audioChannelsForPlan(planId);
  const liveInputCount = useMemo(
    () => mergedDevices.filter((d) => isRealDevice(d) && d.status !== 'offline').length,
    [mergedDevices],
  );
  const mutedChannelCount = useMemo(
    () => Object.values(state.inputMuted).filter(Boolean).length,
    [state.inputMuted],
  );

  const refreshRundownTemplates = useCallback(async () => {
    if (!canCloud) {
      setRundownTemplates([]);
      return;
    }
    try {
      const rows = await fetchAudioSceneRundownTemplates(sessionId);
      setRundownTemplates(rows.map((row) => ({ id: row.id, name: row.name })));
    } catch {
      /* offline */
    }
  }, [canCloud, sessionId]);

  const refreshRundownLibrary = useCallback(async () => {
    if (!canCloud) {
      setRundownLibrary([]);
      return;
    }
    try {
      setRundownLibrary(await fetchAudioSceneRundownLibrary());
    } catch {
      /* offline */
    }
  }, [canCloud]);

  const refreshSceneBackups = useCallback(async () => {
    if (!canCloud) {
      setSceneBackups([]);
      return;
    }
    try {
      setSceneBackups(await fetchAudioSceneBackups(sessionId));
    } catch {
      /* offline */
    }
  }, [canCloud, sessionId]);

  const refreshShowPresets = useCallback(async () => {
    if (!canCloud) {
      setShowPresets([]);
      return;
    }
    try {
      setShowPresets(await fetchAudioShowPresets(sessionId));
    } catch {
      /* offline */
    }
  }, [canCloud, sessionId]);

  const refreshShowLibrary = useCallback(async () => {
    if (!canCloud) {
      setShowLibrary([]);
      return;
    }
    try {
      setShowLibrary(await fetchAudioShowLibrary());
    } catch {
      /* offline */
    }
  }, [canCloud]);

  const refreshPhase2Prefs = useCallback(async () => {
    if (!canCloud) return;
    try {
      setOpsDigestPrefs(await fetchAudioOpsDigestPrefs());
      setLifecyclePrefs(await fetchAudioLifecyclePrefs());
      if (sessionId) {
        setConsoleSnapshot(await fetchLatestAudioConsoleSnapshot(sessionId));
      }
    } catch {
      /* offline */
    }
  }, [canCloud, sessionId]);

  useEffect(() => {
    void refreshShowPresets();
    void refreshShowLibrary();
    void refreshPhase2Prefs();
    void refreshRundownTemplates();
    void refreshRundownLibrary();
    void refreshSceneBackups();
  }, [refreshShowPresets, refreshShowLibrary, refreshPhase2Prefs, refreshRundownTemplates, refreshRundownLibrary, refreshSceneBackups]);

  useEffect(() => {
    if (!canCloud || hidden) return;
    void maybeSendScheduledAudioOpsDigest().then((result) => {
      if (result.queued) {
        void logAudioAudit({ eventType: 'scheduled_digest_sent', sessionId });
        void fetchAudioOpsDigestPrefs().then(setOpsDigestPrefs);
      }
    });
    void maybeApplyAudioLifecyclePolicy().then((result) => {
      if (result.applied) {
        void logAudioAudit({
          eventType: 'auto_lifecycle_applied',
          sessionId,
          meta: {
            prunedSnapshots: result.prunedSnapshotCount ?? 0,
            prunedBackups: result.prunedBackupCount ?? 0,
          },
        });
        void refreshSceneBackups();
        if (sessionId) {
          void fetchLatestAudioConsoleSnapshot(sessionId).then(setConsoleSnapshot).catch(() => {
            /* offline */
          });
        }
        void fetchAudioLifecyclePrefs().then(setLifecyclePrefs);
      }
    });
  }, [canCloud, hidden, sessionId, refreshSceneBackups]);

  useAudioConsoleSnapshotPublisher({
    enabled: canCloud && Boolean(sessionId) && !hidden && !operatorLocks.readOnly,
    sessionId,
    operatorKey: operatorLocks.operatorKey,
    operatorLabel,
    masterVolume: state.masterVolume,
    masterMuted: state.masterMuted,
    monitorMuted: state.monitorMuted,
    consoleEnabled: state.consoleEnabled,
    activeScene: lastRecalledScene,
    selectedChannel: state.selectedChannel,
    liveInputCount,
    mutedChannelCount,
    bridgeConnected,
  });

  useEffect(() => {
    if (!sessionId || !canCloud || !state.consoleEnabled) return;
    void fetchLatestAudioConsoleSnapshot(sessionId).then(setConsoleSnapshot);
  }, [
    sessionId,
    canCloud,
    state.consoleEnabled,
    state.masterVolume,
    state.masterMuted,
    mutedChannelCount,
    bridgeConnected,
  ]);

  useAudioSessionSyncPublisher(
    sessionId,
    session?.realtimeChannel,
    operatorLocks.readOnly
      ? null
      : {
          operatorKey: operatorLocks.operatorKey,
          operatorLabel,
          selectedChannel: state.selectedChannel,
          activeBank: state.activeBank,
          masterVolume: state.masterVolume,
          masterMuted: state.masterMuted,
          monitorMuted: state.monitorMuted,
          consoleEnabled: state.consoleEnabled,
          soloDeviceId: state.soloId,
          activeScene: lastRecalledScene,
          bridgeConnected,
          rundownActive: rundownSync.active,
          rundownStepIndex: rundownSync.stepIndex,
          rundownTotal: rundownSync.total,
          rundownScenes: rundownSync.scenes,
          rundownCurrentScene: rundownSync.currentScene,
        },
    Boolean(sessionId) && !hidden && !operatorLocks.readOnly,
  );

  useAudioSessionSyncSubscriber(
    sessionId,
    session?.realtimeChannel,
    operatorLocks.operatorKey,
    setRemoteSync,
    Boolean(sessionId) && !hidden && operatorLocks.readOnly,
  );

  useEffect(() => {
    if (!operatorLocks.readOnly || !remoteSync?.rundownActive || !followRundownMirror) {
      followerRundownSceneRef.current = null;
      return;
    }
    const scene = remoteSync.rundownCurrentScene as SceneId | null | undefined;
    if (!scene || !scenes[scene]) return;
    if (followerRundownSceneRef.current === scene) return;
    followerRundownSceneRef.current = scene;
    onRecallScene(scene);
    setLastRecalledScene(scene);
  }, [
    operatorLocks.readOnly,
    remoteSync?.rundownActive,
    remoteSync?.rundownCurrentScene,
    scenes,
    onRecallScene,
    followRundownMirror,
  ]);

  const persistSource = useCallback(
    async (deviceId: string, source: AudioInputSource, linkedId: string | null) => {
      if (!session?.accessCode) return;
      try {
        await updateDeviceAudioSettings(session.accessCode, deviceId, source, linkedId);
      } catch {
        /* non-blocking */
      }
    },
    [session?.accessCode],
  );

  const handleSetSource = useCallback(
    (deviceId: string, source: AudioInputSource) => {
      if (operatorLocks.readOnly) return;
      setInputAudioSource(deviceId, source);
      void persistSource(deviceId, source, linkedUsb[deviceId] ?? null);
      void logAudioAudit({
        eventType: 'source_change',
        sessionId,
        label: source,
        meta: { deviceId },
      });
    },
    [linkedUsb, persistSource, setInputAudioSource, operatorLocks.readOnly, sessionId],
  );

  const handleSetLinkedUsb = useCallback(
    (deviceId: string, audioDeviceId: string | null) => {
      if (operatorLocks.readOnly) return;
      setLinkedUsbAudio(deviceId, audioDeviceId);
      void persistSource(deviceId, getAudioSourceForDevice(deviceId), audioDeviceId);
    },
    [getAudioSourceForDevice, persistSource, setLinkedUsbAudio, operatorLocks.readOnly],
  );

  const guard = useCallback(
    <T extends (...args: never[]) => void>(fn: T): T =>
      ((...args: Parameters<T>) => {
        if (operatorLocks.readOnly) return;
        fn(...args);
      }) as T,
    [operatorLocks.readOnly],
  );

  const handleToggleMasterMute = useCallback(() => {
    if (operatorLocks.readOnly) return;
    onToggleMasterMute();
    void logAudioAudit({
      eventType: 'master_mute',
      sessionId,
      meta: { muted: !state.masterMuted },
    });
  }, [operatorLocks.readOnly, onToggleMasterMute, sessionId, state.masterMuted]);

  const handleToggleMonitorMute = useCallback(() => {
    if (operatorLocks.readOnly) return;
    onToggleMonitorMute();
    void logAudioAudit({
      eventType: 'monitor_mute',
      sessionId,
      meta: { muted: !state.monitorMuted },
    });
  }, [operatorLocks.readOnly, onToggleMonitorMute, sessionId, state.monitorMuted]);

  const handleToggleConsoleEnabled = useCallback(() => {
    if (operatorLocks.readOnly) return;
    onToggleConsoleEnabled();
    void logAudioAudit({
      eventType: 'console_power',
      sessionId,
      meta: { enabled: !state.consoleEnabled },
    });
  }, [operatorLocks.readOnly, onToggleConsoleEnabled, sessionId, state.consoleEnabled]);

  const handleToggleMute = useCallback(
    (deviceId: string) => {
      if (operatorLocks.readOnly) return;
      onToggleMute(deviceId);
      const index = channelDeviceIds.indexOf(deviceId);
      void logAudioAudit({
        eventType: 'channel_mute',
        sessionId,
        channelIndex: index >= 0 ? index : null,
        meta: { muted: !state.inputMuted[deviceId], deviceId },
      });
    },
    [operatorLocks.readOnly, onToggleMute, channelDeviceIds, sessionId, state.inputMuted],
  );

  const handleToggleSolo = useCallback(
    (deviceId: string) => {
      if (operatorLocks.readOnly) return;
      onToggleSolo(deviceId);
      const index = channelDeviceIds.indexOf(deviceId);
      void logAudioAudit({
        eventType: 'channel_solo',
        sessionId,
        channelIndex: index >= 0 ? index : null,
        meta: { deviceId },
      });
    },
    [operatorLocks.readOnly, onToggleSolo, channelDeviceIds, sessionId],
  );

  const handleStoreScene = useCallback(
    (sceneId: SceneId) => {
      if (operatorLocks.readOnly) return;
      const snapshot = captureSceneSnapshot(state);
      onStoreScene(sceneId);
      void logAudioAudit({ eventType: 'scene_store', sessionId, sceneId });
      if (canCloud) {
        void upsertAudioSceneBackup({ sessionId, sceneId, snapshot })
          .then(() => refreshSceneBackups())
          .catch(() => {
            /* non-blocking */
          });
      }
    },
    [operatorLocks.readOnly, onStoreScene, sessionId, state, canCloud, refreshSceneBackups],
  );

  const handleRecallScene = useCallback(
    (sceneId: SceneId) => {
      if (operatorLocks.readOnly) return;
      onRecallScene(sceneId);
      setLastRecalledScene(sceneId);
      void logAudioAudit({ eventType: 'scene_recall', sessionId, sceneId });
    },
    [operatorLocks.readOnly, onRecallScene, sessionId],
  );

  const handlePublishShowShare = useCallback(
    async (presetId: string) => {
      const code = await publishAudioShowShareCode(presetId);
      void logAudioAudit({ eventType: 'show_shared', sessionId, label: code, meta: { presetId } });
      return code;
    },
    [sessionId],
  );

  const handleImportShowShare = useCallback(
    async (code: string) => {
      const imported = await importAudioShowByShareCode(code);
      void logAudioAudit({ eventType: 'show_imported', sessionId, label: imported.name, meta: { shareCode: code } });
      await refreshShowPresets();
    },
    [sessionId, refreshShowPresets],
  );

  const handlePromoteShowLibrary = useCallback(
    async (presetId: string, category: string) => {
      const promoted = await promoteAudioShowToLibrary(presetId, category);
      void logAudioAudit({
        eventType: 'show_library_promoted',
        sessionId,
        label: promoted.name,
        meta: { category, presetId },
      });
      await Promise.all([refreshShowPresets(), refreshShowLibrary()]);
    },
    [sessionId, refreshShowPresets, refreshShowLibrary],
  );

  const handleLoadLibraryPreset = useCallback(
    (presetId: string) => {
      const entry =
        showLibrary.find((p) => p.id === presetId) ??
        showPresets.find((p) => p.id === presetId);
      if (!entry) return;
      applyPersistedConfig(entry.config);
      void logAudioAudit({ eventType: 'show_preset_loaded', sessionId, label: entry.name });
    },
    [showLibrary, showPresets, applyPersistedConfig, sessionId],
  );

  const handleSaveOpsDigestPrefs = useCallback(async (enabled: boolean, frequency: AudioOpsDigestPrefs['frequency']) => {
    setOpsDigestPrefs(await saveAudioOpsDigestPrefs(enabled, frequency));
  }, []);

  const handleSendOpsDigest = useCallback(async () => {
    const result = await enqueueAudioOpsDigest();
    if (!result.queued && result.reason === 'rate_limited') {
      throw new Error('Digest sent recently — try again in an hour.');
    }
    void logAudioAudit({ eventType: 'ops_digest_sent', sessionId });
    setOpsDigestPrefs(await fetchAudioOpsDigestPrefs());
  }, [sessionId]);

  const handleRundownStart = useCallback(
    (count: number, sceneIds: string[]) => {
      setRundownSync({
        active: true,
        stepIndex: 0,
        total: count,
        scenes: sceneIds,
        currentScene: null,
      });
      void logAudioAudit({ eventType: 'scene_rundown_start', sessionId, meta: { count, scenes: sceneIds } });
    },
    [sessionId],
  );

  const handleRundownAdvance = useCallback(
    (sceneId: SceneId, index: number) => {
      setRundownSync((prev) => ({
        ...prev,
        stepIndex: index,
        currentScene: sceneId,
      }));
      void logAudioAudit({
        eventType: 'scene_rundown_advance',
        sessionId,
        sceneId,
        meta: { index },
      });
      setLastRecalledScene(sceneId);
    },
    [sessionId],
  );

  const resetRundownSync = useCallback(() => {
    setRundownSync({
      active: false,
      stepIndex: null,
      total: 0,
      scenes: [],
      currentScene: null,
    });
  }, []);

  const handleRundownComplete = useCallback(() => {
    resetRundownSync();
    void logAudioAudit({ eventType: 'scene_rundown_complete', sessionId });
  }, [resetRundownSync, sessionId]);

  const handleRundownStop = useCallback(() => {
    resetRundownSync();
  }, [resetRundownSync]);

  const handlePublishRundownShare = useCallback(
    async (templateId: string) => {
      const code = await publishSceneRundownShareCode(templateId);
      void logAudioAudit({ eventType: 'rundown_shared', sessionId, label: code, meta: { templateId } });
      return code;
    },
    [sessionId],
  );

  const handleImportRundownShare = useCallback(
    async (code: string) => {
      const imported = await importSceneRundownByShareCode(code);
      void logAudioAudit({
        eventType: 'rundown_imported',
        sessionId,
        label: imported.name,
        meta: { shareCode: code },
      });
      await refreshRundownTemplates();
      await refreshRundownLibrary();
    },
    [sessionId, refreshRundownTemplates, refreshRundownLibrary],
  );

  const handlePromoteRundownLibrary = useCallback(
    async (templateId: string, category: string) => {
      const promoted = await promoteSceneRundownToLibrary(templateId, category);
      void logAudioAudit({
        eventType: 'rundown_library_promoted',
        sessionId,
        label: promoted.name,
        meta: { category },
      });
      await refreshRundownLibrary();
      await refreshRundownTemplates();
    },
    [sessionId, refreshRundownLibrary, refreshRundownTemplates],
  );

  const handleRestoreSceneBackup = useCallback(
    (sceneId: SceneId) => {
      if (operatorLocks.readOnly) return;
      const backup = sceneBackups.find((row) => row.sceneId === sceneId);
      if (!backup) return;
      applyPersistedConfig({
        ...buildPersistedConfig(),
        scenes: { ...scenes, [sceneId]: backup.snapshot },
      });
      setLastRecalledScene(sceneId);
      void logAudioAudit({ eventType: 'scene_backup_restored', sessionId, sceneId });
    },
    [operatorLocks.readOnly, sceneBackups, applyPersistedConfig, buildPersistedConfig, scenes, sessionId],
  );

  const handleFollowRundownMirrorChange = useCallback((enabled: boolean) => {
    setFollowRundownMirrorPref(enabled);
    setFollowRundownMirror(enabled);
    followerRundownSceneRef.current = null;
  }, []);

  const handleSaveLifecyclePrefs = useCallback(async (prefs: AudioLifecyclePrefs) => {
    setLifecyclePrefs(await saveAudioLifecyclePrefs(prefs));
  }, []);

  const handleApplyLifecyclePolicy = useCallback(async () => {
    const result = await applyAudioLifecyclePolicy();
    void logAudioAudit({
      eventType: 'lifecycle_policy_applied',
      sessionId,
      meta: { prunedSnapshots: result.prunedSnapshotCount, prunedBackups: result.prunedBackupCount },
    });
    await refreshSceneBackups();
    if (sessionId) {
      try {
        setConsoleSnapshot(await fetchLatestAudioConsoleSnapshot(sessionId));
      } catch {
        /* offline */
      }
    }
    return result;
  }, [sessionId, refreshSceneBackups]);

  const handleRundownDraftChange = useCallback((items: AudioSceneRundownItem[], name: string) => {
    setRundownDraft(items);
    setRundownDraftName(name);
  }, []);

  useAudioConsoleShortcuts(
    state,
    channelDeviceIds,
    {
      onSelectChannel: guard(onSelectChannel),
      onToggleMute: handleToggleMute,
      onToggleSolo: handleToggleSolo,
      onToggleMasterMute: handleToggleMasterMute,
      onToggleMonitorMute: handleToggleMonitorMute,
      onStoreScene: handleStoreScene,
      onRecallScene: handleRecallScene,
    },
    !operatorLocks.readOnly,
  );

  useEffect(() => {
    setAudioConsoleActive(true);
    return () => setAudioConsoleActive(false);
  }, [setAudioConsoleActive]);

  useEffect(() => {
    hydrateFromDevices(devices);
  }, [devices, hydrateFromDevices]);

  useEffect(() => {
    const onOnline = () => {
      reconnect();
      for (const device of devices) {
        if (device.whepUrl) reconnectWhepPoolDevice(device.deviceId);
      }
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [devices, reconnect]);

  return (
    <AudioStreamResolverProvider resolveStream={resolveAudioStream}>
    <AudioMixerEngineProvider value={meters}>
    <div
      className={cn(
        productionShellClass(hidden, 'audio-mixer-shell flex h-full min-h-0 flex-col overflow-hidden'),
      )}
      style={hidden ? PRODUCTION_OFFSCREEN_STYLE : undefined}
      aria-hidden={hidden}
    >
      {!hidden && (
      <header className="audio-mixer-header flex shrink-0 items-center justify-between gap-2 border-b border-sky-500/20 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <CloudCastLogo variant={CLOUDCAST_NAV_LOGO.variant} className={CLOUDCAST_NAV_LOGO.className} />
          <span className="hidden items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-sky-300 sm:inline-flex">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Audio Mixer · {AUDIO_MIXER_MAX_CHANNELS}ch
          </span>
          {profile && (
            <span className="rounded bg-sky-500/15 px-2 py-0.5 text-[9px] font-bold tracking-wider text-sky-200 ring-1 ring-sky-400/20">
              {profile.entitlements?.universal ? 'UNIVERSAL' : planId.toUpperCase()}
            </span>
          )}
        </div>
        <AccessCodePanel
          session={session}
          isLoading={sessionLoading}
          onRegenerate={regenerateCode}
          isRegenerating={isRegenerating}
          product="audio"
          error={error}
          onRetry={reconnect}
          className="min-w-0 flex"
        />
        <VideoBridgePanel
          mode="audio"
          sessionId={session?.sessionId}
          accessCode={session?.accessCode}
          realtimeChannel={session?.realtimeChannel}
          sessionLoading={sessionLoading}
          onBridgeCodeChange={setBridgeCode}
          className="hidden lg:flex shrink-0"
        />
        <ProgramPresetToolbar />
        <div className="flex shrink-0 items-center gap-2 text-[10px]">
          <Link to="/hub" className="hidden items-center gap-1 text-sky-200/60 hover:text-white sm:inline-flex" title="All products">
            <LayoutGrid className="h-3.5 w-3.5" /> HUB
          </Link>
          <Link to="/profile" className="hidden text-sky-200/60 hover:text-white lg:inline">Profile</Link>
          <button type="button" onClick={() => { void signOut(); }} className="mixer-btn p-1" title="Sign out">
            <LogOut className="h-3 w-3" />
          </button>
        </div>
      </header>
      )}

      <AudioOperatorLockBanner
        active={Boolean(sessionId) && !hidden}
        readOnly={operatorLocks.readOnly}
        blockingHolder={operatorLocks.blockingHolder}
        operatorLabel={operatorLabel}
      />

      <div className="min-h-0 flex-1 overflow-auto p-2 sm:p-3">
        <AudioUnlockBanner />
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
          <StudioLiveConsole
            devices={mergedDevices}
            planId={planId}
            state={state}
            scenes={scenes}
            getAudioSourceForDevice={getAudioSourceForDevice}
            linkedUsbAudio={linkedUsb}
            readOnly={operatorLocks.readOnly}
            fatChannelLocked={!canFatChannel}
            onSelectChannel={guard(onSelectChannel)}
            onSetBank={guard(onSetBank)}
            onToggleMix={guard(onToggleMix)}
            onToggleMute={handleToggleMute}
            onToggleSolo={handleToggleSolo}
            onSetVolume={guard(onSetVolume)}
            onSetMasterVolume={guard(onSetMasterVolume)}
            onSetMonitorVolume={guard(onSetMonitorVolume)}
            onToggleMasterMute={handleToggleMasterMute}
            onToggleMonitorMute={handleToggleMonitorMute}
            onToggleConsoleEnabled={handleToggleConsoleEnabled}
            onTogglePeakHold={guard(onTogglePeakHold)}
            onSetFatParam={guard(onSetFatParam)}
            onToggleHpfBypass={guard(onToggleHpfBypass)}
            onPatchNoiseCancel={guard(onPatchNoiseCancel)}
            onLearnNoiseFloor={guard(onLearnNoiseFloor)}
            learningNoiseFor={learningNoiseFor}
            onSetMixSend={guard(onSetMixSend)}
            onToggleFx={guard(onToggleFx)}
            onSetFxMix={guard(onSetFxMix)}
            onSetChannelLabel={guard(onSetChannelLabel)}
            onSetSource={handleSetSource}
            onSetLinkedUsb={handleSetLinkedUsb}
            onStoreScene={handleStoreScene}
            onRecallScene={handleRecallScene}
            hostUsb={{
              localDevices: hostUsb.localDevices,
              selectableDevices: hostUsb.selectableDevices,
              deviceLabels: hostUsb.deviceLabels,
              maxInputs: maxHostUsbInputs,
              error: hostUsb.error,
              scanning: hostUsb.scanning,
              atLimit: hostUsb.atLimit,
              onAdd: hostUsb.addInput,
              onRemove: hostUsb.removeInput,
              onRefresh: hostUsb.refreshDeviceList,
            }}
          />

          {!hidden && (
            <aside className="studiolive-enterprise-sidebar space-y-0">
              {operatorLocks.readOnly && (
                <AudioSessionSyncPanel
                  remoteState={remoteSync}
                  followRundownMirror={followRundownMirror}
                  onFollowRundownMirrorChange={handleFollowRundownMirrorChange}
                />
              )}
              <AudioShowPresetsPanel
                canSave={canCloud}
                readOnly={operatorLocks.readOnly}
                sessionId={sessionId}
                buildConfig={buildPersistedConfig}
                onLoadConfig={applyPersistedConfig}
                onSaved={(name) => {
                  void logAudioAudit({ eventType: 'show_preset_saved', sessionId, label: name });
                  void refreshShowPresets();
                }}
                onLoaded={(name) => {
                  void logAudioAudit({ eventType: 'show_preset_loaded', sessionId, label: name });
                }}
              />
              <AudioShowSharePanel
                canShare={canCloud}
                readOnly={operatorLocks.readOnly}
                presets={showPresets.map((p) => ({ id: p.id, name: p.name }))}
                onPublishShare={handlePublishShowShare}
                onImportShare={handleImportShowShare}
              />
              <AudioShowLibraryPanel
                canUse={canCloud}
                readOnly={operatorLocks.readOnly}
                presets={showPresets.map((p) => ({ id: p.id, name: p.name }))}
                libraryEntries={showLibrary.map((p) => ({
                  id: p.id,
                  name: p.name,
                  category: p.libraryCategory,
                }))}
                onPromote={handlePromoteShowLibrary}
                onLoad={handleLoadLibraryPreset}
              />
              <AudioSceneRundownPanel
                canUse={canCloud}
                readOnly={operatorLocks.readOnly}
                sessionId={sessionId}
                storedScenes={scenes}
                onRecallScene={handleRecallScene}
                onRundownStart={handleRundownStart}
                onRundownAdvance={handleRundownAdvance}
                onRundownComplete={handleRundownComplete}
                onRundownStop={handleRundownStop}
                loadDraftRequest={rundownDraftLoad}
                onDraftChange={handleRundownDraftChange}
              />
              <AudioRundownRunSheetPanel
                canUse={canCloud}
                draft={rundownDraft}
                templateName={rundownDraftName}
                onExport={() => {
                  void logAudioAudit({ eventType: 'rundown_runsheet_exported', sessionId });
                }}
              />
              <AudioSceneRundownSharePanel
                canShare={canCloud}
                readOnly={operatorLocks.readOnly}
                templates={rundownTemplates}
                onPublishShare={handlePublishRundownShare}
                onImportShare={handleImportRundownShare}
                onImported={() => {
                  void refreshRundownTemplates();
                  void refreshRundownLibrary();
                }}
              />
              <AudioSceneRundownLibraryPanel
                canUse={canCloud}
                readOnly={operatorLocks.readOnly}
                templates={rundownTemplates}
                libraryEntries={rundownLibrary.map((entry) => ({
                  id: entry.id,
                  name: entry.name,
                  category: entry.libraryCategory,
                  items: entry.items,
                }))}
                onPromote={handlePromoteRundownLibrary}
                onLoadItems={(items, name) => {
                  setRundownDraftLoad({ items, name, token: Date.now() });
                }}
              />
              <AudioSceneBackupPanel
                canUse={canCloud}
                readOnly={operatorLocks.readOnly}
                backups={sceneBackups.map((row) => ({ sceneId: row.sceneId, updatedAt: row.updatedAt }))}
                storedScenes={scenes}
                onRestore={handleRestoreSceneBackup}
              />
              <AudioChannelInventoryPanel
                canUse={canCloud}
                devices={mergedDevices}
                state={state}
                getAudioSourceForDevice={getAudioSourceForDevice}
                linkedUsb={linkedUsb}
                sessionId={sessionId}
                onExport={() => {
                  void logAudioAudit({ eventType: 'channel_inventory_exported', sessionId });
                }}
              />
              <AudioConsoleLifecyclePanel
                canUse={canCloud}
                readOnly={operatorLocks.readOnly}
                prefs={lifecyclePrefs}
                onSavePrefs={handleSaveLifecyclePrefs}
                onApplyPolicy={handleApplyLifecyclePolicy}
              />
              <AudioComplianceExportPresetsPanel
                canUse={canCloud}
                readOnly={operatorLocks.readOnly}
                onApply={setComplianceExportPreset}
              />
              <AudioComplianceBundlePanel
                canUse={canCloud}
                sessionId={sessionId}
                operatorLabel={operatorLabel}
                devices={mergedDevices}
                state={state}
                getAudioSourceForDevice={getAudioSourceForDevice}
                linkedUsb={linkedUsb}
                storedScenes={scenes}
                rundownDraft={rundownDraft}
                rundownName={rundownDraftName}
                preset={complianceExportPreset}
                onExport={() => {
                  void logAudioAudit({ eventType: 'compliance_bundle_exported', sessionId });
                }}
              />
              <AudioSceneDiffPanel
                canUse={canCloud}
                storedScenes={scenes}
                onExport={() => {
                  void logAudioAudit({ eventType: 'scene_diff_exported', sessionId });
                }}
              />
              <AudioFxDiffPanel
                canUse={canCloud}
                storedScenes={scenes}
                onExport={() => {
                  void logAudioAudit({ eventType: 'fx_diff_exported', sessionId });
                }}
              />
              <AudioConsoleSnapshotPanel
                snapshot={consoleSnapshot}
                ageMinutes={consoleSnapshot ? snapshotAgeMinutes(consoleSnapshot.capturedAt) : 0}
              />
              <AudioOpsDigestPanel
                canUse={canCloud}
                prefs={opsDigestPrefs}
                onSavePrefs={handleSaveOpsDigestPrefs}
                onSendNow={handleSendOpsDigest}
              />
              <AudioAuditPanel
                sessionId={sessionId}
                storedScenes={scenes}
                onSceneManifestExport={() => {
                  void logAudioAudit({ eventType: 'scene_manifest_exported', sessionId });
                }}
              />
              <AudioMixerDebugPanel
                connectionMode={session?.connectionMode ?? 'mesh'}
                sessionId={sessionId}
                engine={{
                  consoleEnabled: state.consoleEnabled,
                  masterMuted: state.masterMuted,
                  monitorMuted: state.monitorMuted,
                  masterVolume: state.masterVolume,
                  activeChannels,
                  liveInputCount,
                  soloActive: Boolean(state.soloId),
                }}
                bridgeConnected={bridgeConnected}
                canBridge={canBridge}
                bridgeCode={bridgeCode}
                devices={mergedDevices}
                resolveStream={resolveAudioStream}
                storedSceneCount={storedSceneCount}
                operatorReadOnly={operatorLocks.readOnly}
                fatChannelEnabled={canFatChannel}
              />
            </aside>
          )}
        </div>
      </div>
    </div>
    </AudioMixerEngineProvider>
    </AudioStreamResolverProvider>
  );
}
