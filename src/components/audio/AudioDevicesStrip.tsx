import { Battery, Signal, Wifi } from 'lucide-react';
import type { Device } from '../../types/device';
import { isRealDevice } from '../../types/device';
import { cn } from '../../lib/utils';

function statusMeta(status: Device['status']): { tone: string; label: string } {
  if (status === 'live') return { tone: 'live', label: 'LIVE' };
  if (status === 'connecting') return { tone: 'connecting', label: 'LINK' };
  if (status === 'error') return { tone: 'error', label: 'ERR' };
  return { tone: 'offline', label: 'OFF' };
}

export function AudioDevicesStrip({
  devices,
  selectedChannel,
  channelLabels,
  onSelectChannel,
}: {
  devices: Device[];
  selectedChannel: number;
  channelLabels: Record<string, string>;
  onSelectChannel: (index: number) => void;
}) {
  const live = devices.filter(isRealDevice);

  if (live.length === 0) {
    return (
      <div className="studiolive-devices-strip studiolive-devices-strip--empty">
        <p className="text-[10px] text-sky-200/50">
          No paired inputs — share your access code with CloudCast Audio Mobile
        </p>
      </div>
    );
  }

  return (
    <div className="studiolive-devices-strip">
      {live.map((device, index) => {
        const label = channelLabels[device.deviceId] || device.label;
        const selected = selectedChannel === index;
        const meta = statusMeta(device.status);
        const slot = device.slotNumber ?? index + 1;

        return (
          <button
            key={device.deviceId}
            type="button"
            onClick={() => onSelectChannel(Math.max(0, slot - 1))}
            className={cn(
              'studiolive-device-chip',
              selected && 'studiolive-device-chip--selected',
              device.status === 'live' && 'studiolive-device-chip--live',
              device.status === 'connecting' && 'studiolive-device-chip--connecting',
            )}
          >
            <span
              className={cn('studiolive-device-chip__led', `studiolive-device-chip__led--${meta.tone}`)}
              aria-hidden
            />
            <span className="studiolive-device-chip__slot">
              {String(slot).padStart(2, '0')}
            </span>
            <span className="studiolive-device-chip__name" title={label}>
              {label}
            </span>
            <span className={cn('studiolive-device-chip__status', `studiolive-device-chip__status--${meta.tone}`)}>
              {meta.label}
            </span>
            <span className="studiolive-device-chip__meta">
              {device.batteryLevel != null && (
                <span title="Battery">
                  <Battery className="inline h-2.5 w-2.5" />
                  {device.batteryLevel}%
                </span>
              )}
              {device.networkType && (
                <span title={device.networkType}>
                  {device.networkType.toLowerCase().includes('wifi') ? (
                    <Wifi className="inline h-2.5 w-2.5" />
                  ) : (
                    <Signal className="inline h-2.5 w-2.5" />
                  )}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
