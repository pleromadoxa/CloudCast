import { useState } from 'react';
import { Mic, Plus, RefreshCw, Trash2, Usb } from 'lucide-react';
import { cn } from '../../lib/utils';
import { unlockDashboardAudio } from '../../lib/audioOutput';

import type { Device } from '../../types/device';

interface HostUsbAudioPanelProps {
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
}

export function HostUsbAudioPanel({
  localDevices,
  selectableDevices,
  deviceLabels,
  maxInputs,
  error,
  scanning,
  atLimit,
  onAdd,
  onRemove,
  onRefresh,
}: HostUsbAudioPanelProps) {
  const [selectedId, setSelectedId] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!selectedId || atLimit) return;
    setAdding(true);
    try {
      await unlockDashboardAudio();
      const id = await onAdd(selectedId);
      if (id) setSelectedId('');
    } finally {
      setAdding(false);
    }
  };

  return (
    <section className="studiolive-host-usb studiolive-panel-glow">
      <div className="studiolive-host-usb__header">
        <p className="studiolive-section-label">
          <Usb className="inline h-3 w-3" /> USB Audio Inputs
        </p>
        <button
          type="button"
          className="studiolive-host-usb__refresh"
          onClick={() => { void onRefresh(); }}
          disabled={scanning}
          title="Rescan connected USB devices"
        >
          <RefreshCw className={cn('h-3 w-3', scanning && 'animate-spin')} />
        </button>
      </div>

      <p className="studiolive-host-usb__hint">
        Add microphones and audio interfaces plugged into this computer, or pair USB devices from
        CloudCast Mobile below.
      </p>

      <div className="studiolive-host-usb__controls">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="studiolive-source-panel__select studiolive-host-usb__select"
          disabled={atLimit || selectableDevices.length === 0}
        >
          <option value="">
            {selectableDevices.length === 0
              ? 'No USB audio devices detected…'
              : 'Select USB audio device…'}
          </option>
          {selectableDevices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {deviceLabels[d.deviceId] ?? d.label ?? 'Audio input'}
            </option>
          ))}
        </select>

        <button
          type="button"
          className={cn('studiolive-host-usb__add', atLimit && 'studiolive-host-usb__add--disabled')}
          disabled={!selectedId || atLimit || adding}
          onClick={() => { void handleAdd(); }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add input
        </button>
      </div>

      <p className="studiolive-host-usb__meta">
        {localDevices.length}/{maxInputs} host USB inputs · {selectableDevices.length} available
      </p>

      {error && <p className="studiolive-host-usb__error">{error}</p>}

      {localDevices.length > 0 && (
        <ul className="studiolive-host-usb__list">
          {localDevices.map((device) => (
            <li key={device.deviceId} className="studiolive-host-usb__item">
              <Mic className="h-3 w-3 shrink-0 text-sky-300" />
              <span className="truncate" title={device.label}>
                {device.label}
              </span>
              <button
                type="button"
                className="studiolive-host-usb__remove"
                onClick={() => onRemove(device.deviceId)}
                title="Remove USB input"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
