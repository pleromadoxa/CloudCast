import { cn } from '../../lib/utils';
import type { Device } from '../../types/device';
import type { AudioInputSource } from '../../types/audio';
import { InputLiveMeter } from './InputLiveMeter';
import type { VisualizerAccent } from './InputAudioVisualizer';

interface AudioInputStripProps {
  device: Device;
  index: number;
  accent: VisualizerAccent;
  enabled: boolean;
  getAudioSourceForDevice: (deviceId: string) => AudioInputSource;
  linkedUsbAudio: Record<string, string | null> | undefined;
  isOnAir?: boolean;
  badge?: 'pgm' | 'live' | null;
  muteActive: boolean;
  onMute: () => void;
  muteTitle: string;
  soloActive?: boolean;
  soloBlocked?: boolean;
  onSolo?: () => void;
  volume: number;
  onVolumeChange: (value: number) => void;
  volumeDisabled?: boolean;
  sliderAccent?: 'green' | 'red';
}

export function AudioInputStrip({
  device,
  index,
  accent,
  enabled,
  getAudioSourceForDevice,
  linkedUsbAudio,
  isOnAir = false,
  badge = null,
  muteActive,
  onMute,
  muteTitle,
  soloActive = false,
  soloBlocked = false,
  onSolo,
  volume,
  onVolumeChange,
  volumeDisabled = false,
  sliderAccent = 'green',
}: AudioInputStripProps) {
  const slot = device.slotNumber ?? index + 1;

  return (
    <article
      className={cn('audio-input-strip', isOnAir && 'audio-input-strip--on-air')}
    >
      <div className="audio-input-strip__label">
        <span className={cn('audio-input-strip__slot', sliderAccent === 'red' && 'text-mixer-red')}>
          {slot}
        </span>
        <span className="audio-input-strip__name" title={device.label}>
          {device.label}
        </span>
        {badge === 'pgm' && (
          <span className="audio-input-strip__badge audio-input-strip__badge--muted">PGM</span>
        )}
        {badge === 'live' && (
          <span className="audio-input-strip__badge audio-input-strip__badge--live">LIVE</span>
        )}
      </div>

      <div className="audio-input-strip__main">
        <InputLiveMeter
          deviceId={device.deviceId}
          getAudioSourceForDevice={getAudioSourceForDevice}
          linkedUsbAudio={linkedUsbAudio}
          accent={accent}
          enabled={enabled}
          layout="strip"
          size="xs"
          className="audio-input-strip__viz"
        />

        <div className="audio-input-strip__pads">
          <button
            type="button"
            onClick={onMute}
            className={cn(
              'audio-input-strip__pad',
              muteActive && 'atem-toggle-glow',
            )}
            title={muteTitle}
          >
            M
          </button>
          {onSolo && (
            <button
              type="button"
              onClick={onSolo}
              className={cn(
                'audio-input-strip__pad',
                soloActive && 'atem-toggle-on',
                soloBlocked && 'opacity-40',
              )}
              title="Solo on PGM bus"
            >
              S
            </button>
          )}
        </div>
      </div>

      <div className="audio-input-strip__fader">
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          className={cn(
            'deck-h-slider audio-input-strip__slider',
            sliderAccent === 'green' ? 'accent-mixer-green' : 'accent-mixer-red',
          )}
          disabled={volumeDisabled}
        />
        <span className="audio-input-strip__level">
          {volumeDisabled ? '—' : volume}
        </span>
      </div>
    </article>
  );
}
