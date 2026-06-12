import { useAudioChannelPlayback, useAudioMixerPlaybackRoutes } from '../../hooks/useAudioMixerPlayback';
import type { AudioConsoleState } from '../../hooks/useAudioConsoleState';
import type { AudioInputSource } from '../../types/audio';
import type { Device } from '../../types/device';

function ChannelSpeaker({
  deviceId,
  stream,
  pgmVolume,
  monitorVolume,
}: {
  deviceId: string;
  stream: MediaStream | null;
  pgmVolume: number;
  monitorVolume: number;
}) {
  const { setMediaRef } = useAudioChannelPlayback({
    deviceId,
    stream,
    pgmVolume,
    monitorVolume,
  });

  return (
    <video
      ref={setMediaRef}
      className="audio-mixer-speaker-sink"
      playsInline
      aria-hidden
      data-device-id={deviceId}
    />
  );
}

/**
 * Reliable local speaker output for the audio mixer.
 * Uses hidden media elements + Web Audio (same stack as the video mixer StreamPlayer).
 */
export function AudioMixerSpeakerOutput({
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
  const routes = useAudioMixerPlaybackRoutes({
    devices,
    state,
    getAudioSourceForDevice,
    linkedUsbAudio,
  });

  if (routes.length === 0) return null;

  return (
    <div className="audio-mixer-speaker-output" aria-hidden>
      {routes.map((route) => (
        <ChannelSpeaker
          key={route.wireKey}
          deviceId={route.deviceId}
          stream={route.stream}
          pgmVolume={route.pgmVolume}
          monitorVolume={route.monitorVolume}
        />
      ))}
    </div>
  );
}
