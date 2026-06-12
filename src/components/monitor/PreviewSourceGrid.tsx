import { Mic, MicOff } from 'lucide-react';
import type { Device, OverlayType, StreamQuality } from '../../types/device';
import { isRealDevice, isVideoDevice } from '../../types/device';
import type { ViewMode } from '../../types/controls';
import { unlockDashboardAudio } from '../../lib/audioOutput';
import { previewGridStyle } from '../../lib/previewGridLayout';
import { cn } from '../../lib/utils';
import { StreamPlayer } from '../stream/StreamPlayer';

interface PreviewSourceGridProps {
  devices: Device[];
  slotCount: number;
  pstDeviceId: string | null;
  pgmDeviceId: string | null;
  viewMode: ViewMode;
  getQuality: (id: string) => StreamQuality;
  getOverlay: (id: string) => OverlayType;
  isViewAudioMuted: (deviceId: string) => boolean;
  onToggleViewAudioMute: (deviceId: string) => void;
  getMonitorVolume: (deviceId: string) => number;
  getMonitorAudioDeviceId: (deviceId: string) => string | null;
  onSelectSource: (deviceId: string) => void;
  onCutToSource?: (deviceId: string) => void;
}

function PreviewTile({
  device,
  index,
  isPst,
  isPgm,
  pgmDeviceId,
  getQuality,
  getOverlay,
  monitorVolume,
  monitorAudioDeviceId,
  viewMuted,
  onToggleViewAudioMute,
  onSelectSource,
  onCutToSource,
  className,
}: {
  device: Device | null;
  index: number;
  isPst: boolean;
  isPgm: boolean;
  pgmDeviceId: string | null;
  getQuality: (id: string) => StreamQuality;
  getOverlay: (id: string) => OverlayType;
  monitorVolume: number;
  monitorAudioDeviceId: string | null;
  viewMuted: boolean;
  onToggleViewAudioMute: (deviceId: string) => void;
  onSelectSource: (deviceId: string) => void;
  onCutToSource?: (deviceId: string) => void;
  className?: string;
}) {
  const ready = device && isRealDevice(device);
  const label = device ? device.label : `INPUT ${index + 1}`;

  return (
    <div
      className={cn(
        'group relative min-h-0 min-w-0 overflow-hidden border-2 bg-black transition-colors',
        ready ? 'border-mixer-border hover:border-mixer-border-light' : 'border-mixer-border/40 opacity-50',
        isPst && 'border-mixer-green shadow-[inset_0_0_0_1px_#00c864]',
        isPgm && !isPst && 'border-mixer-red',
        className,
      )}
    >
      <button
        type="button"
        disabled={!ready}
        onClick={() => device && onSelectSource(device.deviceId)}
        onDoubleClick={() => device && ready && onCutToSource?.(device.deviceId)}
        className={cn('absolute inset-0', ready ? 'cursor-pointer' : 'cursor-default')}
        title={device ? `${device.label} — click preview · dbl-click cut` : 'Empty input'}
      >
        {ready ? (
          <StreamPlayer
            device={device}
            overlay={getOverlay(device.deviceId)}
            quality={getQuality(device.deviceId)}
            audioMuted={monitorVolume === 0}
            volume={monitorVolume}
            audioDeviceId={monitorAudioDeviceId}
            enableSpeakerPlayback={isPst && device.deviceId !== pgmDeviceId && !isPgm}
            compact
            showLabel={false}
            className="h-full w-full"
          />
        ) : (
          <StreamPlayer device={null} compact showLabel={false} className="h-full w-full" />
        )}
      </button>

      {device && isVideoDevice(device) && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void unlockDashboardAudio();
            onToggleViewAudioMute(device.deviceId);
          }}
          className={cn(
            'absolute right-1 top-1 z-10 mixer-btn p-0.5 opacity-0 transition-opacity group-hover:opacity-100',
            !viewMuted && 'opacity-100 mixer-btn-active',
          )}
          title={viewMuted ? 'Unmute monitor (local only)' : 'Mute monitor (local only)'}
        >
          {viewMuted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
        </button>
      )}

      <div
        className={cn(
          'pointer-events-none absolute bottom-0 left-0 right-0 flex items-center justify-between px-1.5 py-0.5 text-[8px] font-bold tracking-wider',
          isPst ? 'bg-mixer-green text-black' : isPgm ? 'bg-mixer-red text-white' : 'bg-black/80 text-mixer-muted',
        )}
      >
        <span className="min-w-0 truncate" title={device?.label}>
          {label.toUpperCase()}
        </span>
        <span className="flex gap-1">
          {isPst && <span>PST</span>}
          {isPgm && <span>PGM</span>}
        </span>
      </div>
    </div>
  );
}

export function PreviewSourceGrid({
  devices,
  slotCount,
  pstDeviceId,
  pgmDeviceId,
  viewMode,
  getQuality,
  getOverlay,
  isViewAudioMuted,
  onToggleViewAudioMute,
  getMonitorVolume,
  getMonitorAudioDeviceId,
  onSelectSource,
  onCutToSource,
}: PreviewSourceGridProps) {
  const slots = Array.from({ length: Math.max(slotCount, devices.length, 2) }, (_, i) => devices[i] ?? null);

  if (viewMode === 'focus' && pstDeviceId) {
    const focused = slots.find((d) => d?.deviceId === pstDeviceId) ?? slots.find((d) => d && isRealDevice(d)) ?? null;
    const others = slots.filter((d) => d?.deviceId !== focused?.deviceId);

    return (
      <div className="flex h-full min-h-0 flex-col gap-0.5 p-0.5">
        <PreviewTile
          device={focused}
          index={focused ? slots.indexOf(focused) : 0}
          isPst={Boolean(focused && focused.deviceId === pstDeviceId)}
          isPgm={Boolean(focused && focused.deviceId === pgmDeviceId)}
          pgmDeviceId={pgmDeviceId}
          getQuality={getQuality}
          getOverlay={getOverlay}
          monitorVolume={focused && isRealDevice(focused) ? getMonitorVolume(focused.deviceId) : 0}
          monitorAudioDeviceId={
            focused && isRealDevice(focused) ? getMonitorAudioDeviceId(focused.deviceId) : null
          }
          viewMuted={focused && isRealDevice(focused) ? isViewAudioMuted(focused.deviceId) : true}
          onToggleViewAudioMute={onToggleViewAudioMute}
          onSelectSource={onSelectSource}
          onCutToSource={onCutToSource}
          className="min-h-0 flex-[2]"
        />
        {others.length > 0 && (
          <div className="grid min-h-0 flex-1 grid-cols-4 gap-0.5">
            {others.map((device, i) => (
              <PreviewTile
                key={device?.deviceId ?? `focus-other-${i}`}
                device={device}
                index={i}
                isPst={Boolean(device && device.deviceId === pstDeviceId)}
                isPgm={Boolean(device && device.deviceId === pgmDeviceId)}
                pgmDeviceId={pgmDeviceId}
                getQuality={getQuality}
                getOverlay={getOverlay}
                monitorVolume={device && isRealDevice(device) ? getMonitorVolume(device.deviceId) : 0}
                monitorAudioDeviceId={
                  device && isRealDevice(device) ? getMonitorAudioDeviceId(device.deviceId) : null
                }
                viewMuted={device && isRealDevice(device) ? isViewAudioMuted(device.deviceId) : true}
                onToggleViewAudioMute={onToggleViewAudioMute}
                onSelectSource={onSelectSource}
                onCutToSource={onCutToSource}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="preview-source-grid grid h-full min-h-0 gap-0.5 p-0.5"
      style={previewGridStyle(slots.length)}
    >
      {slots.map((device, index) => (
        <PreviewTile
          key={device?.deviceId ?? `slot-${index}`}
          device={device}
          index={index}
          isPst={Boolean(device && device.deviceId === pstDeviceId)}
          isPgm={Boolean(device && device.deviceId === pgmDeviceId)}
          pgmDeviceId={pgmDeviceId}
          getQuality={getQuality}
          getOverlay={getOverlay}
          monitorVolume={device && isRealDevice(device) ? getMonitorVolume(device.deviceId) : 0}
          monitorAudioDeviceId={
            device && isRealDevice(device) ? getMonitorAudioDeviceId(device.deviceId) : null
          }
          viewMuted={device && isRealDevice(device) ? isViewAudioMuted(device.deviceId) : true}
          onToggleViewAudioMute={onToggleViewAudioMute}
          onSelectSource={onSelectSource}
          onCutToSource={onCutToSource}
        />
      ))}
    </div>
  );
}
