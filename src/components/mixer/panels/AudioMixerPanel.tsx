import { Headphones, Mic, MicOff, Radio, Route, Volume2 } from 'lucide-react';
import type { AudioSettings } from '../../../types/mixer';
import type { Device } from '../../../types/device';
import type { AudioInputSource } from '../../../types/audio';
import { AUDIO_SOURCE_LABELS } from '../../../types/audio';
import { isAudioOnlyDevice, isRealDevice, isVideoDevice } from '../../../types/device';
import { unlockDashboardAudio } from '../../../lib/audioOutput';
import { cn } from '../../../lib/utils';
import { AudioMeters } from '../AudioMeters';
import { AudioInputStrip } from '../AudioInputStrip';

interface AudioMixerPanelProps {
  devices: Device[];
  audio: AudioSettings;
  pgmDeviceId: string | null;
  onPatchAudio: (p: Partial<AudioSettings>) => void;
  onSetInputVolume: (deviceId: string, vol: number) => void;
  onToggleInputMute: (deviceId: string) => void;
  onToggleInputSolo: (deviceId: string) => void;
  onToggleViewAudioMute: (deviceId: string) => void;
  onSetViewMonitorVolume: (deviceId: string, vol: number) => void;
  onToggleMonitorMasterMute: () => void;
  onSetInputAudioSource: (deviceId: string, source: AudioInputSource) => void;
  onSetLinkedUsbAudio: (deviceId: string, audioDeviceId: string | null) => void;
  getAudioSourceForDevice: (deviceId: string) => AudioInputSource;
}

const AUDIO_SOURCES: AudioInputSource[] = ['camera', 'capture_card', 'usb_audio'];

export function AudioMixerPanel({
  devices,
  audio,
  pgmDeviceId,
  onPatchAudio,
  onSetInputVolume,
  onToggleInputMute,
  onToggleInputSolo,
  onToggleViewAudioMute,
  onSetViewMonitorVolume,
  onToggleMonitorMasterMute,
  onSetInputAudioSource,
  onSetLinkedUsbAudio,
  getAudioSourceForDevice,
}: AudioMixerPanelProps) {
  const videoInputs = devices.filter(isVideoDevice);
  const usbAudioDevices = devices.filter(isAudioOnlyDevice);

  return (
    <div className="audio-mixer-grid min-h-0 h-full w-full">
      {/* ── PANEL 1: Monitor (local preview) ── */}
      <section className="audio-mixer-panel audio-mixer-panel--monitor">
        <header className="audio-mixer-panel-header audio-mixer-panel-header--compact">
          <div>
            <p className="atem-group-label flex items-center gap-1 text-mixer-green">
              <Headphones className="h-3 w-3" />
              Monitor
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void unlockDashboardAudio();
              onToggleMonitorMasterMute();
            }}
            className={cn(
              'audio-mixer-header-btn',
              audio.monitorMasterMuted && 'atem-toggle-glow',
            )}
          >
            {audio.monitorMasterMuted ? 'MUTED' : 'MON'}
          </button>
        </header>

        <div className="audio-mixer-input-list audio-mixer-input-list--compact">
          {videoInputs.length === 0 && (
            <p className="text-[9px] text-mixer-muted">Pair cameras to monitor audio</p>
          )}
          {videoInputs.map((d, i) => {
            const viewMuted = audio.viewAudioMuted?.[d.deviceId] ?? false;
            const isOnPgm = d.deviceId === pgmDeviceId;
            const monitorEnabled =
              isRealDevice(d) && d.status !== 'offline' && !audio.monitorMasterMuted && !viewMuted;

            return (
              <AudioInputStrip
                key={`mon-${d.deviceId}`}
                device={d}
                index={i}
                accent="green"
                enabled={monitorEnabled}
                getAudioSourceForDevice={getAudioSourceForDevice}
                linkedUsbAudio={audio.linkedUsbAudio}
                badge={isOnPgm ? 'pgm' : null}
                muteActive={viewMuted}
                onMute={() => {
                  void unlockDashboardAudio();
                  onToggleViewAudioMute(d.deviceId);
                }}
                muteTitle={viewMuted ? 'Unmute monitor' : 'Mute monitor'}
                volume={audio.viewMonitorVolumes?.[d.deviceId] ?? 80}
                onVolumeChange={(v) => onSetViewMonitorVolume(d.deviceId, v)}
                volumeDisabled={audio.monitorMasterMuted || viewMuted}
                sliderAccent="green"
              />
            );
          })}
        </div>
      </section>

      {/* ── PANEL 2: PGM Live ── */}
      <section className="audio-mixer-panel audio-mixer-panel--pgm">
        <header className="audio-mixer-panel-header audio-mixer-panel-header--compact">
          <div>
            <p className="atem-group-label flex items-center gap-1 text-mixer-red">
              <Radio className="h-3 w-3" />
              PGM Live
            </p>
          </div>
        </header>

        <div className="audio-mixer-pgm-master audio-mixer-pgm-master--compact">
          <button
            type="button"
            onClick={() => onPatchAudio({ masterMuted: !audio.masterMuted })}
            className={cn(
              'audio-mixer-header-btn audio-mixer-header-btn--mic',
              audio.masterMuted ? 'atem-toggle-glow' : 'atem-toggle-on',
            )}
          >
            {audio.masterMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          </button>
          <div className="audio-mixer-pgm-master-controls">
            <div className="flex w-full min-w-0 items-center gap-1.5">
              <Volume2 className="h-3 w-3 shrink-0 text-mixer-muted" />
              <input
                type="range"
                min={0}
                max={100}
                value={audio.masterVolume}
                onChange={(e) => onPatchAudio({ masterVolume: Number(e.target.value) })}
                className="deck-h-slider min-w-0 flex-1 accent-mixer-red"
              />
              <span className="w-7 shrink-0 text-[8px] font-mono text-mixer-muted">
                {audio.masterVolume}
              </span>
            </div>
            <label className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-wide">
              <input
                type="checkbox"
                checked={audio.audioFollowVideo}
                onChange={(e) => onPatchAudio({ audioFollowVideo: e.target.checked })}
                className="accent-mixer-red"
              />
              AFV
            </label>
          </div>
          <AudioMeters active={Boolean(pgmDeviceId)} muted={audio.masterMuted} size="sm" />
        </div>

        <div className="audio-mixer-input-list audio-mixer-input-list--compact">
          {videoInputs.length === 0 && (
            <p className="text-[9px] text-mixer-muted">No PGM inputs</p>
          )}
          {videoInputs.map((d, i) => {
            const isOnPgm = d.deviceId === pgmDeviceId;
            const pgmMuted = audio.inputMuted?.[d.deviceId];
            const soloed = audio.soloInputId === d.deviceId;
            const soloBlocked = Boolean(audio.soloInputId && !soloed);

            return (
              <AudioInputStrip
                key={`pgm-${d.deviceId}`}
                device={d}
                index={i}
                accent={isOnPgm ? 'red' : 'neutral'}
                enabled={isRealDevice(d) && d.status !== 'offline'}
                getAudioSourceForDevice={getAudioSourceForDevice}
                linkedUsbAudio={audio.linkedUsbAudio}
                isOnAir={isOnPgm}
                badge={isOnPgm ? 'live' : null}
                muteActive={Boolean(pgmMuted)}
                onMute={() => onToggleInputMute(d.deviceId)}
                muteTitle="Mute on PGM bus"
                soloActive={soloed}
                soloBlocked={soloBlocked}
                onSolo={() => onToggleInputSolo(d.deviceId)}
                volume={audio.inputVolumes?.[d.deviceId] ?? 100}
                onVolumeChange={(v) => onSetInputVolume(d.deviceId, v)}
                volumeDisabled={!isOnPgm && audio.audioFollowVideo}
                sliderAccent="red"
              />
            );
          })}
        </div>
      </section>

      {/* ── PANEL 3: Source routing ── */}
      <section className="audio-mixer-panel audio-mixer-panel--route">
        <header className="audio-mixer-panel-header audio-mixer-panel-header--compact">
          <div>
            <p className="atem-group-label flex items-center gap-1">
              <Route className="h-3 w-3" />
              Audio Source
            </p>
          </div>
        </header>

        <div className="audio-mixer-input-list audio-mixer-input-list--compact">
          {videoInputs.length === 0 ? (
            <p className="text-[9px] text-mixer-muted">Pair devices to route audio</p>
          ) : (
            videoInputs.map((d) => {
              const source = getAudioSourceForDevice(d.deviceId);
              const needsLinkedDevice = source === 'usb_audio' || source === 'capture_card';

              return (
                <article key={d.deviceId} className="audio-route-strip">
                  <div className="audio-route-strip__label">
                    <span className="audio-input-strip__slot">{d.slotNumber ?? '?'}</span>
                    <span className="audio-input-strip__name" title={d.label}>
                      {d.label}
                    </span>
                  </div>

                  <div className="audio-route-strip__sources">
                    {AUDIO_SOURCES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => onSetInputAudioSource(d.deviceId, s)}
                        className={cn(
                          'audio-route-strip__btn',
                          source === s && 'atem-toggle-on',
                        )}
                      >
                        {s === 'camera' ? 'Phone' : s === 'capture_card' ? 'Card' : 'USB'}
                      </button>
                    ))}
                  </div>

                  <p className="audio-route-strip__hint">{AUDIO_SOURCE_LABELS[source]}</p>

                  {needsLinkedDevice && (
                    <select
                      value={audio.linkedUsbAudio?.[d.deviceId] ?? ''}
                      onChange={(e) => onSetLinkedUsbAudio(d.deviceId, e.target.value || null)}
                      className="audio-route-strip__select"
                    >
                      <option value="">
                        {source === 'capture_card' ? 'Select capture card…' : 'Select USB audio…'}
                      </option>
                      {usbAudioDevices.map((a) => (
                        <option key={a.deviceId} value={a.deviceId}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  )}
                </article>
              );
            })
          )}
          {usbAudioDevices.length > 0 && (
            <p className="text-[8px] leading-tight text-mixer-muted">
              USB: {usbAudioDevices.map((d) => d.label).join(', ')}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
