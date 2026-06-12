import type { Device } from '../../types/device';
import { isRealDevice } from '../../types/device';
import type { AudioInputSource } from '../../types/audio';
import { unlockDashboardAudio } from '../../lib/audioOutput';
import {
  type FatChannelParams,
  type NoiseCancelSettings,
} from '../../hooks/useAudioConsoleState';
import { InputLiveMeter } from '../mixer/InputLiveMeter';
import { MixerPhysicalButton } from './MixerPhysicalButton';
import { MixerRotaryKnob } from './MixerRotaryKnob';

export function FatChannelPanel({
  channelIndex,
  device,
  live,
  locked,
  label,
  statusLabel,
  muted,
  solo,
  hpfBypass,
  noiseFloor,
  learningNoise,
  getAudioSourceForDevice,
  linkedUsbAudio,
  fat,
  noiseCancel,
  onSetFatParam,
  onToggleMute,
  onToggleSolo,
  onToggleHpfBypass,
  onPatchNoiseCancel,
  onLearnNoiseFloor,
}: {
  channelIndex: number;
  device: Device | null;
  live: boolean;
  locked: boolean;
  label: string;
  statusLabel: string;
  muted: boolean;
  solo: boolean;
  hpfBypass: boolean;
  noiseFloor: number;
  learningNoise: boolean;
  getAudioSourceForDevice: (id: string) => AudioInputSource;
  linkedUsbAudio: Record<string, string | null>;
  fat: FatChannelParams;
  noiseCancel: NoiseCancelSettings;
  onSetFatParam: (key: keyof FatChannelParams, value: number) => void;
  onToggleMute: () => void;
  onToggleSolo: () => void;
  onToggleHpfBypass: () => void;
  onPatchNoiseCancel: (patch: Partial<NoiseCancelSettings>) => void;
  onLearnNoiseFloor: () => void;
}) {
  const deviceId = device?.deviceId ?? '';
  const disabled = !live || locked;

  const handleFat = (key: keyof FatChannelParams, value: number) => {
    if (disabled || !deviceId) return;
    onSetFatParam(key, value);
  };

  const tap = () => {
    void unlockDashboardAudio();
  };

  return (
    <section className="fat-channel fat-channel--hardware">
      <header className="fat-channel__header">
        <div className="fat-channel__title-block">
          <p className="studiolive-section-label">Fat Channel</p>
          <p className="fat-channel__channel">
            CH {String(channelIndex + 1).padStart(2, '0')}
          </p>
        </div>
        <div className="fat-channel__name-block">
          <p className="fat-channel__name">{device ? label : 'No input selected'}</p>
          <p className="fat-channel__status">{statusLabel}</p>
        </div>
      </header>

      <div className="fat-channel__knob-row">
        <MixerRotaryKnob
          label="Gain"
          value={fat.gain}
          min={0}
          max={100}
          disabled={disabled}
          onChange={(v) => handleFat('gain', v)}
        />
        <MixerRotaryKnob
          label="Pan"
          value={fat.pan}
          min={-100}
          max={100}
          disabled={disabled}
          onChange={(v) => handleFat('pan', v)}
        />
        <MixerRotaryKnob
          label="Comp"
          value={fat.comp}
          min={0}
          max={100}
          disabled={disabled}
          onChange={(v) => handleFat('comp', v)}
        />
        <MixerRotaryKnob
          label="HPF"
          value={fat.hpf}
          min={0}
          max={100}
          disabled={disabled || hpfBypass}
          onChange={(v) => handleFat('hpf', v)}
        />
        <MixerRotaryKnob
          label="NC"
          value={noiseCancel.strength}
          min={0}
          max={100}
          disabled={disabled || !noiseCancel.enabled}
          unit="%"
          onChange={(v) => onPatchNoiseCancel({ strength: v })}
        />
      </div>

      <div className="fat-channel__button-bank">
        <div className="fat-channel__button-group">
          <span className="fat-channel__group-label">Channel</span>
          <div className="fat-channel__buttons">
            <MixerPhysicalButton
              label="SOLO"
              variant="solo"
              active={solo}
              disabled={disabled}
              title="Solo — isolate on monitor and PGM"
              onClick={() => { tap(); onToggleSolo(); }}
            />
            <MixerPhysicalButton
              label="MUTE"
              variant="mute"
              active={muted}
              disabled={disabled}
              title="Mute channel"
              onClick={() => { tap(); onToggleMute(); }}
            />
            <MixerPhysicalButton
              label="HPF"
              variant="hpf"
              active={!hpfBypass && fat.hpf > 0}
              disabled={disabled}
              title={hpfBypass ? 'High-pass filter bypassed' : 'High-pass filter active'}
              onClick={() => { tap(); onToggleHpfBypass(); }}
            />
          </div>
        </div>

        <div className="fat-channel__button-group fat-channel__button-group--nc">
          <span className="fat-channel__group-label">Noise Cancel</span>
          <div className="fat-channel__buttons">
            <MixerPhysicalButton
              label="NC"
              variant="nc"
              active={noiseCancel.enabled}
              disabled={disabled}
              title="Master noise cancellation"
              onClick={() => {
                tap();
                onPatchNoiseCancel({ enabled: !noiseCancel.enabled });
              }}
            />
            <MixerPhysicalButton
              label="GATE"
              variant="gate"
              active={noiseCancel.autoGate}
              disabled={disabled || !noiseCancel.enabled}
              title="Adaptive noise gate"
              onClick={() => {
                tap();
                onPatchNoiseCancel({ autoGate: !noiseCancel.autoGate });
              }}
            />
            <MixerPhysicalButton
              label="RMBL"
              variant="nc"
              active={noiseCancel.rumbleCut}
              disabled={disabled || !noiseCancel.enabled}
              title="Cut rumble and room low-end"
              onClick={() => {
                tap();
                onPatchNoiseCancel({ rumbleCut: !noiseCancel.rumbleCut });
              }}
            />
            <MixerPhysicalButton
              label="VOICE"
              variant="nc"
              active={noiseCancel.voiceFocus}
              disabled={disabled || !noiseCancel.enabled}
              title="Speech presence enhancement"
              onClick={() => {
                tap();
                onPatchNoiseCancel({ voiceFocus: !noiseCancel.voiceFocus });
              }}
            />
            <MixerPhysicalButton
              label={learningNoise ? '···' : 'LEARN'}
              variant="learn"
              active={learningNoise}
              momentary
              disabled={disabled || !noiseCancel.enabled}
              title="Sample ambient noise for 2s to tune the gate"
              onClick={() => { tap(); onLearnNoiseFloor(); }}
            />
          </div>
          <p className="fat-channel__nc-hint">
            {noiseCancel.enabled
              ? `Floor ${Math.round(noiseFloor)}% · ${noiseCancel.autoGate ? 'Gate on' : 'Gate off'} · Strength ${noiseCancel.strength}%`
              : 'Enable NC to suppress room noise, hum, and hiss'}
          </p>
        </div>
      </div>

      {live && device && isRealDevice(device) && (
        <div className="fat-channel__meter">
          <InputLiveMeter
            deviceId={device.deviceId}
            getAudioSourceForDevice={getAudioSourceForDevice}
            linkedUsbAudio={linkedUsbAudio}
            accent={solo ? 'red' : noiseCancel.enabled ? 'neutral' : 'green'}
            enabled={!muted}
            layout="strip"
            size="sm"
          />
        </div>
      )}
    </section>
  );
}
