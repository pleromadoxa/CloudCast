import type { Device, OverlayType, StreamQuality } from '../../types/device';
import type { OutputMode, PipPosition } from '../../types/mixer';
import { cn } from '../../lib/utils';
import { StreamPlayer } from '../stream/StreamPlayer';

interface MonitorViewportProps {
  label: 'PST' | 'PGM';
  device: Device | null;
  subDevice?: Device | null;
  outputMode?: OutputMode;
  pipPosition?: PipPosition;
  overlay: OverlayType;
  quality: StreamQuality;
  audioMuted: boolean;
  isOnAir?: boolean;
}

const pipPositionClasses: Record<PipPosition, string> = {
  'top-left': 'left-2 top-8',
  'top-right': 'right-2 top-8',
  'bottom-left': 'bottom-8 left-2',
  'bottom-right': 'bottom-8 right-2',
  center: 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
};

export function MonitorViewport({
  label,
  device,
  subDevice,
  outputMode = 'main',
  pipPosition = 'bottom-right',
  overlay,
  quality,
  audioMuted,
  isOnAir,
}: MonitorViewportProps) {
  const isPgm = label === 'PGM';
  const showPip =
    outputMode === 'pip' && subDevice && device && subDevice.deviceId !== device.deviceId;

  return (
    <div
      className={cn(
        'mixer-monitor flex flex-1 flex-col',
        isPgm && isOnAir && 'mixer-monitor-pgm',
      )}
    >
      <div className={cn('mixer-label', isPgm ? 'mixer-label-pgm' : 'mixer-label-pst')}>
        {label}
        {isPgm && isOnAir && (
          <span className="ml-2 inline-flex items-center gap-1 text-[10px]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mixer-red" />
            ON AIR
          </span>
        )}
      </div>

      <div className="relative flex-1">
        <StreamPlayer
          device={device}
          overlay={overlay}
          quality={quality}
          audioMuted={audioMuted || !isPgm}
          showLabel={false}
          className="absolute inset-0"
        />

        {showPip && (
          <div
            className={cn(
              'absolute z-20 h-[28%] w-[35%] overflow-hidden border-2 border-white/60 shadow-lg',
              pipPositionClasses[pipPosition],
            )}
          >
            <StreamPlayer
              device={subDevice}
              quality={quality}
              audioMuted
              compact
              showLabel
            />
          </div>
        )}

        {outputMode === 'key' && subDevice && (
          <div className="pointer-events-none absolute inset-0 z-10 border-2 border-dashed border-mixer-green/50" />
        )}
      </div>
    </div>
  );
}
