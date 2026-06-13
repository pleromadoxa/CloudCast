import { Mic, MicOff } from 'lucide-react';
import type { Device, OverlayType, StreamQuality } from '../../types/device';
import type { VideoAspectRatio } from '../../types/mixer';
import { isRealDevice, isVideoDevice } from '../../types/device';
import { ASPECT_RATIO_CSS } from '../../lib/aspectRatio';
import { cn } from '../../lib/utils';
import { StreamPlayer } from '../stream/StreamPlayer';

interface SourceStripProps {
  devices: Device[];
  pstDeviceId: string | null;
  pgmDeviceId: string | null;
  getQuality: (id: string) => StreamQuality;
  getOverlay: (id: string) => OverlayType;
  isViewAudioMuted: (deviceId: string) => boolean;
  onToggleViewAudioMute: (deviceId: string) => void;
  getMonitorVolume: (deviceId: string) => number;
  getMonitorAudioDeviceId: (deviceId: string) => string | null;
  aspectRatio?: VideoAspectRatio;
  onSelectSource: (deviceId: string) => void;
  onCutToSource?: (deviceId: string) => void;
}

export function SourceStrip({
  devices,
  pstDeviceId,
  pgmDeviceId,
  getQuality,
  getOverlay,
  isViewAudioMuted,
  onToggleViewAudioMute,
  getMonitorVolume,
  getMonitorAudioDeviceId,
  aspectRatio = '16:9',
  onSelectSource,
  onCutToSource,
}: SourceStripProps) {
  const slotCount = Math.max(devices.length, 2);
  const slots = Array.from({ length: slotCount }, (_, i) => devices[i] ?? null);

  return (
    <div className="source-strip-area border-t border-mixer-border bg-mixer-panel">
      <div className="source-strip flex gap-1 overflow-x-auto px-2 py-1.5">
      {slots.map((device, index) => {
        const isPst = device && device.deviceId === pstDeviceId;
        const isPgm = device && device.deviceId === pgmDeviceId;
        const inputLabel = device ? device.label : `INPUT ${index + 1}`;
        const viewMuted = device && isRealDevice(device) ? isViewAudioMuted(device.deviceId) : true;
        const monitorVol = device && isRealDevice(device) ? getMonitorVolume(device.deviceId) : 0;
        const monitorAudioId =
          device && isRealDevice(device) ? getMonitorAudioDeviceId(device.deviceId) : null;

        return (
          <div
            key={device?.deviceId ?? `empty-${index}`}
            className={cn(
              'group relative flex-1 overflow-hidden border-2 transition-all',
              device && isRealDevice(device) ? 'border-mixer-border hover:border-mixer-border-light' : 'opacity-40',
              isPst && 'border-mixer-green',
              isPgm && 'border-mixer-red',
            )}
            style={{ aspectRatio: ASPECT_RATIO_CSS[aspectRatio], maxHeight: 64, minHeight: 48 }}
          >
            <button
              type="button"
              disabled={!device || !isRealDevice(device)}
              onClick={() => device && isRealDevice(device) && onSelectSource(device.deviceId)}
              onDoubleClick={() => device && isRealDevice(device) && onCutToSource?.(device.deviceId)}
              className={cn(
                'absolute inset-0',
                device && isRealDevice(device) ? 'cursor-pointer' : 'cursor-default',
              )}
            >
              {device ? (
                <StreamPlayer
                  device={device}
                  overlay={getOverlay(device.deviceId)}
                  quality={getQuality(device.deviceId)}
                  audioMuted={monitorVol === 0}
                  volume={monitorVol}
                  audioDeviceId={monitorAudioId}
                  enableSpeakerPlayback={Boolean(isPst && device.deviceId !== pgmDeviceId)}
                  compact
                  showLabel={false}
                  className="h-full"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-black text-[9px] text-mixer-muted">
                  —
                </div>
              )}
            </button>

            {device && isVideoDevice(device) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleViewAudioMute(device.deviceId);
                }}
                className={cn(
                  'absolute right-0.5 top-0.5 z-10 mixer-btn p-0.5 opacity-0 transition-opacity group-hover:opacity-100',
                  !viewMuted && 'opacity-100 mixer-btn-active',
                )}
                title={viewMuted ? 'Unmute monitor (local only)' : 'Mute monitor (local only)'}
              >
                {viewMuted ? <MicOff className="h-2.5 w-2.5" /> : <Mic className="h-2.5 w-2.5" />}
              </button>
            )}

            <div
              className={cn(
                'pointer-events-none absolute bottom-0 left-0 right-0 px-1 py-0.5 text-center text-[8px] font-bold tracking-wider',
                isPst ? 'bg-mixer-green text-black' : isPgm ? 'bg-mixer-red text-white' : 'bg-black/80 text-mixer-muted',
              )}
              title={device?.label}
            >
              <span className="block truncate">{inputLabel.toUpperCase()}</span>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
