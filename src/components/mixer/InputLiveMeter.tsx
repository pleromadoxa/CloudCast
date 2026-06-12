import { useCloudCast } from '../../context/CloudCastContext';
import { resolveAudioStreamDeviceId } from '../../lib/audioSettings';
import type { AudioInputSource } from '../../types/audio';
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
  const { getMeshStream } = useCloudCast();
  const streamId = resolveAudioStreamDeviceId(deviceId, getAudioSourceForDevice, linkedUsbAudio);
  const stream = getMeshStream(streamId);

  return (
    <InputAudioVisualizer
      stream={stream}
      enabled={enabled}
      accent={accent}
      compact={compact}
      layout={layout}
      size={size}
      className={className}
    />
  );
}
