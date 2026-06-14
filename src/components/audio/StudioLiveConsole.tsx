import { useMemo } from 'react';
import { Mic, Smartphone, Usb } from 'lucide-react';
import type { Device } from '../../types/device';
import type { AudioInputSource } from '../../types/audio';
import { createEmptyAudioSlot, isRealDevice } from '../../types/device';
import { audioChannelsForPlan, AUDIO_MIXER_MAX_CHANNELS } from '../../config/products';
import type { PlanTier } from '../../types/plans';
import { unlockDashboardAudio } from '../../lib/audioOutput';
import type { ConsoleSceneSnapshot, SceneId } from '../../lib/audioConsolePersistence';
import {
  CONSOLE_BANKS,
  isMixEnabled,
  SCENE_IDS,
  type AudioConsoleState,
  type ConsoleBank,
  getFatChannelParams,
  getNoiseCancelSettings,
  getLearnedNoiseFloor,
  type NoiseCancelSettings,
} from '../../hooks/useAudioConsoleState';
import { cn } from '../../lib/utils';
import { deriveDeviceConnectionDisplay } from '../../lib/deviceConnection';
import { DigitalConsoleScreen } from './DigitalConsoleScreen';
import { MasterOutputPanel } from './MasterOutputPanel';
import { AudioDevicesStrip } from './AudioDevicesStrip';
import { AudioSourcePanel, collectUsbAudioDevices } from './AudioSourcePanel';
import { HostUsbAudioPanel } from './HostUsbAudioPanel';
import { AudioInputChannel } from './AudioInputChannel';
import { FatChannelPanel } from './FatChannelPanel';

interface StudioLiveConsoleProps {
  devices: Device[];
  planId: PlanTier;
  state: AudioConsoleState;
  scenes: Partial<Record<SceneId, ConsoleSceneSnapshot>>;
  getAudioSourceForDevice: (id: string) => AudioInputSource;
  linkedUsbAudio: Record<string, string | null>;
  onSelectChannel: (index: number) => void;
  onSetBank: (bank: ConsoleBank) => void;
  onToggleMix: (deviceId: string) => void;
  onToggleMute: (deviceId: string) => void;
  onToggleSolo: (deviceId: string) => void;
  onSetVolume: (deviceId: string, value: number) => void;
  onSetMasterVolume: (value: number) => void;
  onSetMonitorVolume: (value: number) => void;
  onToggleMasterMute: () => void;
  onToggleMonitorMute: () => void;
  onToggleConsoleEnabled: () => void;
  onTogglePeakHold: () => void;
  onSetFatParam: (deviceId: string, key: keyof import('../../hooks/useAudioConsoleState').FatChannelParams, value: number | boolean) => void;
  onToggleHpfBypass: (deviceId: string) => void;
  onPatchNoiseCancel: (deviceId: string, patch: Partial<NoiseCancelSettings>) => void;
  onLearnNoiseFloor: (deviceId: string) => void;
  learningNoiseFor: string | null;
  onSetMixSend: (deviceId: string, bus: 1 | 2 | 3 | 4, value: number) => void;
  onToggleFx: (slot: 'A' | 'B' | 'C' | 'D') => void;
  onSetFxMix: (slot: 'A' | 'B' | 'C' | 'D', value: number) => void;
  onSetChannelLabel: (deviceId: string, label: string) => void;
  onSetSource: (deviceId: string, source: AudioInputSource) => void;
  onSetLinkedUsb: (deviceId: string, audioDeviceId: string | null) => void;
  onStoreScene: (sceneId: SceneId) => void;
  onRecallScene: (sceneId: SceneId) => void;
  readOnly?: boolean;
  fatChannelLocked?: boolean;
  hostUsb?: {
    localDevices: Device[];
    selectableDevices: MediaDeviceInfo[];
    deviceLabels: Record<string, string>;
    maxInputs: number;
    error: string | null;
    scanning: boolean;
    atLimit: boolean;
    onAdd: (mediaDeviceId: string) => Promise<string | null>;
    onRemove: (deviceId: string) => void;
    onRefresh: () => Promise<MediaDeviceInfo[]>;
  };
}

interface ChannelSlot {
  device: Device;
  locked: boolean;
}

function buildChannelSlots(devices: Device[], activeChannels: number): ChannelSlot[] {
  const real = devices.filter(isRealDevice);
  const padded: Device[] = [...real];
  while (padded.length < AUDIO_MIXER_MAX_CHANNELS) {
    padded.push(createEmptyAudioSlot(padded.length + 1));
  }
  return padded.slice(0, AUDIO_MIXER_MAX_CHANNELS).map((device, index) => ({
    device,
    locked: index >= activeChannels,
  }));
}

function channelDisplayLabel(device: Device, labels: Record<string, string>): string {
  return labels[device.deviceId]?.trim() || device.label;
}

function channelStatusText(device: Device | undefined, locked: boolean): string {
  if (!device || !isRealDevice(device)) return 'Empty slot';
  if (locked) return 'Plan locked';
  const display = deriveDeviceConnectionDisplay(device);
  if (display === 'live') return 'Live on air';
  if (display === 'connected') return 'Connected — waiting for Go Live';
  if (display === 'connecting') return 'Connecting…';
  if (display === 'pairing') return 'Pairing…';
  if (device.status === 'error') return 'Stream error';
  return 'Offline';
}

export function StudioLiveConsole({
  devices,
  planId,
  state,
  scenes,
  getAudioSourceForDevice,
  linkedUsbAudio,
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
  onToggleConsoleEnabled,
  onTogglePeakHold,
  onSetFatParam,
  onToggleHpfBypass,
  onPatchNoiseCancel,
  onLearnNoiseFloor,
  learningNoiseFor,
  onSetMixSend,
  onToggleFx,
  onSetFxMix,
  onSetChannelLabel,
  onSetSource,
  onSetLinkedUsb,
  onStoreScene,
  onRecallScene,
  readOnly = false,
  fatChannelLocked = false,
  hostUsb,
}: StudioLiveConsoleProps) {
  const activeChannels = audioChannelsForPlan(planId);
  const channels = useMemo(
    () => buildChannelSlots(devices, activeChannels),
    [devices, activeChannels],
  );
  const usbDevices = useMemo(() => collectUsbAudioDevices(devices), [devices]);
  const liveDevices = useMemo(() => devices.filter(isRealDevice), [devices]);

  const selectedSlot = channels[state.selectedChannel] ?? channels[0];
  const selected = selectedSlot?.device;
  const selectedLocked = selectedSlot?.locked ?? false;
  const selectedLive =
    selected && isRealDevice(selected) && selected.status !== 'offline' && !selectedLocked;
  const selectedId = selected?.deviceId ?? '';
  const fat = getFatChannelParams(state, selectedId);
  const noiseCancel = getNoiseCancelSettings(state, selectedId);

  return (
    <div
      className="studiolive-console studiolive-console--premium"
      onPointerDown={() => { void unlockDashboardAudio(); }}
    >
      <div className="studiolive-console__ambient" aria-hidden />

      <AudioDevicesStrip
        devices={liveDevices}
        selectedChannel={state.selectedChannel}
        channelLabels={state.channelLabels}
        onSelectChannel={onSelectChannel}
      />

      <div className="studiolive-input-strip">
        <span className="studiolive-input-strip__label">Inputs</span>
        <span><Smartphone className="inline h-3 w-3" /> CloudCast Mobile</span>
        <span><Usb className="inline h-3 w-3" /> USB microphones (this computer)</span>
        <span><Mic className="inline h-3 w-3" /> Line / capture alternatives</span>
        <span className="studiolive-input-strip__hint">
          Keys: 1–9 select · M mute · Shift+M master · S solo · H monitor · A–D recall · Shift+A–D store
        </span>
      </div>

      {hostUsb && (
        <HostUsbAudioPanel
          localDevices={hostUsb.localDevices}
          selectableDevices={hostUsb.selectableDevices}
          deviceLabels={hostUsb.deviceLabels}
          maxInputs={hostUsb.maxInputs}
          error={hostUsb.error}
          scanning={hostUsb.scanning}
          atLimit={hostUsb.atLimit}
          onAdd={hostUsb.onAdd}
          onRemove={hostUsb.onRemove}
          onRefresh={hostUsb.onRefresh}
        />
      )}

      <div className="studiolive-scenes">
        {SCENE_IDS.map((id) => (
          <div key={id} className="studiolive-scene">
            <button
              type="button"
              className={cn('studiolive-scene__recall', scenes[id] && 'studiolive-scene__recall--stored')}
              onClick={() => onRecallScene(id)}
              disabled={readOnly || !scenes[id]}
              title={`Recall scene ${id}`}
            >
              {id}
            </button>
            <button
              type="button"
              className="studiolive-scene__store"
              onClick={() => onStoreScene(id)}
              disabled={readOnly}
              title={`Store scene ${id} (Shift+${id})`}
            >
              ●
            </button>
          </div>
        ))}
        <span className="studiolive-scenes__label">Scenes</span>
      </div>

      <div className="studiolive-top">
        <div className="studiolive-fat-wrap studiolive-panel-glow">
        <FatChannelPanel
          channelIndex={state.selectedChannel}
          device={selected ?? null}
          live={Boolean(selectedLive)}
          locked={selectedLocked}
          label={selected ? channelDisplayLabel(selected, state.channelLabels) : '—'}
          statusLabel={channelStatusText(selected, selectedLocked)}
          muted={Boolean(selectedId && state.inputMuted[selectedId])}
          solo={state.soloId === selectedId}
          hpfBypass={fat.hpfBypass}
          noiseFloor={getLearnedNoiseFloor(state, selectedId)}
          learningNoise={learningNoiseFor === selectedId}
          getAudioSourceForDevice={getAudioSourceForDevice}
          linkedUsbAudio={linkedUsbAudio}
          fat={fat}
          noiseCancel={noiseCancel}
          onSetFatParam={(key, value) => {
            if (selectedId) onSetFatParam(selectedId, key, value);
          }}
          onToggleMute={() => selectedId && onToggleMute(selectedId)}
          onToggleSolo={() => selectedId && onToggleSolo(selectedId)}
          onToggleHpfBypass={() => selectedId && onToggleHpfBypass(selectedId)}
          onPatchNoiseCancel={(patch) => selectedId && onPatchNoiseCancel(selectedId, patch)}
          onLearnNoiseFloor={() => selectedId && onLearnNoiseFloor(selectedId)}
          fatChannelLocked={fatChannelLocked}
        />
        {state.activeBank === 'mix' && selectedLive && (
          <div className="studiolive-mix-sends studiolive-mix-sends--fat">
            {([1, 2, 3, 4] as const).map((bus) => (
              <label key={bus} className="studiolive-mix-send">
                <span>M{bus}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={state.mixSends[selectedId]?.[bus] ?? 0}
                  onChange={(e) => onSetMixSend(selectedId, bus, Number(e.target.value))}
                  className="studiolive-fader-input"
                />
              </label>
            ))}
          </div>
        )}
        </div>

        <section className="studiolive-display studiolive-panel-glow">
          <p className="studiolive-section-label">Digital Console</p>
          <DigitalConsoleScreen
            bank={state.activeBank}
            channel={selected ?? null}
            channelIndex={state.selectedChannel}
            state={state}
            activeChannels={activeChannels}
            locked={selectedLocked}
            devices={channels.map((c) => c.device)}
            getAudioSourceForDevice={getAudioSourceForDevice}
            linkedUsbAudio={linkedUsbAudio}
            onSelectChannel={onSelectChannel}
            onToggleFx={onToggleFx}
            onSetFxMix={onSetFxMix}
          />
          <div className="studiolive-display-banks">
            {CONSOLE_BANKS.map((bank) => (
              <button
                key={bank.id}
                type="button"
                onClick={() => onSetBank(bank.id)}
                className={cn(
                  'studiolive-bank-btn',
                  state.activeBank === bank.id && 'studiolive-bank-btn--active',
                )}
              >
                {bank.label}
              </button>
            ))}
          </div>
        </section>

        <section className="studiolive-master studiolive-panel-glow">
          <MasterOutputPanel
            consoleEnabled={state.consoleEnabled}
            peakHoldEnabled={state.peakHoldEnabled}
            masterVolume={state.masterVolume}
            masterMuted={state.masterMuted}
            monitorVolume={state.monitorVolume}
            monitorMuted={state.monitorMuted}
            onToggleConsoleEnabled={onToggleConsoleEnabled}
            onTogglePeakHold={onTogglePeakHold}
            onSetMasterVolume={onSetMasterVolume}
            onSetMonitorVolume={onSetMonitorVolume}
            onToggleMasterMute={onToggleMasterMute}
            onToggleMonitorMute={onToggleMonitorMute}
          />
        </section>
      </div>

      {state.activeBank === 'routing' && (
        <AudioSourcePanel
          device={selected ?? null}
          getAudioSourceForDevice={getAudioSourceForDevice}
          linkedUsbAudio={linkedUsbAudio}
          usbDevices={usbDevices}
          onSetSource={onSetSource}
          onSetLinkedUsb={onSetLinkedUsb}
          onSetLabel={onSetChannelLabel}
          channelLabel={selected ? (state.channelLabels[selected.deviceId] ?? '') : ''}
        />
      )}

      <div className={cn('studiolive-fader-bank', readOnly && 'studiolive-fader-bank--readonly')}>
        {channels.map(({ device, locked }, index) => {
          const live = isRealDevice(device) && device.status !== 'offline' && !locked;
          const label = channelDisplayLabel(device, state.channelLabels);

          return (
            <AudioInputChannel
              key={device.deviceId}
              index={index}
              device={device}
              locked={locked}
              selected={state.selectedChannel === index}
              live={live}
              label={label}
              volume={state.inputVolumes[device.deviceId] ?? 75}
              muted={state.inputMuted[device.deviceId] ?? false}
              solo={state.soloId === device.deviceId}
              mixerEnabled={state.consoleEnabled}
              onMix={isMixEnabled(state, device.deviceId)}
              audioSource={getAudioSourceForDevice(device.deviceId)}
              getAudioSourceForDevice={getAudioSourceForDevice}
              linkedUsbAudio={linkedUsbAudio}
              onSelect={() => onSelectChannel(index)}
              onToggleSolo={() => onToggleSolo(device.deviceId)}
              onToggleMute={() => onToggleMute(device.deviceId)}
              onToggleMix={() => onToggleMix(device.deviceId)}
              onSetVolume={(value) => onSetVolume(device.deviceId, value)}
            />
          );
        })}
      </div>

    </div>
  );
}
