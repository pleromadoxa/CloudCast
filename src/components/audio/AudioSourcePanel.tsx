import { Route } from 'lucide-react';
import type { Device } from '../../types/device';
import type { AudioInputSource } from '../../types/audio';
import { AUDIO_SOURCE_LABELS } from '../../types/audio';
import { isAudioOnlyDevice, isRealDevice } from '../../types/device';
import { cn } from '../../lib/utils';

const AUDIO_SOURCES: AudioInputSource[] = ['camera', 'capture_card', 'usb_audio'];

export function AudioSourcePanel({
  device,
  getAudioSourceForDevice,
  linkedUsbAudio,
  usbDevices,
  onSetSource,
  onSetLinkedUsb,
  onSetLabel,
  channelLabel,
}: {
  device: Device | null;
  getAudioSourceForDevice: (id: string) => AudioInputSource;
  linkedUsbAudio: Record<string, string | null>;
  usbDevices: Device[];
  onSetSource: (deviceId: string, source: AudioInputSource) => void;
  onSetLinkedUsb: (deviceId: string, audioDeviceId: string | null) => void;
  onSetLabel: (deviceId: string, label: string) => void;
  channelLabel: string;
}) {
  if (!device || !isRealDevice(device)) {
    return (
      <section className="studiolive-source-panel studiolive-panel-glow">
        <p className="studiolive-section-label">
          <Route className="inline h-3 w-3" /> Source Routing
        </p>
        <p className="text-[10px] text-slate-500">Select a live channel to route audio sources.</p>
      </section>
    );
  }

  const source = getAudioSourceForDevice(device.deviceId);
  const needsLinked = source === 'usb_audio' || source === 'capture_card';
  const live = device.status !== 'offline';

  return (
    <section className="studiolive-source-panel studiolive-panel-glow">
      <p className="studiolive-section-label">
        <Route className="inline h-3 w-3" /> Source Routing
      </p>
      <p className="studiolive-source-panel__device">{device.label}</p>

      <label className="studiolive-source-panel__field">
        <span>Channel label</span>
        <input
          type="text"
          value={channelLabel}
          disabled={!live}
          onChange={(e) => onSetLabel(device.deviceId, e.target.value)}
          placeholder={device.label}
          className="studiolive-source-panel__input"
        />
      </label>

      <div className="studiolive-source-panel__sources">
        {AUDIO_SOURCES.map((s) => (
          <button
            key={s}
            type="button"
            disabled={!live}
            onClick={() => onSetSource(device.deviceId, s)}
            className={cn(
              'studiolive-source-panel__btn',
              source === s && 'studiolive-source-panel__btn--on',
            )}
          >
            {s === 'camera' ? 'Phone' : s === 'capture_card' ? 'Card' : 'USB'}
          </button>
        ))}
      </div>

      <p className="studiolive-source-panel__hint">{AUDIO_SOURCE_LABELS[source]}</p>

      {needsLinked && (
        <label className="studiolive-source-panel__field">
          <span>{source === 'capture_card' ? 'Capture card' : 'USB audio device'}</span>
          <select
            value={linkedUsbAudio[device.deviceId] ?? ''}
            disabled={!live}
            onChange={(e) => onSetLinkedUsb(device.deviceId, e.target.value || null)}
            className="studiolive-source-panel__select"
          >
            <option value="">Select device…</option>
            {usbDevices.map((a) => (
              <option key={a.deviceId} value={a.deviceId}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {usbDevices.length > 0 && (
        <p className="studiolive-source-panel__usb-list">
          USB inputs: {usbDevices.map((d) => d.label).join(', ')}
        </p>
      )}
    </section>
  );
}

export function collectUsbAudioDevices(devices: Device[]): Device[] {
  return devices.filter(isAudioOnlyDevice);
}
