import { useCallback, useEffect, useRef } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useWhepStream } from '../../hooks/useWhepStream';
import { useIpCameraStream } from '../../hooks/useIpCameraStream';
import { useMeshStream } from '../../hooks/useMeshStream';
import { useCloudCast } from '../../context/CloudCastContext';
import { isMeshStreamActive } from '../../lib/deviceConnection';
import type { Device, OverlayType, StreamQuality } from '../../types/device';
import { isRealDevice } from '../../types/device';
import { isIpCameraDevice } from '../../lib/ipCameraDevice';
import { isDisplayFeedDevice } from '../../lib/displayFeedDevice';
import { isPrismFeedDevice } from '../../lib/prismFeedDevice';
import { detectIpStreamKind } from '../../lib/ipCameraUrl';
import { DisplayFeedPlayer } from '../display/DisplayFeedPlayer';
import { PrismFeedPlayer } from '../prism/PrismFeedPlayer';
import { cn } from '../../lib/utils';
import { ensureAudioOutputReady } from '../../lib/audioOutput';
import { useStreamSpeakerPlayback } from '../../hooks/useStreamSpeakerPlayback';
import { SignalPlaceholder } from './SignalPlaceholder';
import { VideoOverlay } from '../overlays/VideoOverlay';

interface StreamPlayerProps {
  device: Device | null;
  overlay?: OverlayType;
  quality?: StreamQuality;
  audioMuted?: boolean;
  volume?: number;
  className?: string;
  style?: React.CSSProperties;
  compact?: boolean;
  showLabel?: boolean;
  labelOverride?: string;
  /** Optional: route audio from a different paired device (USB / capture card). */
  audioDeviceId?: string | null;
  onVideoRef?: (el: HTMLVideoElement | null) => void;
  /** Element actually outputting audio (main video or linked-audio hidden video). */
  onAudibleRef?: (el: HTMLVideoElement | null) => void;
  /** PGM bus: report the stream wired to program audio (meters + Web Audio output). */
  onBusPlaybackStream?: (stream: MediaStream | null) => void;
  /** Play monitor audio through speakers (off for compact/thumbnail players). */
  enableSpeakerPlayback?: boolean;
  /** Display Feed: false = preview slide, true = live output (default true). */
  displayFeedLive?: boolean;
}

export function StreamPlayer({
  device,
  overlay = 'none',
  quality = 'auto',
  audioMuted = true,
  volume = 1,
  className,
  style,
  compact = false,
  showLabel = true,
  labelOverride,
  audioDeviceId = null,
  onVideoRef,
  onAudibleRef,
  onBusPlaybackStream,
  enableSpeakerPlayback = true,
  displayFeedLive = true,
}: StreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audibleRef = useRef<HTMLVideoElement>(null);
  const { connectionMode, devices, getMeshStream } = useCloudCast();
  const useMesh = connectionMode === 'mesh' && !(device && isIpCameraDevice(device));
  const isIpCam = Boolean(device && isIpCameraDevice(device));
  const ipStreamKind = isIpCam && device?.whepUrl ? detectIpStreamKind(device.whepUrl) : null;
  const meshFeed =
    useMesh && device && isRealDevice(device) ? getMeshStream(device.deviceId) : null;
  const hasMeshFeed = isMeshStreamActive(meshFeed);
  const usesRegalVideo = !useMesh && !isIpCam;
  const regalWhepReady = usesRegalVideo && Boolean(device?.whepUrl?.trim());
  const regalAwaitingWhep = usesRegalVideo && device?.status === 'live' && !regalWhepReady;
  const channelSessionActive = Boolean(
    device &&
      isRealDevice(device) &&
      (device.status === 'live' || device.status === 'connecting'),
  );
  const isPairedOnline = Boolean(
    device &&
      isRealDevice(device) &&
      !hasMeshFeed &&
      !regalWhepReady &&
      device.status !== 'offline' &&
      channelSessionActive &&
      (device.status === 'connecting' ||
        device.isOnline ||
        device.connectionState === 'connected' ||
        device.connectionState === 'connecting'),
  );
  const isLinkNegotiating = Boolean(
    isPairedOnline &&
      device &&
      device.status === 'connecting' &&
      !device.isOnline &&
      device.connectionState !== 'connected',
  );
  const isStreaming = Boolean(
    device &&
      isRealDevice(device) &&
      (hasMeshFeed ||
        (isIpCam && Boolean(device.whepUrl)) ||
        (regalWhepReady && device.status === 'live')),
  );
  const whepEnabled =
    regalWhepReady &&
    (device?.status === 'live' || device?.status === 'connecting') &&
    (!isIpCam || ipStreamKind === 'whep');
  const ipCamEnabled = isIpCam && isStreaming && ipStreamKind != null && ipStreamKind !== 'whep' && ipStreamKind !== 'unsupported';
  const meshEnabled = useMesh && channelSessionActive && !isIpCam;

  const whep = useWhepStream({
    deviceId: device?.deviceId ?? 'none',
    whepUrl: device?.whepUrl ?? null,
    enabled: whepEnabled,
    quality,
  });

  const audioDevice = audioDeviceId
    ? devices.find((d) => d.deviceId === audioDeviceId) ?? null
    : null;
  const audioWhepEnabled =
    !useMesh && Boolean(audioDevice?.whepUrl) && Boolean(audioDevice && isRealDevice(audioDevice));
  const audioMeshEnabled = useMesh && Boolean(audioDevice && isRealDevice(audioDevice));

  const audioWhep = useWhepStream({
    deviceId: audioDevice?.deviceId ?? 'none-audio',
    whepUrl: audioDevice?.whepUrl ?? null,
    enabled: audioWhepEnabled && Boolean(audioDeviceId),
    quality,
  });
  const audioMesh = useMeshStream(audioDevice?.deviceId ?? 'none-audio', audioMeshEnabled && Boolean(audioDeviceId), connectionMode);

  const mesh = useMeshStream(device?.deviceId ?? 'none', meshEnabled, connectionMode);

  const ipCam = useIpCameraStream({
    url: device?.whepUrl ?? null,
    enabled: ipCamEnabled,
  });

  const stream = ipCamEnabled ? ipCam.stream : useMesh ? mesh.stream : whep.stream;
  const waitingForMeshStream = meshEnabled && !mesh.stream;
  const audioStream = audioDeviceId ? (useMesh ? audioMesh.stream : audioWhep.stream) : null;
  const playbackStream = audioStream ?? stream;
  const level = audioMuted ? 0 : Math.min(1, Math.max(0, volume));
  const isMonitorPlayback = !onAudibleRef && !onBusPlaybackStream && enableSpeakerPlayback;
  useStreamSpeakerPlayback(playbackStream, isMonitorPlayback, level);

  const bindAudibleElement = useCallback(
    (el: HTMLVideoElement | null) => {
      audibleRef.current = el;
      onAudibleRef?.(el);
      if (!el) return;

      el.srcObject = playbackStream;
      // PGM bus: always muted on the element — Web Audio gain handles output (prevents double playback crackle).
      el.muted = true;
      el.volume = 1;
      if (playbackStream) {
        void ensureAudioOutputReady().then(() => el.play().catch(() => undefined));
      }
    },
    [onAudibleRef, playbackStream],
  );

  useEffect(() => {
    const el = audibleRef.current;
    if (!onAudibleRef || !el) return;
    el.srcObject = playbackStream;
    if (playbackStream) {
      void ensureAudioOutputReady().then(() => el.play().catch(() => undefined));
    }
  }, [onAudibleRef, playbackStream]);

  useEffect(() => {
    if (!onBusPlaybackStream) return;
    onBusPlaybackStream(playbackStream);
    return () => onBusPlaybackStream(null);
  }, [onBusPlaybackStream, playbackStream]);
  const connectionState = ipCamEnabled ? ipCam.connectionState : useMesh ? mesh.connectionState : whep.connectionState;
  const error = ipCamEnabled ? ipCam.error : useMesh ? null : whep.error;
  const reconnect = ipCamEnabled ? ipCam.reconnect : whep.reconnect;

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = stream;
    if (!stream) return;

    const playLive = () => {
      void el.play().catch(() => undefined);
    };

    playLive();
    stream.getTracks().forEach((track) => {
      track.onunmute = playLive;
    });
  }, [stream]);

  useEffect(() => {
    onVideoRef?.(videoRef.current);
    return () => onVideoRef?.(null);
  }, [onVideoRef, stream]);

  if (!device) {
    return (
      <div className={cn('relative h-full w-full overflow-hidden bg-black', className)} style={style}>
        <SignalPlaceholder variant="no-signal" compact={compact} />
      </div>
    );
  }

  if (isDisplayFeedDevice(device)) {
    return (
      <div className={cn('relative h-full w-full overflow-hidden bg-black', className)} style={style}>
        <DisplayFeedPlayer live={displayFeedLive} compact={compact} showLabel={showLabel} />
      </div>
    );
  }

  if (isPrismFeedDevice(device)) {
    return (
      <div className={cn('relative h-full w-full overflow-hidden bg-black', className)} style={style}>
        <PrismFeedPlayer compact={compact} showLabel={showLabel} />
      </div>
    );
  }

  const showOffline =
    !isStreaming &&
    !isPairedOnline &&
    !regalAwaitingWhep &&
    ((!isIpCam && !useMesh && !device.whepUrl && device.status === 'offline') ||
      (isIpCam && !device.whepUrl) ||
      (useMesh && !stream && device.status === 'offline'));

  return (
    <div className={cn('relative h-full w-full overflow-hidden bg-black', className)} style={style}>
      {showLabel && (
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 to-transparent px-2 py-1">
          <span className={cn('font-bold tracking-wide text-white', compact ? 'text-[9px]' : 'text-xs')}>
            {labelOverride ?? device.label}
          </span>
        </div>
      )}

      {isPairedOnline && !isStreaming ? (
        <div
          className={cn(
            'flex h-full flex-col items-center justify-center gap-1',
            isLinkNegotiating ? 'text-mixer-muted' : 'text-mixer-green',
          )}
        >
          {isLinkNegotiating ? (
            <>
              <Loader2 className={cn('animate-spin', compact ? 'h-4 w-4' : 'h-6 w-6')} />
              {!compact && <span className="text-[10px] tracking-wide">Connecting…</span>}
            </>
          ) : (
            <>
              <span className={cn('font-bold tracking-wider', compact ? 'text-[8px]' : 'text-xs')}>
                CONNECTED
              </span>
              {!compact && <span className="text-[10px] text-mixer-muted">Waiting for Go Live</span>}
            </>
          )}
        </div>
      ) : showOffline ? (
        <SignalPlaceholder variant="offline" compact={compact} />
      ) : regalAwaitingWhep ||
        waitingForMeshStream ||
        (!useMesh && (connectionState === 'connecting' || connectionState === 'reconnecting')) ? (
        <div className="flex h-full flex-col items-center justify-center gap-1 text-mixer-muted">
          <Loader2 className={cn('animate-spin', compact ? 'h-4 w-4' : 'h-8 w-8')} />
          {!compact && connectionState === 'reconnecting' && (
            <span className="text-[10px] text-mixer-green">Reconnecting Regal Cloud…</span>
          )}
        </div>
      ) : error ? (
        <div className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center">
          <AlertCircle className={cn('text-mixer-red', compact ? 'h-4 w-4' : 'h-6 w-6')} />
          {!compact && (
            <button
              type="button"
              onClick={reconnect}
              className="mixer-btn px-2 py-0.5 text-[10px]"
            >
              RETRY
            </button>
          )}
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
            onLoadedMetadata={(e) => {
              void e.currentTarget.play().catch(() => undefined);
            }}
            onCanPlay={(e) => {
              void e.currentTarget.play().catch(() => undefined);
            }}
          />
          {onAudibleRef && playbackStream && (
            <video
              ref={bindAudibleElement}
              autoPlay
              playsInline
              muted
              className="pointer-events-none absolute h-px w-px opacity-0"
            />
          )}
          {!compact && <VideoOverlay type={overlay} deviceLabel={device.label} />}
        </>
      )}
    </div>
  );
}
