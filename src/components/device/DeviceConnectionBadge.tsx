import type { Device } from '../../types/device';
import {
  deriveDeviceConnectionDisplay,
  DEVICE_CONNECTION_LABELS,
  type DeviceConnectionDisplay,
} from '../../lib/deviceConnection';
import { cn } from '../../lib/utils';

const toneClass: Record<DeviceConnectionDisplay, string> = {
  offline: 'device-connection-badge--offline',
  pairing: 'device-connection-badge--pairing',
  connecting: 'device-connection-badge--connecting',
  connected: 'device-connection-badge--connected',
  live: 'device-connection-badge--live',
};

export function DeviceConnectionBadge({
  device,
  presenceOnline,
  hasActiveStream,
  hasVideoStream,
  compact = false,
  className,
}: {
  device: Device;
  presenceOnline?: boolean;
  hasActiveStream?: boolean;
  hasVideoStream?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const display = deriveDeviceConnectionDisplay(device, {
    presenceOnline,
    hasActiveStream,
    hasVideoStream,
  });
  const label = DEVICE_CONNECTION_LABELS[display];

  return (
    <span
      className={cn(
        'device-connection-badge',
        toneClass[display],
        compact && 'device-connection-badge--compact',
        className,
      )}
      title={label}
    >
      <span className="device-connection-badge__dot" aria-hidden />
      {label}
    </span>
  );
}

export { deriveDeviceConnectionDisplay, DEVICE_CONNECTION_LABELS };
