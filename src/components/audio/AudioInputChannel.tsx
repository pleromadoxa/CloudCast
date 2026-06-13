import type { LucideIcon } from 'lucide-react';
import { Headphones, Lock, Mic, Radio, Smartphone, Usb, Wifi } from 'lucide-react';
import type { Device, DeviceStatus } from '../../types/device';
import { isRealDevice } from '../../types/device';
import type { AudioInputSource } from '../../types/audio';
import { AUDIO_SOURCE_LABELS } from '../../types/audio';
import { unlockDashboardAudio } from '../../lib/audioOutput';
import { isDeviceLinkedOnSession } from '../../lib/deviceConnection';
import { cn } from '../../lib/utils';
import { InputLiveMeter } from '../mixer/InputLiveMeter';

function inputIcon(device: Device): LucideIcon {
  if (device.platform === 'usb' || device.deviceType === 'usb') return Usb;
  if (device.deviceRole === 'audio' || device.audioSource === 'usb_audio') return Mic;
  return Smartphone;
}

function sourceShortLabel(source: AudioInputSource): string {
  if (source === 'usb_audio') return 'USB';
  if (source === 'capture_card') return 'CARD';
  return 'PHONE';
}

function statusLabel(
  device: Device,
  locked: boolean,
): { text: string; tone: 'empty' | 'locked' | 'offline' | 'connecting' | 'live' | 'error' } {
  if (locked) return { text: 'LOCKED', tone: 'locked' };
  if (!isRealDevice(device)) return { text: 'EMPTY', tone: 'empty' };
  if (device.status === 'live') return { text: 'LIVE', tone: 'live' };
  if (isDeviceLinkedOnSession(device)) return { text: 'LINK', tone: 'live' };
  if (device.status === 'connecting') return { text: 'WAIT', tone: 'connecting' };
  if (device.status === 'error') return { text: 'ERR', tone: 'error' };
  return { text: 'OFF', tone: 'offline' };
}

export function AudioInputChannel({
  index,
  device,
  locked,
  selected,
  live,
  label,
  volume,
  muted,
  solo,
  onMix,
  mixerEnabled = true,
  audioSource,
  getAudioSourceForDevice,
  linkedUsbAudio,
  onSelect,
  onToggleSolo,
  onToggleMute,
  onToggleMix,
  onSetVolume,
}: {
  index: number;
  device: Device;
  locked: boolean;
  selected: boolean;
  live: boolean;
  label: string;
  volume: number;
  muted: boolean;
  solo: boolean;
  onMix: boolean;
  mixerEnabled?: boolean;
  audioSource: AudioInputSource;
  getAudioSourceForDevice: (id: string) => AudioInputSource;
  linkedUsbAudio: Record<string, string | null>;
  onSelect: () => void;
  onToggleSolo: () => void;
  onToggleMute: () => void;
  onToggleMix: () => void;
  onSetVolume: (value: number) => void;
}) {
  const Icon = inputIcon(device);
  const status = statusLabel(device, locked);
  const empty = !isRealDevice(device);
  const meterEnabled = live && !muted && onMix && mixerEnabled;

  return (
    <article
      className={cn(
        'studiolive-channel',
        selected && 'studiolive-channel--selected',
        locked && 'studiolive-channel--locked',
        empty && 'studiolive-channel--empty',
        status.tone === 'live' && live && 'studiolive-channel--live',
        status.tone === 'connecting' && 'studiolive-channel--connecting',
        solo && 'studiolive-channel--solo',
        muted && live && 'studiolive-channel--muted',
        onMix && live && 'studiolive-channel--on-mix',
      )}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Channel ${index + 1} ${label}`}
      aria-pressed={selected}
    >
      <header className="studiolive-channel__head">
        <span
          className={cn('studiolive-channel__led', `studiolive-channel__led--${status.tone}`)}
          title={status.text}
          aria-hidden
        />
        <span className="studiolive-channel-num">{String(index + 1).padStart(2, '0')}</span>
        {locked && <Lock className="studiolive-channel__lock-icon h-2.5 w-2.5" aria-hidden />}
      </header>

      <div className="studiolive-channel__status-row">
        <span className={cn('studiolive-channel__badge', `studiolive-channel__badge--${status.tone}`)}>
          {status.text}
        </span>
        {!empty && (
          <span className="studiolive-channel__source" title={AUDIO_SOURCE_LABELS[audioSource]}>
            {sourceShortLabel(audioSource)}
          </span>
        )}
      </div>

      <div
        className="studiolive-channel-meter"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {live ? (
          <div className={cn('studiolive-channel-meter__shell', meterEnabled && 'studiolive-channel-meter__shell--hot')}>
            <InputLiveMeter
              deviceId={device.deviceId}
              getAudioSourceForDevice={getAudioSourceForDevice}
              linkedUsbAudio={linkedUsbAudio}
              accent={solo ? 'red' : 'green'}
              enabled={meterEnabled}
              layout="strip"
              size="xs"
            />
          </div>
        ) : (
          <div className={cn('studiolive-meter-idle', locked && 'studiolive-meter-idle--locked')}>
            {empty && <span className="studiolive-meter-idle__label">—</span>}
          </div>
        )}
      </div>

      <div
        className="studiolive-channel__fader-block"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="studiolive-fader-wrap">
          <div className="studiolive-fader-track" aria-hidden>
            <div className="studiolive-fader-fill" style={{ height: `${volume}%` }} />
            <div className="studiolive-fader-cap" style={{ bottom: `calc(${volume}% - 4px)` }} />
          </div>
          <input
            type="range"
            min={0}
            max={100}
            disabled={!live}
            value={volume}
            aria-label={`Channel ${index + 1} fader`}
            onPointerDown={() => { void unlockDashboardAudio(); }}
            onChange={(e) => onSetVolume(Number(e.target.value))}
            className="studiolive-fader-input studiolive-fader-input--vertical"
          />
        </div>
        <span className="studiolive-channel__level">{live ? volume : '—'}</span>
      </div>

      <div className="studiolive-channel__controls" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onSelect}
          className={cn('studiolive-btn studiolive-btn--select', selected && 'studiolive-btn--on')}
          title="Select channel"
        >
          SEL
        </button>
        <button
          type="button"
          disabled={!live}
          onClick={() => {
            void unlockDashboardAudio();
            onToggleSolo();
          }}
          className={cn('studiolive-btn studiolive-btn--solo', solo && 'studiolive-btn--on')}
          title="Solo — routes to monitor bus"
        >
          <Headphones className="h-2.5 w-2.5" />
        </button>
        <button
          type="button"
          disabled={!live}
          onClick={onToggleMute}
          className={cn('studiolive-btn studiolive-btn--mute', muted && 'studiolive-btn--on')}
          title="Mute channel"
        >
          M
        </button>
        <button
          type="button"
          disabled={!live}
          onClick={() => {
            void unlockDashboardAudio();
            onToggleMix();
          }}
          className={cn('studiolive-btn studiolive-btn--pgm', onMix && 'studiolive-btn--on')}
          title={onMix ? 'In main mix (PGM)' : 'Excluded from main mix'}
        >
          <Radio className="h-2.5 w-2.5" />
        </button>
      </div>

      <footer className="studiolive-channel__footer">
        <Icon className="studiolive-channel__type-icon h-2.5 w-2.5" aria-hidden />
        <span className="studiolive-channel-label" title={label}>
          {label}
        </span>
        {live && device.networkType?.toLowerCase().includes('wifi') && (
          <Wifi className="studiolive-channel__net h-2 w-2" aria-hidden />
        )}
      </footer>
    </article>
  );
}

export function channelStatusTone(status: DeviceStatus): string {
  if (status === 'live') return 'live';
  if (status === 'connecting') return 'connecting';
  if (status === 'error') return 'error';
  return 'offline';
}
