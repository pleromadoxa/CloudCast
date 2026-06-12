import { CameraOff } from 'lucide-react';
import type { Device, OverlayType, StreamQuality } from '../../types/device';
import type { ViewMode } from '../../types/controls';
import { GRID_LAYOUTS } from '../../lib/constants';
import { cn } from '../../lib/utils';
import { VideoTile } from './VideoTile';

interface CameraGridProps {
  devices: Device[];
  viewMode: ViewMode;
  focusedDeviceId: string | null;
  showOfflineTiles: boolean;
  allDevices: Device[];
  getOverlay: (deviceId: string) => OverlayType;
  getQuality: (deviceId: string) => StreamQuality;
  audioMuted: boolean;
  onFocusDevice: (deviceId: string) => void;
}

function resolveGridClass(count: number): string {
  if (count <= 1) return GRID_LAYOUTS[1];
  if (count === 2) return GRID_LAYOUTS[2];
  if (count <= 4) return GRID_LAYOUTS[4];
  if (count <= 6) return GRID_LAYOUTS[6];
  return GRID_LAYOUTS[9];
}

export function CameraGrid({
  devices,
  viewMode,
  focusedDeviceId,
  showOfflineTiles,
  allDevices,
  getOverlay,
  getQuality,
  audioMuted,
  onFocusDevice,
}: CameraGridProps) {
  const offlineDevices = showOfflineTiles
    ? allDevices.filter((d) => d.status === 'offline' && !devices.some((g) => g.deviceId === d.deviceId))
    : [];

  const gridDevices = [...devices, ...offlineDevices];

  if (gridDevices.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-500">
        <CameraOff className="h-12 w-12" />
        <p className="text-lg font-medium">No active streams</p>
        <p className="text-sm">Waiting for mobile clients to join the presence channel…</p>
      </div>
    );
  }

  if (viewMode === 'single' && focusedDeviceId) {
    const device = gridDevices.find((d) => d.deviceId === focusedDeviceId) ?? gridDevices[0];
    return (
      <div className="flex flex-1 p-4">
        <VideoTile
          device={device}
          overlay={getOverlay(device.deviceId)}
          quality={getQuality(device.deviceId)}
          audioMuted={audioMuted}
          isFocused
        />
      </div>
    );
  }

  if (viewMode === 'focus' && focusedDeviceId) {
    const focused = gridDevices.find((d) => d.deviceId === focusedDeviceId) ?? gridDevices[0];
    const others = gridDevices.filter((d) => d.deviceId !== focused.deviceId);

    return (
      <div className="flex flex-1 flex-col gap-3 p-4">
        <VideoTile
          device={focused}
          overlay={getOverlay(focused.deviceId)}
          quality={getQuality(focused.deviceId)}
          audioMuted={audioMuted}
          isFocused
        />
        {others.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {others.map((d) => (
              <VideoTile
                key={d.deviceId}
                device={d}
                overlay={getOverlay(d.deviceId)}
                quality={getQuality(d.deviceId)}
                audioMuted={audioMuted}
                onFocus={() => onFocusDevice(d.deviceId)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('grid flex-1 gap-3 p-4 auto-rows-fr', resolveGridClass(gridDevices.length))}>
      {gridDevices.map((device) => (
        <VideoTile
          key={device.deviceId}
          device={device}
          overlay={getOverlay(device.deviceId)}
          quality={getQuality(device.deviceId)}
          audioMuted={audioMuted}
          isFocused={device.deviceId === focusedDeviceId}
          onFocus={() => onFocusDevice(device.deviceId)}
        />
      ))}
    </div>
  );
}
