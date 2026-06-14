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
import { peekWhepPoolSnapshot } from '../../lib/whepStreamPool';
import { resolveHybridAudioStream } from '../../lib/deviceIngress';
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
import { usePgmBridgePublisher } from '../../lib/pgmBridgeTransport';
import { AUDIO_MIXER_MAX_CHANNELS } from '../../config/products';
import { createEmptyAudioSlot, isRealDevice } from '../../types/device';
import type { AudioInputSource } from '../../types/audio';
import type { SceneId } from '../../lib/audioConsolePersistence';
import { ProgramPresetToolbar } from '../presets/ProgramPresetToolbar';
import { useAudioConsoleSnapshotPublisher } from '../../hooks/useAudioConsoleSnapshot';
import { upsertAudioSceneBackup } from '../../lib/audioSceneBackup';
import { captureSceneSnapshot } from '../../lib/audioConsolePersistence';
import { getFollowRundownMirrorPref } from '../../lib/audioFollowerPrefs';
import { cn } from '../../lib/utils';
import { productionShellClass } from '../../lib/productionShell';

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
  const [rundownSync] = useState({
    active: false,
    stepIndex: null as number | null,
    total: 0,
    scenes: [] as string[],
    currentScene: null as string | null,
  });
  const [followRundownMirror] = useState(() => getFollowRundownMirrorPref());
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
    (deviceId: string) => {
      const local = hostUsb.localStreams.get(deviceId);
      if (local) return local;
      const mesh = getMeshStream(deviceId);
      const whep = peekWhepPoolSnapshot(deviceId)?.stream ?? null;
      return resolveHybridAudioStream(mesh, whep);
    },
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

  const liveInputCount = useMemo(
    () => mergedDevices.filter((d) => isRealDevice(d) && d.status !== 'offline').length,
    [mergedDevices],
  );
  const mutedChannelCount = useMemo(
    () => Object.values(state.inputMuted).filter(Boolean).length,
    [state.inputMuted],
  );

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
        void upsertAudioSceneBackup({ sessionId, sceneId, snapshot }).catch(() => {
          /* non-blocking */
        });
      }
    },
    [operatorLocks.readOnly, onStoreScene, sessionId, state, canCloud],
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
      className={cn(productionShellClass(hidden, 'audio-mixer-shell flex h-full min-h-0 flex-col overflow-hidden'))}
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

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <AudioOperatorLockBanner
          active={Boolean(sessionId) && !hidden}
          readOnly={operatorLocks.readOnly}
          blockingHolder={operatorLocks.blockingHolder}
          operatorLabel={operatorLabel}
        />

        <div className="min-h-0 flex-1 overflow-hidden p-2 sm:p-3">
          <AudioUnlockBanner />
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
        </div>
      </div>
    </div>
    </AudioMixerEngineProvider>
    </AudioStreamResolverProvider>
  );
}
