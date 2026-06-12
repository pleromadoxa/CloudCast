import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useCloudCast } from '../context/CloudCastContext';
import { resolveAudioStreamDeviceId } from '../lib/audioSettings';
import { ensureAudioOutputReady, unlockDashboardAudio } from '../lib/audioOutput';
import { hasUsableAudio } from '../lib/streamAudioHub';
import { isMixEnabled, type AudioConsoleState } from './useAudioConsoleState';
import type { AudioInputSource } from '../types/audio';
import type { Device } from '../types/device';
import { createEmptyAudioSlot, isRealDevice } from '../types/device';
import { AUDIO_MIXER_MAX_CHANNELS } from '../config/products';
import { useStreamSpeakerPlayback } from './useStreamSpeakerPlayback';

export function pgmVolumeForDevice(state: AudioConsoleState, deviceId: string): number {
  if (state.masterMuted) return 0;
  if (state.inputMuted[deviceId]) return 0;
  if (state.soloId && state.soloId !== deviceId) return 0;
  if (!isMixEnabled(state, deviceId)) return 0;
  const master = state.masterVolume / 100;
  const fader = (state.inputVolumes[deviceId] ?? 75) / 100;
  return master * fader;
}

function monitorTargetDeviceId(state: AudioConsoleState, devices: Device[]): string | null {
  if (state.soloId) return state.soloId;
  const real = devices.filter((d) => isRealDevice(d) && d.status !== 'offline');
  const padded = [...real];
  while (padded.length < AUDIO_MIXER_MAX_CHANNELS) {
    padded.push(createEmptyAudioSlot(padded.length + 1));
  }
  const selected = padded[state.selectedChannel];
  if (selected && isRealDevice(selected)) return selected.deviceId;
  return real[0]?.deviceId ?? null;
}

export function monitorVolumeForDevice(state: AudioConsoleState, deviceId: string): number {
  if (state.monitorMuted || !deviceId) return 0;
  return (state.monitorVolume / 100) * ((state.inputVolumes[deviceId] ?? 75) / 100);
}

/** One paired input — Web Audio to speakers + muted media sink (same as StreamPlayer). */
export function useAudioChannelPlayback({
  stream,
  pgmVolume,
  monitorVolume,
}: {
  deviceId: string;
  stream: MediaStream | null;
  pgmVolume: number;
  monitorVolume: number;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const volume = Math.max(pgmVolume, monitorVolume);
  const active = volume > 0 && Boolean(stream && hasUsableAudio(stream));

  useStreamSpeakerPlayback(stream, active, volume);

  const syncMediaSink = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;

    if (!active || !stream) {
      el.srcObject = null;
      return;
    }

    for (const track of stream.getAudioTracks()) {
      track.enabled = true;
    }

    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
    el.muted = true;
    el.volume = 1;

    void unlockDashboardAudio().then(() => {
      void ensureAudioOutputReady().then(() => {
        el.play().catch(() => undefined);
      });
    });
  }, [active, stream]);

  const setMediaRef = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      if (el) syncMediaSink();
    },
    [syncMediaSink],
  );

  useEffect(() => {
    syncMediaSink();
    if (!stream) return;

    const onTrackChange = () => syncMediaSink();
    stream.addEventListener('addtrack', onTrackChange);
    stream.addEventListener('removetrack', onTrackChange);

    return () => {
      stream.removeEventListener('addtrack', onTrackChange);
      stream.removeEventListener('removetrack', onTrackChange);
    };
  }, [stream, syncMediaSink]);

  return { setMediaRef, active };
}

export function useAudioMixerPlaybackRoutes({
  devices,
  state,
  getAudioSourceForDevice,
  linkedUsbAudio,
}: {
  devices: Device[];
  state: AudioConsoleState;
  getAudioSourceForDevice: (id: string) => AudioInputSource;
  linkedUsbAudio: Record<string, string | null>;
}) {
  const { getMeshStream, meshStreams } = useCloudCast();
  const monitorDeviceId = monitorTargetDeviceId(state, devices);

  return useMemo(() => {
    const candidates = devices.filter(
      (d) => isRealDevice(d) && d.status !== 'offline' && d.status !== 'error',
    );
    return candidates
      .map((device) => {
      const streamId = resolveAudioStreamDeviceId(
        device.deviceId,
        getAudioSourceForDevice,
        linkedUsbAudio,
      );
      const stream = getMeshStream(streamId);
      const pgmVolume = pgmVolumeForDevice(state, device.deviceId);
      const monitorVolume =
        device.deviceId === monitorDeviceId
          ? monitorVolumeForDevice(state, device.deviceId)
          : 0;
      return {
        deviceId: device.deviceId,
        label: device.label,
        stream,
        streamId,
        pgmVolume,
        monitorVolume,
        wireKey: stream ? `${streamId}:${stream.id}:${stream.getAudioTracks().map((t) => t.id).join(',')}` : 'none',
      };
    })
      .filter((route) => route.stream && hasUsableAudio(route.stream));
  }, [devices, state, getAudioSourceForDevice, linkedUsbAudio, getMeshStream, meshStreams, monitorDeviceId]);
}
