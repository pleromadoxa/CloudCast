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
    <section
      className="studiolive-host-usb studiolive-host-usb--compact"
      title="Add microphones and audio interfaces plugged into this computer, or pair USB devices from CloudCast Mobile."
    >
      <div className="studiolive-host-usb__toolbar">
        <span className="studiolive-host-usb__label">
          <Usb className="h-3 w-3 shrink-0" />
          USB inputs
        </span>

        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="studiolive-source-panel__select studiolive-host-usb__select"
          disabled={atLimit || selectableDevices.length === 0}
        >
          <option value="">
            {selectableDevices.length === 0
              ? 'No USB devices detected…'
              : 'Select USB device…'}
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
          <Plus className="h-3 w-3" />
          Add
        </button>

        <span className="studiolive-host-usb__meta">
          {localDevices.length}/{maxInputs}
          {selectableDevices.length > 0 && ` · ${selectableDevices.length} avail`}
        </span>

        {localDevices.map((device) => (
          <span key={device.deviceId} className="studiolive-host-usb__chip">
            <Mic className="h-2.5 w-2.5 shrink-0 text-sky-300" />
            <span className="truncate max-w-[8rem]" title={device.label}>
              {device.label}
            </span>
            <button
              type="button"
              className="studiolive-host-usb__chip-remove"
              onClick={() => onRemove(device.deviceId)}
              title="Remove USB input"
            >
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}

        <button
          type="button"
          className="studiolive-host-usb__refresh studiolive-host-usb__refresh--inline"
          onClick={() => { void onRefresh(); }}
          disabled={scanning}
          title="Rescan connected USB devices"
        >
          <RefreshCw className={cn('h-3 w-3', scanning && 'animate-spin')} />
        </button>
      </div>

      {error && <p className="studiolive-host-usb__error">{error}</p>}
    </section>
  );
}
