import type { AudioSettings } from '../types/mixer';
import type { AudioInputSource } from '../types/audio';

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  masterVolume: 80,
  masterMuted: true,
  audioFollowVideo: true,
  inputVolumes: {},
  inputMuted: {},
  viewAudioMuted: {},
  viewMonitorVolumes: {},
  monitorMasterMuted: false,
  inputAudioSources: {},
  linkedUsbAudio: {},
  soloInputId: null,
};

/** Merge persisted / partial audio state with defaults (avoids undefined record access). */
export function normalizeAudioSettings(partial?: Partial<AudioSettings> | null): AudioSettings {
  const p = partial ?? {};
  return {
    masterVolume: p.masterVolume ?? DEFAULT_AUDIO_SETTINGS.masterVolume,
    masterMuted: p.masterMuted ?? DEFAULT_AUDIO_SETTINGS.masterMuted,
    audioFollowVideo: p.audioFollowVideo ?? DEFAULT_AUDIO_SETTINGS.audioFollowVideo,
    monitorMasterMuted: p.monitorMasterMuted ?? DEFAULT_AUDIO_SETTINGS.monitorMasterMuted,
    soloInputId: p.soloInputId ?? DEFAULT_AUDIO_SETTINGS.soloInputId,
    inputVolumes: { ...DEFAULT_AUDIO_SETTINGS.inputVolumes, ...p.inputVolumes },
    inputMuted: { ...DEFAULT_AUDIO_SETTINGS.inputMuted, ...p.inputMuted },
    viewAudioMuted: { ...DEFAULT_AUDIO_SETTINGS.viewAudioMuted, ...p.viewAudioMuted },
    viewMonitorVolumes: { ...DEFAULT_AUDIO_SETTINGS.viewMonitorVolumes, ...p.viewMonitorVolumes },
    inputAudioSources: { ...DEFAULT_AUDIO_SETTINGS.inputAudioSources, ...p.inputAudioSources },
    linkedUsbAudio: { ...DEFAULT_AUDIO_SETTINGS.linkedUsbAudio, ...p.linkedUsbAudio },
  };
}

export function resolveAudioStreamDeviceId(
  deviceId: string,
  getAudioSourceForDevice: (id: string) => AudioInputSource,
  linkedUsbAudio: Record<string, string | null> | undefined,
): string {
  const source = getAudioSourceForDevice(deviceId);
  if (source === 'usb_audio' || source === 'capture_card') {
    return linkedUsbAudio?.[deviceId] ?? deviceId;
  }
  return deviceId;
}
