import { useCallback, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid, LogOut, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { reconnectWhepPoolDevice } from '../../lib/whepStreamPool';
import { useCloudCast } from '../../context/CloudCastContext';
import { AccessCodePanel } from '../session/AccessCodePanel';
import { CloudCastLogo } from '../brand/CloudCastLogo';
import { CLOUDCAST_NAV_LOGO } from '../../lib/branding';
import { resolveProductPlan } from '../../lib/productEntitlements';
import { useAudioConsoleState } from '../../hooks/useAudioConsoleState';
import { useAudioMixerEngine } from '../../hooks/useAudioMixerEngine';
import { useAudioConsoleShortcuts } from '../../hooks/useAudioConsoleShortcuts';
import { updateDeviceAudioSettings } from '../../lib/streamingService';
import { StudioLiveConsole } from './StudioLiveConsole';
import { AudioUnlockBanner } from './AudioUnlockBanner';
import { AudioMixerSpeakerOutput } from './AudioMixerSpeakerOutput';
import { AUDIO_MIXER_MAX_CHANNELS } from '../../config/products';
import { createEmptyAudioSlot, isRealDevice } from '../../types/device';
import type { AudioInputSource } from '../../types/audio';

export function AudioMixerLayout() {
  const { profile, signOut } = useAuth();
  const { session, sessionLoading, devices, regenerateCode, isRegenerating, reconnect } = useCloudCast();
  const planId = resolveProductPlan(profile, 'audio_mixer');

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

  useAudioMixerEngine({
    devices,
    state,
    getAudioSourceForDevice,
    linkedUsbAudio: linkedUsb,
    learningNoiseFor,
    onNoiseFloorLearned,
  });

  const channelDeviceIds = useMemo(() => {
    const real = devices.filter(isRealDevice);
    const padded = [...real];
    while (padded.length < AUDIO_MIXER_MAX_CHANNELS) {
      padded.push(createEmptyAudioSlot(padded.length + 1));
    }
    return padded.slice(0, AUDIO_MIXER_MAX_CHANNELS).map((d) =>
      isRealDevice(d) ? d.deviceId : '',
    );
  }, [devices]);

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
    <div className="audio-mixer-shell flex h-full min-h-0 flex-col overflow-hidden">
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
          className="hidden min-w-0 sm:flex"
        />
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

      <div className="min-h-0 flex-1 overflow-auto p-2 sm:p-3">
        <AudioUnlockBanner />
        <AudioMixerSpeakerOutput
          devices={devices}
          state={state}
          getAudioSourceForDevice={getAudioSourceForDevice}
          linkedUsbAudio={linkedUsb}
        />
        <StudioLiveConsole
          devices={devices}
          planId={planId}
          state={state}
          scenes={scenes}
          getAudioSourceForDevice={getAudioSourceForDevice}
          linkedUsbAudio={linkedUsb}
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
  );
}
