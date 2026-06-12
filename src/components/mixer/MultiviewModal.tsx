import { Mic, MicOff, X } from 'lucide-react';
import type { Device, StreamQuality } from '../../types/device';
import type { VideoAspectRatio } from '../../types/mixer';
import { isRealDevice, isVideoDevice } from '../../types/device';
import { ASPECT_RATIO_CSS } from '../../lib/aspectRatio';
import { cn } from '../../lib/utils';
import { StreamPlayer } from '../stream/StreamPlayer';

interface MultiviewModalProps {
  devices: Device[];
  pstDeviceId: string | null;
  pgmDeviceId: string | null;
  getQuality: (id: string) => StreamQuality;
  isViewAudioMuted: (deviceId: string) => boolean;
  onToggleViewAudioMute: (deviceId: string) => void;
  getMonitorVolume: (deviceId: string) => number;
  getMonitorAudioDeviceId: (deviceId: string) => string | null;
  aspectRatio?: VideoAspectRatio;
  deviceLimit?: number;
  onSelect: (deviceId: string) => void;
  onClose: () => void;
}

export function MultiviewModal({
  devices,
  pstDeviceId,
  pgmDeviceId,
  getQuality,
  isViewAudioMuted,
  onToggleViewAudioMute,
  getMonitorVolume,
  getMonitorAudioDeviceId,
  aspectRatio = '16:9',
  deviceLimit,
  onSelect,
  onClose,
}: MultiviewModalProps) {
  const label = deviceLimit ? `MULTIVIEW — ${deviceLimit} UP` : 'MULTIVIEW';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="flex max-h-full w-full max-w-5xl flex-col rounded border border-mixer-border bg-mixer-panel">
        <div className="flex items-center justify-between border-b border-mixer-border px-4 py-2">
          <span className="text-sm font-bold tracking-wider">{label}</span>
          <button type="button" onClick={onClose} className="mixer-btn p-1"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-4 gap-1 p-2">
          {devices.map((d, i) => {
            const viewMuted = isRealDevice(d) ? isViewAudioMuted(d.deviceId) : true;
            const monitorVol = isRealDevice(d) ? getMonitorVolume(d.deviceId) : 0;
            const monitorAudioId = isRealDevice(d) ? getMonitorAudioDeviceId(d.deviceId) : null;
            return (
              <div
                key={d.deviceId}
                className="group relative overflow-hidden border border-mixer-border hover:border-mixer-red"
                style={{ aspectRatio: ASPECT_RATIO_CSS[aspectRatio] }}
              >
                <button
                  type="button"
                  disabled={!isRealDevice(d)}
                  onClick={() => isRealDevice(d) && onSelect(d.deviceId)}
                  className="absolute inset-0 disabled:opacity-30"
                >
                  <StreamPlayer
                    device={isRealDevice(d) ? d : null}
                    quality={getQuality(d.deviceId)}
                    audioMuted={monitorVol === 0}
                    volume={monitorVol}
                    audioDeviceId={monitorAudioId}
                    enableSpeakerPlayback
                    compact
                    showLabel={false}
                  />
                </button>
                {isVideoDevice(d) && (
                  <button
                    type="button"
                    onClick={() => onToggleViewAudioMute(d.deviceId)}
                    className={cn(
                      'absolute right-1 top-1 z-10 mixer-btn p-0.5',
                      !viewMuted && 'mixer-btn-active',
                    )}
                  >
                    {viewMuted ? <MicOff className="h-2.5 w-2.5" /> : <Mic className="h-2.5 w-2.5" />}
                  </button>
                )}
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex justify-between bg-black/70 px-1 py-0.5 text-[9px]">
                  <span>{i + 1}. {d.label}</span>
                  {d.deviceId === pgmDeviceId && <span className="text-mixer-red">PGM</span>}
                  {d.deviceId === pstDeviceId && <span className="text-mixer-green">PST</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
