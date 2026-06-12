import { useCloudCast } from '../../context/CloudCastContext';
import { useAudioMixerMeters } from '../../context/AudioMixerEngineContext';
import { resolveAudioStreamDeviceId } from '../../lib/audioSettings';
import type { AudioInputSource } from '../../types/audio';
import { useStreamAudioRevision } from '../../hooks/useStreamAudioRevision';
import {
  InputAudioVisualizer,
  type VisualizerAccent,
  type VisualizerLayout,
  type VisualizerSize,
} from './InputAudioVisualizer';

interface InputLiveMeterProps {
  deviceId: string;
  getAudioSourceForDevice: (deviceId: string) => AudioInputSource;
  linkedUsbAudio: Record<string, string | null> | undefined;
  accent?: VisualizerAccent;
  enabled?: boolean;
  compact?: boolean;
  layout?: VisualizerLayout;
  size?: VisualizerSize;
  className?: string;
}

export function InputLiveMeter({
  deviceId,
  getAudioSourceForDevice,
  linkedUsbAudio,
  accent = 'neutral',
  enabled = true,
  compact = false,
  layout = 'stack',
  size,
  className,
}: InputLiveMeterProps) {
  const { getMeshStream, meshStreams } = useCloudCast();
  const mixerMeters = useAudioMixerMeters();
  const streamId = resolveAudioStreamDeviceId(deviceId, getAudioSourceForDevice, linkedUsbAudio);
  const stream = getMeshStream(streamId);
  const processedAnalyser = mixerMeters?.getChannelAnalyser(deviceId) ?? null;
  const streamRevision = useStreamAudioRevision(stream);

  return (
    <InputAudioVisualizer
      key={`${streamId}-${stream?.id ?? 'none'}-${meshStreams.size}-${streamRevision}-${processedAnalyser ? 'dsp' : 'raw'}`}
      stream={processedAnalyser ? null : stream}
      analyser={processedAnalyser}
      enabled={enabled}
      accent={accent}
      compact={compact}
      layout={layout}
      size={size}
      className={className}
    />
  );
}
