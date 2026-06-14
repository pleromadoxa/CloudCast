import {
  Battery,
  ChevronRight,
  Circle,
  RefreshCw,
  Signal,
  Smartphone,
  Wifi,
} from 'lucide-react';
import type { Device } from '../../types/device';
import { deriveDeviceConnectionDisplay, DEVICE_CONNECTION_LABELS } from '../../lib/deviceConnection';
import { cn, formatRelativeTime } from '../../lib/utils';

interface DeviceSidebarProps {
  devices: Device[];
  selectedStreamIds: string[];
  isConnected: boolean;
  signalingConnected: boolean;
  onToggleSelect: (deviceId: string) => void;
  onFocus: (deviceId: string) => void;
  onReconnect: () => void;
}

const displayTone = {
  offline: { color: 'text-offline', dot: 'bg-offline' },
  pairing: { color: 'text-mixer-yellow', dot: 'bg-mixer-yellow animate-pulse' },
  connecting: { color: 'text-mixer-yellow', dot: 'bg-mixer-yellow animate-pulse' },
  connected: { color: 'text-mixer-green', dot: 'bg-mixer-green' },
  live: { color: 'text-live', dot: 'bg-live animate-pulse' },
};

function DeviceCard({
  device,
  isSelected,
  onToggleSelect,
  onFocus,
}: {
  device: Device;
  isSelected: boolean;
  onToggleSelect: () => void;
  onFocus: () => void;
}) {
  const display = deriveDeviceConnectionDisplay(device);
  const status = {
    label: DEVICE_CONNECTION_LABELS[display],
    ...displayTone[display],
  };
  if (device.status === 'error') {
    status.label = 'ERROR';
    status.color = 'text-danger';
    status.dot = 'bg-danger';
  }

  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition-colors',
        isSelected ? 'border-accent bg-accent/10' : 'border-surface-700 bg-surface-800/50 hover:border-surface-600',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Smartphone className="h-4 w-4 shrink-0 text-slate-400" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium" title={device.label}>
              {device.label}
            </p>
            <p className="truncate text-[11px] text-slate-500">{device.deviceId.slice(0, 12)}…</p>
          </div>
        </div>
        <div className={cn('flex items-center gap-1 text-[10px] font-medium uppercase', status.color)}>
          <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
          {status.label}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-400">
        {device.batteryLevel !== undefined && (
          <span className="flex items-center gap-0.5">
            <Battery className="h-3 w-3" />
            {device.batteryLevel}%
          </span>
        )}
        {device.networkType && (
          <span className="flex items-center gap-0.5">
            <Wifi className="h-3 w-3" />
            {device.networkType}
          </span>
        )}
        <span>{formatRelativeTime(device.lastSeenAt)}</span>
      </div>

      <div className="mt-2 flex gap-1">
        <button
          type="button"
          onClick={onToggleSelect}
          className={cn(
            'flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors',
            isSelected
              ? 'bg-accent text-white'
              : 'bg-surface-700 text-slate-300 hover:bg-surface-600',
          )}
        >
          {isSelected ? 'In Grid' : 'Add to Grid'}
        </button>
        <button
          type="button"
          onClick={onFocus}
          className="rounded bg-surface-700 px-2 py-1 text-slate-300 hover:bg-surface-600"
          title="Focus camera"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function DeviceSidebar({
  devices,
  selectedStreamIds,
  isConnected,
  signalingConnected,
  onToggleSelect,
  onFocus,
  onReconnect,
}: DeviceSidebarProps) {
  const liveCount = devices.filter((d) => d.status === 'live').length;

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-surface-700 bg-surface-900">
      <div className="border-b border-surface-700 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide text-slate-200">Devices</h2>
          <button
            type="button"
            onClick={onReconnect}
            className="rounded p-1 text-slate-400 hover:bg-surface-700 hover:text-white"
            title="Reconnect presence"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-1.5 text-[11px]">
          <div className="flex items-center gap-2">
            <Circle className={cn('h-2 w-2 fill-current', isConnected ? 'text-live' : 'text-danger')} />
            <span className="text-slate-400">
              Presence: {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Signal className={cn('h-3 w-3', signalingConnected ? 'text-live' : 'text-slate-500')} />
            <span className="text-slate-400">
              Signaling: {signalingConnected ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        <div className="mt-3 flex gap-3 text-xs">
          <span>
            <span className="font-semibold text-live">{liveCount}</span>
            <span className="text-slate-500"> live</span>
          </span>
          <span>
            <span className="font-semibold text-slate-300">{devices.length}</span>
            <span className="text-slate-500"> total</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {devices.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-500">
            No devices detected. Mobile clients join the session channel{' '}
            <code className="rounded bg-surface-800 px-1">cloudcast-&#123;session_id&#125;</code>.
          </p>
        ) : (
          devices.map((device) => (
            <DeviceCard
              key={device.deviceId}
              device={device}
              isSelected={selectedStreamIds.includes(device.deviceId)}
              onToggleSelect={() => onToggleSelect(device.deviceId)}
              onFocus={() => onFocus(device.deviceId)}
            />
          ))
        )}
      </div>
    </aside>
  );
}
