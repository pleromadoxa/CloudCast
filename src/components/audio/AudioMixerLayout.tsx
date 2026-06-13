import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid, LogOut, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useProduction } from '../../context/ProductionContext';
import { reconnectWhepPoolDevice } from '../../lib/whepStreamPool';
import { useCloudCast } from '../../context/CloudCastContext';
import { AccessCodePanel } from '../session/AccessCodePanel';
import { CloudCastLogo } from '../brand/CloudCastLogo';
import { CLOUDCAST_NAV_LOGO } from '../../lib/branding';
import { resolveProductPlan, canLinkAudioVideoMixers } from '../../lib/productEntitlements';
import { useAudioConsoleState } from '../../hooks/useAudioConsoleState';
import { useAudioMixerEngine } from '../../hooks/useAudioMixerEngine';
import { useAudioConsoleShortcuts } from '../../hooks/useAudioConsoleShortcuts';
import { useLocalHostAudioInputs } from '../../hooks/useLocalHostAudioInputs';
import { updateDeviceAudioSettings } from '../../lib/streamingService';
import { StudioLiveConsole } from './StudioLiveConsole';
import { AudioUnlockBanner } from './AudioUnlockBanner';
import { VideoBridgePanel } from './VideoBridgePanel';
import { AudioMixerEngineProvider } from '../../context/AudioMixerEngineContext';
import { AudioStreamResolverProvider } from '../../context/AudioStreamResolverContext';
import { usePgmBridgePublisher } from '../../lib/pgmBridgeTransport';
import { AUDIO_MIXER_MAX_CHANNELS } from '../../config/products';
import { createEmptyAudioSlot, isRealDevice } from '../../types/device';
import type { AudioInputSource } from '../../types/audio';
import { ProgramPresetToolbar } from '../presets/ProgramPresetToolbar';
import { cn } from '../../lib/utils';
import { PRODUCTION_OFFSCREEN_STYLE, productionShellClass } from '../../lib/productionShell';

interface AudioMixerLayoutProps {
  /** Off-screen render while the audio engine stays alive on another route */
  hidden?: boolean;
}

export function AudioMixerLayout({ hidden = false }: AudioMixerLayoutProps) {
  const { profile, signOut } = useAuth();
  const { setAudioConsoleActive } = useProduction();
  const { session, sessionLoading, devices, regenerateCode, isRegenerating, reconnect, error, getMeshStream } =
    useCloudCast();
  const planId = resolveProductPlan(profile, 'audio_mixer');
  const canBridge = canLinkAudioVideoMixers(profile);
  const [bridgeCode, setBridgeCode] = useState<string | null>(null);

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
    enabled: canBridge && Boolean(bridgeCode),
  });

  const channelDeviceIds = useMemo(() => {
    return mergedDevices.map((d) => (isRealDevice(d) ? d.deviceId : ''));
  }, [mergedDevices]);

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
      setInputAudioSource(deviceId, source);
      void persistSource(deviceId, source, linkedUsb[deviceId] ?? null);
    },
    [linkedUsb, persistSource, setInputAudioSource],
  );

  const handleSetLinkedUsb = useCallback(
    (deviceId: string, audioDeviceId: string | null) => {
      setLinkedUsbAudio(deviceId, audioDeviceId);
      void persistSource(deviceId, getAudioSourceForDevice(deviceId), audioDeviceId);
    },
    [getAudioSourceForDevice, persistSource, setLinkedUsbAudio],
  );

  useAudioConsoleShortcuts(state, channelDeviceIds, {
    onSelectChannel,
    onToggleMute,
    onToggleSolo,
    onToggleMasterMute,
    onToggleMonitorMute,
    onStoreScene,
    onRecallScene,
  });

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
          <Link
            to="/hub"
            className="hidden items-center gap-1 text-sky-200/60 hover:text-white sm:inline-flex"
            title="All products"
          >
            <LayoutGrid className="h-3.5 w-3.5" /> HUB
          </Link>
          <Link to="/profile" className="hidden text-sky-200/60 hover:text-white lg:inline">
            Profile
          </Link>
          <button type="button" onClick={() => { void signOut(); }} className="mixer-btn p-1" title="Sign out">
            <LogOut className="h-3 w-3" />
          </button>
        </div>
      </header>
      )}

      <div className="min-h-0 flex-1 overflow-auto p-2 sm:p-3">
        <AudioUnlockBanner />
        <StudioLiveConsole
          devices={mergedDevices}
          planId={planId}
          state={state}
          scenes={scenes}
          getAudioSourceForDevice={getAudioSourceForDevice}
          linkedUsbAudio={linkedUsb}
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
          onSelectChannel={onSelectChannel}
          onSetBank={onSetBank}
          onToggleMix={onToggleMix}
          onToggleMute={onToggleMute}
          onToggleSolo={onToggleSolo}
          onSetVolume={onSetVolume}
          onSetMasterVolume={onSetMasterVolume}
          onSetMonitorVolume={onSetMonitorVolume}
          onToggleMasterMute={onToggleMasterMute}
          onToggleMonitorMute={onToggleMonitorMute}
          onToggleConsoleEnabled={onToggleConsoleEnabled}
          onTogglePeakHold={onTogglePeakHold}
          onSetFatParam={onSetFatParam}
          onToggleHpfBypass={onToggleHpfBypass}
          onPatchNoiseCancel={onPatchNoiseCancel}
          onLearnNoiseFloor={onLearnNoiseFloor}
          learningNoiseFor={learningNoiseFor}
          onSetMixSend={onSetMixSend}
          onToggleFx={onToggleFx}
          onSetFxMix={onSetFxMix}
          onSetChannelLabel={onSetChannelLabel}
          onSetSource={handleSetSource}
          onSetLinkedUsb={handleSetLinkedUsb}
          onStoreScene={onStoreScene}
          onRecallScene={onRecallScene}
        />
      </div>
    </div>
    </AudioMixerEngineProvider>
    </AudioStreamResolverProvider>
  );
}
