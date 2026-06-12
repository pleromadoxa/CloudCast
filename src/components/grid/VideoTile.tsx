import { useEffect, useRef } from 'react';
import { AlertCircle, Loader2, Radio, WifiOff } from 'lucide-react';
import { useWhepStream } from '../../hooks/useWhepStream';
import type { Device, OverlayType, StreamQuality } from '../../types/device';
import { cn } from '../../lib/utils';
import { VideoOverlay } from '../overlays/VideoOverlay';

interface VideoTileProps {
  device: Device;
  overlay: OverlayType;
  quality: StreamQuality;
  audioMuted: boolean;
  isFocused?: boolean;
  onFocus?: () => void;
}

const statusColors = {
  live: 'bg-live',
  offline: 'bg-offline',
  connecting: 'bg-warning animate-pulse',
  error: 'bg-danger',
};

export function VideoTile({
  device,
  overlay,
  quality,
  audioMuted,
  isFocused,
  onFocus,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const enabled = device.status === 'live' && Boolean(device.whepUrl);

  const { stream, connectionState, error, reconnect } = useWhepStream({
    deviceId: device.deviceId,
    whepUrl: device.whepUrl,
    enabled,
    quality,
  });

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = audioMuted;
    }
  }, [audioMuted]);

  const showOffline = device.status === 'offline' || !device.whepUrl;

  return (
    <div
      className={cn(
        'group relative flex aspect-video flex-col overflow-hidden rounded-lg border bg-surface-900',
        isFocused ? 'border-accent ring-2 ring-accent/30' : 'border-surface-700',
      )}
      onClick={onFocus}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onFocus?.()}
    >
      {/* Header bar */}
      <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-3 py-2">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', statusColors[device.status])} />
          <span className="text-xs font-medium text-white">{device.label}</span>
        </div>
        <span className="rounded bg-black/50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
          {quality}
        </span>
      </div>

      {/* Video or placeholder */}
      {showOffline ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-slate-500">
          <WifiOff className="h-8 w-8" />
          <span className="text-sm">Offline</span>
        </div>
      ) : connectionState === 'connecting' ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="text-sm">Connecting stream…</span>
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
          <AlertCircle className="h-8 w-8 text-danger" />
          <span className="text-xs text-slate-400">{error}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              reconnect();
            }}
            className="mt-1 rounded bg-surface-700 px-3 py-1 text-xs hover:bg-surface-600"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={audioMuted}
            className="h-full w-full object-cover"
          />
          <VideoOverlay type={overlay} deviceLabel={device.label} />
        </>
      )}

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-3 py-2 opacity-0 transition-opacity group-hover:opacity-100">
        <span className="flex items-center gap-1 text-[10px] text-slate-300">
          <Radio className="h-3 w-3" />
          {device.platform}
        </span>
        {device.networkType && (
          <span className="text-[10px] text-slate-400">{device.networkType}</span>
        )}
      </div>
    </div>
  );
}
