import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Circle,
  Clapperboard,
  Check,
  Copy,
  ExternalLink,
  LayoutGrid,
  LogOut,
  MonitorPlay,
  RefreshCw,
  Signal,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePgmAudio } from '../../context/PgmAudioContext';
import { usePgmBroadcast } from '../../hooks/usePgmBroadcast';
import { usePgmRecording } from '../../hooks/usePgmRecording';
import { useAIControls } from '../../hooks/useAIControls';
import { AdminNavLink } from '../admin/AdminNavLink';
import { PlatformBroadcastBanner } from '../admin/PlatformBroadcastBanner';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useCloudCast } from '../../context/CloudCastContext';
import { useAuth } from '../../context/AuthContext';
import { useProduction } from '../../context/ProductionContext';
import { ConfirmStopStreamModal } from '../mixer/ConfirmStopStreamModal';
import { useDashboardState } from '../../hooks/useDashboardState';
import { useNetwork } from '../../context/NetworkContext';
import { useBroadcastAutoResume } from '../../hooks/useBroadcastAutoResume';
import { useGoLive, type StreamNotice } from '../../hooks/useGoLive';
import { useMixerConnectivityRecovery } from '../../hooks/useMixerConnectivityRecovery';
import { ConnectivityBanner } from '../mixer/ConnectivityBanner';
import { useMixerEngine } from '../../hooks/useMixerEngine';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { CompositeMonitor } from '../monitor/CompositeMonitor';
import { PreviewMonitor } from '../monitor/PreviewMonitor';
import { ExternalDisplayButton } from '../monitor/ExternalDisplayButton';
import { useExternalDisplay } from '../../hooks/useExternalDisplay';
import { SourceStrip } from '../monitor/SourceStrip';
import { MixerControlDeck } from '../mixer/MixerControlDeck';
import { WorkspaceSplitHandle } from './WorkspaceSplitHandle';
import { useVideoOperatorLocks } from '../../hooks/useVideoOperatorLocks';
import { useVideoSessionSyncPublisher } from '../../hooks/useVideoSessionSync';
import { useVideoProgramSnapshotPublisher } from '../../hooks/useVideoProgramSnapshot';
import { logVideoAudit } from '../../lib/videoAuditService';
import { VideoOperatorLockBanner } from '../video/VideoOperatorLockBanner';
import { StreamStatusBanner } from '../mixer/StreamStatusBanner';
import { AccessCodePanel } from '../session/AccessCodePanel';
import { VideoBridgePanel } from '../audio/VideoBridgePanel';
import { readLocalBridgeLink } from '../../lib/audioBridgeService';
import { usePgmBridgeSubscriber } from '../../lib/pgmBridgeTransport';
import type { MixerBridgeLink } from '../../types/audioBridge';
import { CloudCastLogo } from '../brand/CloudCastLogo';
import { CLOUDCAST_NAV_LOGO, resolveDeviceLimit } from '../../lib/branding';
import { mergeIpCameraIntoDevices } from '../../lib/ipCameraDevice';
import { mergeDisplayFeedIntoDevices, isDisplayFeedDevice } from '../../lib/displayFeedDevice';
import { mergePrismFeedIntoDevices, isPrismFeedDevice } from '../../lib/prismFeedDevice';
import { REGAL_DISPLAY_DEVICE_ID } from '../../types/displayFeed';
import { canAccessProduct, resolveProductPlan } from '../../lib/productEntitlements';
import { useIpCameraConfig } from '../../hooks/useIpCameraConfig';
import { updateDeviceAudioSettings } from '../../lib/streamingService';
import type { AudioInputSource } from '../../types/audio';
import { isRealDevice } from '../../types/device';
import { unlockDashboardAudio } from '../../lib/audioOutput';
import { uploadMixerRecording } from '../../lib/recordingService';
import { planAllowsCloudRecording } from '../../lib/planFeatures';
import { defaultStreamQualityForSession } from '../../lib/planStreamQuality';
import { USER_MSG } from '../../lib/userMessaging';
import { logReplayAudit } from '../../lib/replayAuditService';
import { cn } from '../../lib/utils';
import { buildLayerStack } from '../mixer/panels/layers/buildLayerStack';
import type { LayerStackId } from '../mixer/panels/layers/layerStackTypes';
import { isDraggableLayer, isLayerVisibleOnStagingPreview } from '../../lib/overlayPlacement';
import { ProgramPresetToolbar } from '../presets/ProgramPresetToolbar';
import { usePrismFeedOptional } from '../../context/PrismFeedContext';
import { useDisplayFeedOptional } from '../../context/DisplayFeedContext';
import { CHROMA_KEY_GREEN } from '../../lib/chromaKeyColor';
import { buildMixerOutputUrl } from '../../lib/pgmOutputSync';
import { usePgmOutputPublisher } from '../../lib/pgmOutputTransport';
import { useVerticalWorkspaceSplit } from '../../hooks/useVerticalWorkspaceSplit';
import { MultiviewModal } from '../mixer/MultiviewModal';

export function DashboardLayout({ active = true }: { active?: boolean }) {
  const {
    session,
    sessionLoading,
    devices,
    isPresenceConnected,
    isSignalingConnected,
    isSignalingLeader,
    error,
    refreshDevices,
    reconnect,
    regenerateCode,
    isRegenerating,
    unpairDevice,
  } = useCloudCast();
  const { profile, signOut } = useAuth();
  const { setProductionOnAir, displayRouteRequest, clearDisplayRoute, replayPush, clearReplayRundown, advanceReplayRundown, replayRundownRemaining } = useProduction();
  const handleReturnToLive = useCallback(() => {
    if (replayPush) {
      void logReplayAudit({
        eventType: 'pgm_return',
        sessionId: session?.sessionId,
        clipId: replayPush.clipId,
        label: replayPush.label,
        meta: { remaining: replayRundownRemaining.length },
      });
    }
    clearReplayRundown();
  }, [replayPush, clearReplayRundown, session?.sessionId, replayRundownRemaining.length]);

  const handleReplayEnded = useCallback(() => {
    const ended = replayPush;
    if (replayRundownRemaining.length > 0) {
      if (ended) {
        void logReplayAudit({
          eventType: 'rundown_advance',
          sessionId: session?.sessionId,
          clipId: ended.clipId,
          label: ended.label,
          meta: { reason: 'clip_ended', remaining: replayRundownRemaining.length - 1 },
        });
      }
      const next = advanceReplayRundown();
      if (next) {
        void logReplayAudit({
          eventType: 'pgm_push',
          sessionId: session?.sessionId,
          clipId: next.clipId,
          label: next.label,
          meta: { source: 'rundown_auto' },
        });
      }
      return;
    }

    if (ended) {
      void logReplayAudit({
        eventType: 'pgm_return',
        sessionId: session?.sessionId,
        clipId: ended.clipId,
        label: ended.label,
        meta: { reason: 'clip_ended' },
      });
    }
    clearReplayRundown();
  }, [replayPush, replayRundownRemaining.length, advanceReplayRundown, clearReplayRundown, session?.sessionId]);
  const { isOnline, isRecovering, offlineSince, reconnectToken, recheckConnectivity } = useNetwork();
  const { registerPgmPlaybackStream, setPgmGain, getBroadcastAudioStream } = usePgmAudio();
  const pgmVideoRef = useRef<HTMLVideoElement | null>(null);
  const pgmOutputRef = useRef<HTMLDivElement | null>(null);
  const pgmBroadcast = usePgmBroadcast();
  const externalDisplay = useExternalDisplay();
  const [shortcutAssigning, setShortcutAssigning] = useState(false);
  const [deckNotice, setDeckNotice] = useState<StreamNotice | null>(null);
  const [copiedOutputUrl, setCopiedOutputUrl] = useState(false);
  const [bridgeLink, setBridgeLink] = useState<MixerBridgeLink | null>(() => readLocalBridgeLink());
  const [bridgedPgmStream, setBridgedPgmStream] = useState<MediaStream | null>(null);

  usePgmBridgeSubscriber({
    bridgeCode: bridgeLink?.bridgeCode ?? null,
    onStream: setBridgedPgmStream,
    enabled: Boolean(bridgeLink?.bridgeCode),
  });

  useEffect(() => {
    if (bridgeLink && bridgedPgmStream) {
      registerPgmPlaybackStream(bridgedPgmStream);
      return;
    }
    if (!bridgeLink) {
      registerPgmPlaybackStream(null);
    }
  }, [bridgedPgmStream, bridgeLink, registerPgmPlaybackStream]);

  const handleRecordingComplete = useCallback(
    async (blob: Blob, mimeType: string, fileName: string) => {
      const plan = resolveProductPlan(profile, 'video_mixer');
      if (!planAllowsCloudRecording(plan) || !isSupabaseConfigured()) {
        setDeckNotice({
          type: 'success',
          message: planAllowsCloudRecording(plan)
            ? USER_MSG.recordingSavedLocal
            : `${USER_MSG.recordingSavedLocal} ${USER_MSG.recordingUpgradeHint}`,
        });
        return;
      }
      try {
        await uploadMixerRecording(blob, fileName, mimeType, session?.sessionId ?? null);
        setDeckNotice({
          type: 'success',
          message: USER_MSG.recordingSavedCloud,
        });
      } catch (err) {
        setDeckNotice({
          type: 'error',
          message:
            err instanceof Error
              ? `${err.message} Local file was still downloaded.`
              : 'Cloud upload failed. Local file was still downloaded.',
        });
      }
    },
    [profile?.plan_id, session?.sessionId],
  );

  const pgmRecording = usePgmRecording({ onComplete: handleRecordingComplete });

  const planId = profile?.plan_id ?? 'free';
  const deviceLimit = resolveDeviceLimit(session, profile);
  const prismPlan = resolveProductPlan(profile, 'regal_prism');
  const showPrismFeed = Boolean(
    canAccessProduct(profile, 'regal_prism') &&
    (prismPlan === 'pro_master'),
  );
  const canAccessPrism = canAccessProduct(profile, 'regal_prism');
  const canAccessDisplay = canAccessProduct(profile, 'regal_display');
  const prismFeed = usePrismFeedOptional();
  const displayFeed = useDisplayFeedOptional();
  const prismOnAir = Boolean(prismFeed?.isLive);
  const ipCamera = useIpCameraConfig({
    sessionId: session?.sessionId,
    planId,
    defaultSlot: deviceLimit,
  });

  const mergedDevices = useMemo(
    () =>
      mergePrismFeedIntoDevices(
        mergeDisplayFeedIntoDevices(mergeIpCameraIntoDevices(devices, ipCamera.config)),
        showPrismFeed,
      ),
    [devices, ipCamera.config, showPrismFeed],
  );

  const mixer = useDashboardState(mergedDevices);
  const { controls, pstDevice, pgmDevice, subDevice, transitionFromDevice, liveDevices, sourceDevices } = mixer;

  const sessionId = session?.sessionId ?? null;
  const operatorLabel = profile?.full_name ?? profile?.email ?? 'TD operator';
  const videoPlanId = resolveProductPlan(profile, 'video_mixer');
  const canCloud = videoPlanId !== 'free';
  const operatorLocks = useVideoOperatorLocks({
    sessionId,
    operatorLabel,
    enabled: active && Boolean(sessionId) && !controls.fullscreenPgm,
  });
  const prevOnAirRef = useRef(controls.isOnAir);
  const prevRecordingRef = useRef(pgmRecording.isRecording);

  const deviceDisplayLabel = useCallback(
    (device: typeof pstDevice) => device?.label ?? device?.deviceId ?? null,
    [],
  );

  useEffect(() => {
    if (!active) return;
    if (prevOnAirRef.current === controls.isOnAir) return;
    prevOnAirRef.current = controls.isOnAir;
    void logVideoAudit({
      eventType: controls.isOnAir ? 'on_air_start' : 'on_air_stop',
      sessionId,
    });
  }, [active, controls.isOnAir, sessionId]);

  useEffect(() => {
    if (!active) return;
    if (prevRecordingRef.current === pgmRecording.isRecording) return;
    prevRecordingRef.current = pgmRecording.isRecording;
    void logVideoAudit({
      eventType: pgmRecording.isRecording ? 'recording_start' : 'recording_stop',
      sessionId,
    });
  }, [active, pgmRecording.isRecording, sessionId]);

  useEffect(() => {
    if (!session) return;
    mixer.setDefaultQuality(defaultStreamQualityForSession(planId, session.connectionMode));
  }, [session?.connectionMode, session?.sessionId, planId, mixer.setDefaultQuality]);

  const {
    goLive,
    isValidating: isStreamValidating,
    streamNotice,
    clearStreamNotice,
    testAndSaveNotice,
    showStopConfirm,
    confirmStopStream,
    cancelStopStream,
    resumeBroadcast,
    setStreamNotice,
  } = useGoLive({
    planId: profile?.plan_id ?? 'free',
    isOnAir: controls.isOnAir,
    setOnAir: (onAir) => mixer.toggleOnAir(onAir),
    setActivePanel: () => mixer.setActivePanel('stream'),
    startBroadcast: (destinations) =>
      pgmBroadcast.startBroadcast(destinations, {
        getOutputContainer: () => pgmOutputRef.current,
        getAudioVideo: () => pgmVideoRef.current,
        getBroadcastAudioStream,
        getFadeToBlackLevel: () => engine.fadeToBlackLevel,
      }),
    stopBroadcast: pgmBroadcast.stopBroadcast,
  });

  const handleTestStreamConnection = useCallback(
    (input: {
      name: string;
      streamUrl: string;
      streamKey: string;
      platform: import('../../types/streaming').StreamPlatform;
    }) => testAndSaveNotice(input),
    [testAndSaveNotice],
  );

  const engine = useMixerEngine({
    transitionType: controls.transition.type,
    durationMs: controls.transition.durationMs,
    onComplete: mixer.completeTransition,
  });

  const programOutputUrl = useMemo(
    () => (session?.accessCode ? buildMixerOutputUrl(session.accessCode) : ''),
    [session?.accessCode],
  );

  const copyProgramOutputUrl = useCallback(async () => {
    if (!programOutputUrl) return;
    try {
      await navigator.clipboard.writeText(programOutputUrl);
      setCopiedOutputUrl(true);
      setTimeout(() => setCopiedOutputUrl(false), 2000);
    } catch {
      /* ignore */
    }
  }, [programOutputUrl]);

  const openProgramOutputWindow = useCallback(() => {
    if (!programOutputUrl) return;
    window.open(programOutputUrl, 'cloudcast-mixer-output', 'noopener,noreferrer,width=1280,height=720');
  }, [programOutputUrl]);

  usePgmOutputPublisher({
    sessionId: session?.sessionId,
    realtimeChannel: session?.realtimeChannel,
    enabled: Boolean(session?.sessionId),
    getSources: () => ({
      getOutputContainer: () => pgmOutputRef.current,
      getAudioVideo: () => pgmVideoRef.current,
      getBroadcastAudioStream,
      getFadeToBlackLevel: () => engine.fadeToBlackLevel,
    }),
  });

  useBroadcastAutoResume({
    wantsResume: controls.isOnAir && pgmBroadcast.status !== 'live',
    sessionLoading,
    isSignalingConnected,
    broadcastStatus: pgmBroadcast.status,
    pgmDevice,
    getPgmOutputContainer: () => pgmOutputRef.current,
    resumeBroadcast,
    setOnAir: (onAir) => mixer.toggleOnAir(onAir),
    setStreamNotice,
  });

  useMixerConnectivityRecovery({
    reconnectToken,
    isOnline,
    devices: mergedDevices,
    isOnAir: controls.isOnAir,
    broadcastStatus: pgmBroadcast.status,
    pgmDevice,
    getPgmOutputContainer: () => pgmOutputRef.current,
    onReconnectSession: reconnect,
    resumeBroadcast,
    setStreamNotice,
  });

  useEffect(() => {
    if (engine.isAnimating) {
      mixer.setTransitionProgress(engine.progress);
    }
  }, [engine.progress, engine.isAnimating, mixer.setTransitionProgress]);

  useEffect(() => {
    mixer.setFadeToBlackLevel(engine.fadeToBlackLevel);
  }, [engine.fadeToBlackLevel, mixer.setFadeToBlackLevel]);

  useEffect(() => {
    if (!displayRouteRequest) return;
    if (displayRouteRequest === 'pst') {
      mixer.sendToPst(REGAL_DISPLAY_DEVICE_ID);
    } else {
      engine.resetProgress();
      mixer.cutToDevice(REGAL_DISPLAY_DEVICE_ID);
    }
    if (displayFeed?.state.keyMode) {
      mixer.setOutputMode('key');
      mixer.patchKey({ keyType: 'chroma', color: CHROMA_KEY_GREEN, enabled: true });
    }
    clearDisplayRoute();
  }, [displayRouteRequest, mixer, engine, clearDisplayRoute, displayFeed?.state.keyMode]);

  useEffect(() => {
    if (!displayFeed?.state.keyMode) return;
    const onDisplay =
      controls.pgmDeviceId === REGAL_DISPLAY_DEVICE_ID ||
      controls.pstDeviceId === REGAL_DISPLAY_DEVICE_ID;
    if (!onDisplay) return;

    if (controls.key.keyType !== 'chroma' || controls.key.color !== CHROMA_KEY_GREEN) {
      mixer.patchKey({ keyType: 'chroma', color: CHROMA_KEY_GREEN });
    }
    if (controls.outputMode !== 'key' || !controls.key.enabled) {
      mixer.setOutputMode('key');
      mixer.patchKey({ enabled: true, keyType: 'chroma', color: CHROMA_KEY_GREEN });
    }
  }, [
    displayFeed?.state.keyMode,
    controls.pgmDeviceId,
    controls.pstDeviceId,
    controls.key.keyType,
    controls.key.color,
    controls.key.enabled,
    controls.outputMode,
    mixer,
  ]);

  const transitionProgress = engine.isAnimating ? engine.progress : controls.transition.progress;
  const liveInputCount = liveDevices.length;

  useVideoSessionSyncPublisher(
    sessionId,
    session?.realtimeChannel,
    operatorLocks.readOnly
      ? null
      : {
          operatorKey: operatorLocks.operatorKey,
          operatorLabel,
          pstDeviceId: controls.pstDeviceId,
          pstDeviceLabel: deviceDisplayLabel(pstDevice),
          pgmDeviceId: controls.pgmDeviceId,
          pgmDeviceLabel: deviceDisplayLabel(pgmDevice),
          isOnAir: controls.isOnAir,
          isRecording: pgmRecording.isRecording,
          transitionType: controls.transition.type,
          transitionProgress,
          inTransition: Boolean(controls.transitionFromId) || engine.isAnimating,
          outputMode: controls.outputMode,
          activePanel: controls.activePanel,
          replayOnPgmLabel: replayPush?.label ?? null,
        },
    active && Boolean(sessionId) && !controls.fullscreenPgm && !operatorLocks.readOnly,
  );

  useVideoProgramSnapshotPublisher({
    enabled: active && canCloud && Boolean(sessionId) && !controls.fullscreenPgm && !operatorLocks.readOnly,
    sessionId,
    operatorKey: operatorLocks.operatorKey,
    operatorLabel,
    pstDeviceId: controls.pstDeviceId,
    pstDeviceLabel: deviceDisplayLabel(pstDevice),
    pgmDeviceId: controls.pgmDeviceId,
    pgmDeviceLabel: deviceDisplayLabel(pgmDevice),
    isOnAir: controls.isOnAir,
    isRecording: pgmRecording.isRecording,
    transitionType: controls.transition.type,
    outputMode: controls.outputMode,
    liveInputCount,
    replayOnPgm: Boolean(replayPush),
    replayLabel: replayPush?.label ?? null,
  });

  const guard = useCallback(
    <T extends (...args: never[]) => void>(fn: T): T =>
      ((...args: Parameters<T>) => {
        if (operatorLocks.readOnly) return;
        fn(...args);
      }) as T,
    [operatorLocks.readOnly],
  );

  const handleGoLive = useCallback(() => {
    if (operatorLocks.readOnly) return;
    void goLive();
  }, [operatorLocks.readOnly, goLive]);

  const handleCut = useCallback(() => {
    if (operatorLocks.readOnly || !controls.pstDeviceId) return;
    engine.resetProgress();
    mixer.cutToPreview();
    void logVideoAudit({
      eventType: 'cut',
      sessionId,
      deviceId: controls.pstDeviceId,
      label: deviceDisplayLabel(pstDevice) ?? undefined,
    });
  }, [operatorLocks.readOnly, engine, mixer, controls.pstDeviceId, sessionId, pstDevice, deviceDisplayLabel]);

  const handleTake = useCallback(() => {
    if (operatorLocks.readOnly || !controls.pstDeviceId || controls.pstDeviceId === controls.pgmDeviceId) return;
    mixer.beginTransition();
    engine.performTake();
    void logVideoAudit({
      eventType: 'take',
      sessionId,
      deviceId: controls.pstDeviceId,
      label: deviceDisplayLabel(pstDevice) ?? undefined,
    });
  }, [operatorLocks.readOnly, engine, mixer, controls.pstDeviceId, controls.pgmDeviceId, sessionId, pstDevice, deviceDisplayLabel]);

  const handleSendToPgm = useCallback(
    (deviceId: string) => {
      if (operatorLocks.readOnly) return;
      engine.resetProgress();
      mixer.cutToDevice(deviceId);
      const device = sourceDevices.find((d) => d.deviceId === deviceId);
      void logVideoAudit({
        eventType: 'send_to_pgm',
        sessionId,
        deviceId,
        label: device?.label ?? deviceId,
      });
    },
    [operatorLocks.readOnly, engine, mixer, sessionId, sourceDevices],
  );

  const handleFocusSource = useCallback(
    (deviceId: string) => {
      if (operatorLocks.readOnly) return;
      mixer.sendToPst(deviceId);
    },
    [operatorLocks.readOnly, mixer],
  );

  const handleTbarChange = useCallback(
    (value: number) => {
      if (operatorLocks.readOnly) return;
      if (value > 0 && controls.pstDeviceId !== controls.pgmDeviceId && !controls.transitionFromId) {
        mixer.beginTransition();
      }
      engine.setTbar(value);
      mixer.setTransitionProgress(value);
    },
    [operatorLocks.readOnly, engine, mixer, controls.pstDeviceId, controls.pgmDeviceId, controls.transitionFromId],
  );

  const handleCommitTbar = useCallback(
    (value: number) => {
      if (operatorLocks.readOnly) return;
      if (value >= 50 && controls.pstDeviceId !== controls.pgmDeviceId) {
        if (!controls.transitionFromId) mixer.beginTransition();
        engine.commitTbar(value);
      } else {
        engine.resetProgress();
        mixer.abandonTransition();
      }
    },
    [operatorLocks.readOnly, engine, mixer, controls.pstDeviceId, controls.pgmDeviceId, controls.transitionFromId],
  );

  const handleFadeBlack = useCallback(() => {
    if (operatorLocks.readOnly) return;
    engine.fadeToBlack(engine.fadeToBlackLevel < 50);
  }, [operatorLocks.readOnly, engine]);

  const handleReconnectStream = useCallback((deviceId: string) => {
    window.dispatchEvent(new CustomEvent('cloudcast:reconnect', { detail: { deviceId } }));
  }, []);

  const handlePgmVideoRef = useCallback((el: HTMLVideoElement | null) => {
    pgmVideoRef.current = el;
  }, []);

  const handlePgmPlaybackStream = useCallback(
    (stream: MediaStream | null) => {
      if (bridgeLink) return;
      registerPgmPlaybackStream(stream);
    },
    [bridgeLink, registerPgmPlaybackStream],
  );

  const handlePgmOutputRef = useCallback((el: HTMLDivElement | null) => {
    pgmOutputRef.current = el;
  }, []);

  useEffect(() => {
    if (pgmBroadcast.isBroadcasting) {
      pgmBroadcast.updateFadeToBlack(engine.fadeToBlackLevel);
    }
  }, [engine.fadeToBlackLevel, pgmBroadcast.isBroadcasting, pgmBroadcast.updateFadeToBlack]);

  const handleToggleRecording = useCallback(() => {
    if (operatorLocks.readOnly) return;
    const result = pgmRecording.toggleRecording(
      pgmVideoRef.current,
      getBroadcastAudioStream(),
    );
    setDeckNotice({
      type: result.ok ? 'success' : 'error',
      message: result.message,
    });
  }, [operatorLocks.readOnly, pgmRecording, getBroadcastAudioStream]);

  useEffect(() => {
    mixer.setRecording(pgmRecording.isRecording);
  }, [pgmRecording.isRecording, mixer.setRecording]);

  const pgmAudioDeviceId = useMemo(() => {
    if (!pgmDevice) return null;
    const source = mixer.getAudioSourceForDevice(pgmDevice.deviceId);
    if (source === 'usb_audio' || source === 'capture_card') {
      return controls.audio.linkedUsbAudio[pgmDevice.deviceId] ?? null;
    }
    return null;
  }, [pgmDevice, controls.audio.linkedUsbAudio, mixer]);

  const handlePersistAudioSettings = useCallback(
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

  const handleSetInputAudioSource = useCallback(
    (deviceId: string, source: AudioInputSource) => {
      mixer.setInputAudioSource(deviceId, source);
      handlePersistAudioSettings(deviceId, source, controls.audio.linkedUsbAudio[deviceId] ?? null);
    },
    [mixer, controls.audio.linkedUsbAudio, handlePersistAudioSettings],
  );

  const handleSetLinkedUsbAudio = useCallback(
    (deviceId: string, audioDeviceId: string | null) => {
      mixer.setLinkedUsbAudio(deviceId, audioDeviceId);
      handlePersistAudioSettings(deviceId, mixer.getAudioSourceForDevice(deviceId), audioDeviceId);
    },
    [mixer, handlePersistAudioSettings],
  );

  useEffect(() => {
    const real = devices.filter(isRealDevice);
    if (real.length === 0) return;
    mixer.hydrateDeviceAudio(
      real.map((d) => ({
        deviceId: d.deviceId,
        audioSource: d.audioSource,
        linkedAudioDeviceId: d.linkedAudioDeviceId,
      })),
    );
  }, [devices]);

  const shortcutHandlers = useMemo(
    () => ({
      onCut: handleCut,
      onTake: handleTake,
      onFadeBlack: handleFadeBlack,
      onSelectSource: (idx: number) => {
        const d = mergedDevices[idx];
        if (d && isRealDevice(d)) handleFocusSource(d.deviceId);
      },
      onCutToSource: (idx: number) => {
        const d = mergedDevices[idx];
        if (d && isRealDevice(d)) handleSendToPgm(d.deviceId);
      },
      onToggleOnAir: handleGoLive,
      onToggleMultiview: () => mixer.toggleMultiview(),
      onToggleFullscreen: () => mixer.toggleFullscreen(),
      onToggleRecording: handleToggleRecording,
      onSwap: () => mixer.swapPstPgm(),
      maxSlots: resolveDeviceLimit(session, profile),
    }),
    [handleCut, handleTake, handleFadeBlack, mergedDevices, handleFocusSource, handleSendToPgm, mixer, session, profile, handleGoLive, handleToggleRecording],
  );

  useKeyboardShortcuts(controls.keyboardShortcuts, shortcutHandlers, !shortcutAssigning);

  const aiHandlers = useMemo(
    () => ({
      selectStream: mixer.selectStream,
      selectAllLiveStreams: mixer.selectAllLiveStreams,
      clearStreamSelection: mixer.clearStreamSelection,
      setStreamQuality: mixer.setStreamQuality,
      setDefaultQuality: mixer.setDefaultQuality,
      setOverlay: mixer.setOverlay,
      setGlobalOverlay: mixer.setGlobalOverlay,
      setStatusFilter: mixer.setStatusFilter,
      setViewMode: mixer.setViewMode,
      toggleOfflineTiles: mixer.toggleOfflineTiles,
      toggleMasterMute: (muted?: boolean) => {
        if (muted === undefined) mixer.toggleMasterMute();
        else mixer.patchAudio({ masterMuted: muted });
      },
      focusDevice: mixer.focusDevice,
      reconnectStream: handleReconnectStream,
      sendToPst: mixer.sendToPst,
      setSubSource: mixer.sendToSub,
      setOutputMode: mixer.setOutputMode,
      setPipPosition: mixer.setPipPosition,
      cutToPreview: handleCut,
      take: handleTake,
      cutToDevice: handleSendToPgm,
      swapPstPgm: mixer.swapPstPgm,
      setTransitionType: mixer.setTransitionType,
      setTransitionDuration: mixer.setTransitionDuration,
      setTransitionProgress: mixer.setTransitionProgress,
      toggleOnAir: handleGoLive,
      toggleRecording: handleToggleRecording,
      toggleMultiview: mixer.toggleMultiview,
      toggleFullscreen: mixer.toggleFullscreen,
      setAspectRatio: mixer.setAspectRatio,
      setMasterVolume: mixer.setMasterVolume,
      setInputVolume: mixer.setInputVolume,
      toggleInputMute: mixer.toggleInputMute,
      toggleInputSolo: mixer.toggleInputSolo,
      toggleViewAudioMute: mixer.toggleViewAudioMute,
      setActivePanel: mixer.setActivePanel,
      patchLayers: (p: Record<string, unknown>) =>
        mixer.patchLayers(p as Partial<typeof controls.layers>),
      patchPip: (p: Record<string, unknown>) => mixer.patchPip(p as Partial<typeof controls.pip>),
      patchKey: (p: Record<string, unknown>) => mixer.patchKey(p as Partial<typeof controls.key>),
    }),
    [mixer, handleCut, handleTake, handleSendToPgm, handleReconnectStream, handleGoLive, handleToggleRecording, controls.layers, controls.pip, controls.key],
  );

  useAIControls(aiHandlers);

  useEffect(() => {
    setProductionOnAir(controls.isOnAir);
  }, [controls.isOnAir, setProductionOnAir]);

  useEffect(() => {
    const unlock = () => {
      void unlockDashboardAudio();
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    return () => window.removeEventListener('pointerdown', unlock, { capture: true });
  }, []);

  useEffect(() => {
    if (!controls.fullscreenPgm) return;
    const el = document.documentElement;
    el.requestFullscreen?.().catch(() => mixer.toggleFullscreen());
    const onFsChange = () => {
      if (!document.fullscreenElement) mixer.toggleFullscreen();
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      if (document.fullscreenElement) document.exitFullscreen?.();
    };
  }, [controls.fullscreenPgm, mixer]);

  const pgmVolume = pgmDevice ? mixer.getVolumeForDevice(pgmDevice.deviceId) : 0;

  useEffect(() => {
    setPgmGain(pgmVolume);
  }, [pgmVolume, setPgmGain]);

  if (!isSupabaseConfigured()) {
    return (
      <div className="flex h-full items-center justify-center bg-mixer-bg p-8">
        <div className="max-w-md border border-mixer-border bg-mixer-panel p-6 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-mixer-red" />
          <h2 className="mt-4 text-lg font-semibold">CloudCast Not Configured</h2>
          <p className="mt-2 text-sm text-mixer-muted">{USER_MSG.backendNotConfigured}</p>
        </div>
      </div>
    );
  }

  const realDevices = mergedDevices.filter(
    (d) => isRealDevice(d) && !isDisplayFeedDevice(d) && !isPrismFeedDevice(d),
  );
  const aspectRatio = controls.display.aspectRatio;

  const graphicsHighlight = useMemo(() => {
    if (!controls.openPanels.includes('layers') || !controls.selectedGraphicsLayerId) {
      return { id: null as LayerStackId | null, label: '' };
    }
    const id = controls.selectedGraphicsLayerId as LayerStackId;
    const item = buildLayerStack(controls.layers, controls.pgmLayers).find((s) => s.id === id);
    if (!item?.isPreview) {
      return { id: null, label: '' };
    }
    return { id, label: item.label };
  }, [controls.openPanels, controls.selectedGraphicsLayerId, controls.layers, controls.pgmLayers]);

  const graphicsDragEnabled = useMemo(() => {
    if (!graphicsHighlight.id) return false;
    return (
      isDraggableLayer(graphicsHighlight.id) &&
      isLayerVisibleOnStagingPreview(graphicsHighlight.id, controls.layers)
    );
  }, [graphicsHighlight.id, controls.layers]);

  const workspaceRef = useRef<HTMLDivElement>(null);
  const trailingChromeRef = useRef<HTMLDivElement>(null);
  const { deckHeight, isDragging, splitHandleProps } = useVerticalWorkspaceSplit({
    workspaceRef,
    trailingChromeRef,
    enabled: !controls.fullscreenPgm,
  });

  const monitorSection = (
    <div
      className={cn(
        'dashboard-monitors flex min-h-0 flex-1 flex-col overflow-hidden',
        controls.fullscreenPgm && 'fixed inset-0 z-40 bg-black',
      )}
    >
      <div className="dashboard-monitors-row flex min-h-0 flex-1 gap-1 p-1">
        {!controls.fullscreenPgm && (
          <PreviewMonitor
            devices={sourceDevices}
            slotCount={deviceLimit}
            pstDevice={pstDevice}
            subDevice={subDevice}
            pstDeviceId={controls.pstDeviceId}
            pgmDeviceId={controls.pgmDeviceId}
            viewMode={controls.viewMode}
            onViewModeChange={mixer.setViewMode}
            outputMode={controls.outputMode}
            pip={controls.pip}
            keySettings={controls.key}
            layers={controls.layers}
            highlightLayerId={graphicsHighlight.id}
            highlightLayerLabel={graphicsHighlight.label}
            graphicsDragEnabled={graphicsDragEnabled}
            onPatchLayers={mixer.patchLayers}
            getQuality={mixer.getQualityForDevice}
            getOverlay={mixer.getOverlayForDevice}
            isViewAudioMuted={mixer.isViewAudioMuted}
            onToggleViewAudioMute={mixer.toggleViewAudioMute}
            getMonitorVolume={mixer.getMonitorVolumeForDevice}
            getMonitorAudioDeviceId={mixer.getMonitorAudioDeviceId}
            onSelectSource={handleFocusSource}
            onCutToSource={handleSendToPgm}
            aspectRatio={aspectRatio}
          />
        )}
        <CompositeMonitor
          label="PGM"
          device={pgmDevice}
          subDevice={controls.outputMode === 'pip' || controls.outputMode === 'key' ? subDevice : null}
          fromDevice={transitionFromDevice ?? pgmDevice}
          toDevice={pstDevice}
          transitionProgress={transitionProgress}
          transitionType={controls.transition.type}
          fadeToBlackLevel={engine.fadeToBlackLevel}
          outputMode={controls.outputMode}
          pip={controls.pip}
          keySettings={controls.key}
          layers={controls.pgmLayers}
          overlay={pgmDevice ? mixer.getOverlayForDevice(pgmDevice.deviceId) : 'none'}
          quality={pgmDevice ? mixer.getQualityForDevice(pgmDevice.deviceId) : 'auto'}
          audioMuted={controls.audio.masterMuted}
          volume={pgmVolume}
          isOnAir={controls.isOnAir}
          aspectRatio={aspectRatio}
          audioDeviceId={pgmAudioDeviceId}
          onPgmVideoRef={handlePgmVideoRef}
          onPgmPlaybackStream={handlePgmPlaybackStream}
          onPgmOutputRef={handlePgmOutputRef}
          replayTake={replayPush}
          onReplayEnded={handleReplayEnded}
        />
      </div>
      {!controls.fullscreenPgm && (
        <SourceStrip
          devices={sourceDevices}
          pstDeviceId={controls.pstDeviceId}
          pgmDeviceId={controls.pgmDeviceId}
          getQuality={mixer.getQualityForDevice}
          getOverlay={mixer.getOverlayForDevice}
          isViewAudioMuted={mixer.isViewAudioMuted}
          onToggleViewAudioMute={mixer.toggleViewAudioMute}
          getMonitorVolume={mixer.getMonitorVolumeForDevice}
          getMonitorAudioDeviceId={mixer.getMonitorAudioDeviceId}
          aspectRatio={aspectRatio}
          onSelectSource={handleFocusSource}
          onCutToSource={handleSendToPgm}
        />
      )}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-mixer-bg">
      <ConfirmStopStreamModal
        open={showStopConfirm}
        onConfirm={confirmStopStream}
        onCancel={cancelStopStream}
      />
      {!controls.fullscreenPgm && <PlatformBroadcastBanner />}
      {replayPush && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-emerald-500/40 bg-emerald-950/50 px-3 py-2 sm:px-4">
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-wider text-emerald-200">
            <Clapperboard className="h-3.5 w-3.5" />
            REPLAY ON PGM — {replayPush.label}
            {replayRundownRemaining.length > 0 && ` · ${replayRundownRemaining.length} queued`}
          </div>
          <button
            type="button"
            onClick={handleReturnToLive}
            className="rounded border border-emerald-400/40 bg-emerald-600/30 px-3 py-1 text-[9px] font-bold tracking-wider text-emerald-100 hover:bg-emerald-600/50"
          >
            RETURN TO LIVE
          </button>
        </div>
      )}
      {!controls.fullscreenPgm && (
        <header className="dashboard-header flex shrink-0 items-center justify-between gap-2 border-b border-mixer-border bg-mixer-panel px-3 py-2 sm:px-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <CloudCastLogo variant={CLOUDCAST_NAV_LOGO.variant} className={CLOUDCAST_NAV_LOGO.className} />
            <span className="dashboard-header-tagline hidden text-[10px] text-mixer-muted md:inline">
              VIDEO MIXER
            </span>
            {profile && (
              <span className="rounded bg-white/5 px-2 py-0.5 text-[9px] font-bold tracking-wider text-mixer-muted">
                {profile.plan.name.toUpperCase()}
              </span>
            )}
            {controls.isRecording && <span className="animate-pulse text-[10px] font-bold text-mixer-red">● REC</span>}
            {externalDisplay.isOpen && (
              <span className="text-[10px] font-bold text-mixer-green">
                ● {externalDisplay.targetScreen?.label ?? 'EXT OUTPUT'}
              </span>
            )}
          </div>
          <AccessCodePanel
            session={session}
            isLoading={sessionLoading}
            onRegenerate={regenerateCode}
            isRegenerating={isRegenerating}
            product="video"
            error={error}
            onRetry={reconnect}
            className="min-w-0 flex"
          />
          <VideoBridgePanel
            mode="video"
            sessionId={session?.sessionId}
            onLinkChange={setBridgeLink}
            className="hidden xl:flex"
          />
          <div className="dashboard-header-actions flex shrink-0 items-center gap-2 text-[10px] sm:gap-4">
            <ProgramPresetToolbar />
            <ExternalDisplayButton
              isOpen={externalDisplay.isOpen}
              isDetecting={externalDisplay.isDetecting}
              externalAvailable={externalDisplay.externalAvailable}
              targetScreen={externalDisplay.targetScreen ?? externalDisplay.screens.find((s) => !s.isPrimary) ?? null}
              onClick={() => { void externalDisplay.toggle(); }}
            />
            <AdminNavLink className="hidden lg:inline" />
            <Link to="/hub" className="hidden items-center gap-1 text-mixer-muted hover:text-white lg:inline-flex" title="All products">
              <LayoutGrid className="h-3.5 w-3.5" /> HUB
            </Link>
            <Link to="/replay" className="hidden items-center gap-1 text-mixer-muted hover:text-white xl:inline-flex">
              <Clapperboard className="h-3.5 w-3.5" /> REPLAY
            </Link>
            <Link to="/audio" className="hidden items-center gap-1 text-mixer-muted hover:text-white xl:inline-flex">
              <SlidersHorizontal className="h-3.5 w-3.5" /> AUDIO
            </Link>
            {canAccessPrism && (
              <Link
                to="/prism"
                className={cn(
                  'hidden items-center gap-1 xl:inline-flex',
                  prismOnAir ? 'text-amber-400 hover:text-amber-300' : 'text-mixer-muted hover:text-white',
                )}
                title={prismOnAir ? 'Regal Prism feed active on mixer' : 'Open Regal Prism VP studio'}
              >
                <Sparkles className="h-3.5 w-3.5" />
                PRISM
                {prismOnAir && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />}
              </Link>
            )}
            <Link to="/profile" className="hidden text-mixer-muted hover:text-white lg:inline">
              Profile
            </Link>
            <Link to="/pricing" className="hidden text-mixer-muted hover:text-white xl:inline">
              Upgrade
            </Link>
            <span className="dashboard-header-meta hidden items-center gap-1.5 text-mixer-muted xl:flex">
              <Circle className={cn('h-2 w-2 fill-current', isPresenceConnected ? 'text-mixer-green' : 'text-mixer-red')} />
              PRESENCE
            </span>
            <span className="dashboard-header-meta hidden items-center gap-1.5 text-mixer-muted xl:flex">
              <Signal className={cn('h-3 w-3', isSignalingConnected ? 'text-mixer-green' : 'text-mixer-muted')} />
              SIGNAL
            </span>
            {!isSignalingLeader && (
              <span className="font-bold text-mixer-yellow" title="Close other CloudCast tabs so this one can receive mobile streams">
                OTHER TAB
              </span>
            )}
            <span><span className="font-bold text-mixer-red">{liveDevices.length}</span> LIVE</span>
            <span><span className="font-bold text-mixer-text">{realDevices.length}</span>/{deviceLimit}</span>
            <button
              type="button"
              onClick={refreshDevices}
              className="mixer-btn p-1"
              title="Refresh paired devices (keeps live feeds)"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
            <button type="button" onClick={() => signOut()} className="mixer-btn p-1" title="Sign out"><LogOut className="h-3 w-3" /></button>
          </div>
        </header>
      )}

      {!isSignalingLeader && !controls.fullscreenPgm && (
        <div className="shrink-0 flex items-center gap-2 border-b border-mixer-yellow/40 bg-mixer-yellow/15 px-4 py-2 text-[11px] text-mixer-yellow">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Another CloudCast browser tab is receiving mobile streams. Close every other CloudCast tab
            and keep only this dashboard open, then tap Go Live on your phone again.
          </span>
        </div>
      )}

      {!controls.fullscreenPgm && (
        <VideoOperatorLockBanner
          active={Boolean(sessionId)}
          readOnly={operatorLocks.readOnly}
          blockingHolder={operatorLocks.blockingHolder}
          operatorLabel={operatorLabel}
        />
      )}

      {!controls.fullscreenPgm && (
        <ConnectivityBanner
          isOnline={isOnline}
          isRecovering={isRecovering}
          offlineSince={offlineSince}
          onRecheck={recheckConnectivity}
        />
      )}

      {error && isOnline && !controls.fullscreenPgm && (
        <div className="shrink-0 border-b border-mixer-red/30 bg-mixer-red/10 px-4 py-1 text-[10px] text-mixer-red">
          {error}
          <button type="button" onClick={reconnect} className="ml-2 underline">RETRY</button>
        </div>
      )}

      {!controls.fullscreenPgm && (
        <StreamStatusBanner
          notice={deckNotice ?? streamNotice}
          isValidating={isStreamValidating}
          onDismiss={() => {
            setDeckNotice(null);
            clearStreamNotice();
          }}
        />
      )}

      {externalDisplay.error && !controls.fullscreenPgm && (
        <div className="flex shrink-0 items-center gap-2 border-b border-mixer-red/30 bg-mixer-red/10 px-4 py-1.5 text-[10px] text-mixer-red">
          <span className="flex-1">{externalDisplay.error}</span>
          <button type="button" onClick={externalDisplay.clearError} className="mixer-btn px-2 py-0.5 text-[9px]">
            Dismiss
          </button>
        </div>
      )}

      <div ref={workspaceRef} className="dashboard-workspace flex min-h-0 flex-1 flex-col overflow-hidden">
        {controls.fullscreenPgm ? (
          monitorSection
        ) : (
          <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
            {monitorSection}

            <WorkspaceSplitHandle isDragging={isDragging} {...splitHandleProps} />

            <div className="dashboard-deck-wrap" style={{ height: deckHeight }}>
              <MixerControlDeck
                  controls={controls}
                  devices={sourceDevices}
                  pstDeviceId={controls.pstDeviceId}
                  pgmDeviceId={controls.pgmDeviceId}
                  onSetPanel={mixer.setActivePanel}
                  onToggleOpenPanel={mixer.toggleOpenPanel}
                  onFocusPst={handleFocusSource}
                  onAssignSub={guard(mixer.sendToSub)}
                  onAssignPgm={handleSendToPgm}
                  onSetOutputMode={guard(mixer.setOutputMode)}
                  onSwapPstPgm={guard(mixer.swapPstPgm)}
                  onExchange={guard(mixer.exchangeSources)}
                  onToggleAutoTrans={guard(mixer.toggleAutoTrans)}
                  onCut={handleCut}
                  onTake={handleTake}
                  onFadeBlack={handleFadeBlack}
                  onSetTransitionType={guard(mixer.setTransitionType)}
                  onSetTransitionDuration={guard(mixer.setTransitionDuration)}
                  onSetTransitionProgress={handleTbarChange}
                  onCommitTbar={handleCommitTbar}
                  onGoLive={handleGoLive}
                  isStreamValidating={isStreamValidating}
                  streamNotice={streamNotice}
                  onTestStreamConnection={handleTestStreamConnection}
                  onToggleRecording={handleToggleRecording}
                  onSetGlobalOverlay={guard(mixer.setGlobalOverlay)}
                  onToggleMultiview={mixer.toggleMultiview}
                  onToggleFullscreen={mixer.toggleFullscreen}
                  onPatchPip={guard(mixer.patchPip)}
                  onPatchKey={guard(mixer.patchKey)}
                  onPatchLayers={guard(mixer.patchLayers)}
                  pgmLayers={controls.pgmLayers}
                  graphics={mixer.graphics}
                  selectedGraphicsLayerId={(controls.selectedGraphicsLayerId ?? 'lower-third') as LayerStackId}
                  onSelectGraphicsLayer={(id) => mixer.setSelectedGraphicsLayer(id)}
                  onPatchAudio={guard(mixer.patchAudio)}
                  onSetInputVolume={guard(mixer.setInputVolume)}
                  onToggleInputMute={guard(mixer.toggleInputMute)}
                  onToggleInputSolo={guard(mixer.toggleInputSolo)}
                  onToggleViewAudioMute={mixer.toggleViewAudioMute}
                  onSetViewMonitorVolume={mixer.setViewMonitorVolume}
                  onToggleMonitorMasterMute={mixer.toggleMonitorMasterMute}
                  onSetQuality={mixer.setDefaultQuality}
                  onSetAspectRatio={mixer.setAspectRatio}
                  onSetViewMode={mixer.setViewMode}
                  onSetKeyboardShortcuts={mixer.setKeyboardShortcuts}
                  onToggleExternalDisplay={() => { void externalDisplay.toggle(); }}
                  onShortcutAssigningChange={setShortcutAssigning}
                  externalDisplayOpen={externalDisplay.isOpen}
                  onUnpair={unpairDevice}
                  onReconnect={handleReconnectStream}
                  planId={profile?.plan_id ?? 'free'}
                  accessCode={session?.accessCode}
                  onSetInputAudioSource={handleSetInputAudioSource}
                  onSetLinkedUsbAudio={handleSetLinkedUsbAudio}
                  onPersistAudioSettings={handlePersistAudioSettings}
                  getAudioSourceForDevice={mixer.getAudioSourceForDevice}
                  ipCameraAllowed={ipCamera.allowed}
                  ipCameraConfig={ipCamera.config}
                  ipCameraSlot={deviceLimit}
                  onSaveIpCamera={ipCamera.save}
                  onRemoveIpCamera={ipCamera.remove}
                />
              </div>

              <div ref={trailingChromeRef} className="dashboard-workspace-chrome shrink-0">
                <div className="flex shrink-0 items-center gap-1.5 overflow-hidden border-t border-mixer-border bg-[#0d0d0d] px-2 py-1">
                  {canAccessPrism && (
                    <Link
                      to="/prism"
                      title={prismOnAir ? 'Regal Prism feed active on mixer' : 'Open Regal Prism VP studio'}
                      className={cn(
                        'inline-flex shrink-0 items-center gap-1 rounded border px-2 py-0.5 text-[9px] font-bold tracking-wider',
                        prismOnAir
                          ? 'border-amber-400/60 bg-amber-500/20 text-amber-200'
                          : 'border-amber-500/40 bg-amber-950/40 text-amber-200 hover:border-amber-400/60 hover:bg-amber-900/50',
                      )}
                    >
                      <Sparkles className="h-3 w-3" />
                      {prismOnAir ? 'PRISM · LIVE' : 'REGAL PRISM'}
                    </Link>
                  )}
                  {canAccessDisplay && (
                    <Link
                      to="/display"
                      title="Open Regal Display presentation engine"
                      className="inline-flex shrink-0 items-center gap-1 rounded border border-violet-500/40 bg-violet-950/40 px-2 py-0.5 text-[9px] font-bold tracking-wider text-violet-200 hover:border-violet-400/60 hover:bg-violet-900/50"
                    >
                      <MonitorPlay className="h-3 w-3" />
                      REGAL DISPLAY
                    </Link>
                  )}
                  {programOutputUrl && (
                    <>
                      {(canAccessPrism || canAccessDisplay) && (
                        <span className="h-3 w-px shrink-0 bg-mixer-border/80" aria-hidden />
                      )}
                      <span className="shrink-0 text-[8px] font-bold tracking-wider text-emerald-300/90">
                        OUTPUT
                      </span>
                      <code
                        className="min-w-0 flex-1 truncate rounded bg-black/40 px-1.5 py-0.5 text-[9px] text-emerald-200"
                        title={programOutputUrl}
                      >
                        {programOutputUrl}
                      </code>
                      <button
                        type="button"
                        onClick={() => void copyProgramOutputUrl()}
                        title={copiedOutputUrl ? 'Copied' : 'Copy program output URL'}
                        aria-label={copiedOutputUrl ? 'Copied program output URL' : 'Copy program output URL'}
                        className="inline-flex shrink-0 items-center rounded border border-emerald-500/30 bg-emerald-950/40 p-1 text-emerald-200 hover:bg-emerald-900/50"
                      >
                        {copiedOutputUrl ? (
                          <Check className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={openProgramOutputWindow}
                        title="Open program output in new window"
                        aria-label="Open program output in new window"
                        className="inline-flex shrink-0 items-center rounded border border-emerald-500/30 bg-emerald-950/40 p-1 text-emerald-200 hover:bg-emerald-900/50"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
              </div>
          </div>
        )}
      </div>

      {externalDisplay.portalTarget &&
        createPortal(
          <CompositeMonitor
            label="PGM"
            device={pgmDevice}
            subDevice={controls.outputMode === 'pip' || controls.outputMode === 'key' ? subDevice : null}
            fromDevice={transitionFromDevice ?? pgmDevice}
            toDevice={pstDevice}
            transitionProgress={transitionProgress}
            transitionType={controls.transition.type}
            fadeToBlackLevel={engine.fadeToBlackLevel}
            outputMode={controls.outputMode}
            pip={controls.pip}
            keySettings={controls.key}
            layers={controls.pgmLayers}
            overlay={pgmDevice ? mixer.getOverlayForDevice(pgmDevice.deviceId) : 'none'}
            quality={pgmDevice ? mixer.getQualityForDevice(pgmDevice.deviceId) : 'auto'}
            audioMuted={controls.audio.masterMuted}
            volume={pgmVolume}
            isOnAir={controls.isOnAir}
            aspectRatio={aspectRatio}
            audioDeviceId={pgmAudioDeviceId}
            showClock={false}
            cleanOutput
            replayTake={replayPush}
            onReplayEnded={handleReplayEnded}
          />,
          externalDisplay.portalTarget,
        )}

      {controls.showMultiview && (
        <MultiviewModal
          devices={sourceDevices}
          pstDeviceId={controls.pstDeviceId}
          pgmDeviceId={controls.pgmDeviceId}
          getQuality={mixer.getQualityForDevice}
          isViewAudioMuted={mixer.isViewAudioMuted}
          onToggleViewAudioMute={mixer.toggleViewAudioMute}
          getMonitorVolume={mixer.getMonitorVolumeForDevice}
          getMonitorAudioDeviceId={mixer.getMonitorAudioDeviceId}
          aspectRatio={aspectRatio}
          deviceLimit={deviceLimit}
          onSelect={handleFocusSource}
          onClose={mixer.toggleMultiview}
        />
      )}
    </div>
  );
}
