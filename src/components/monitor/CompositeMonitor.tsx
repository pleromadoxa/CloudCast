import { useState } from 'react';
import type { Device, OverlayType, StreamQuality } from '../../types/device';
import { ChromaKeyLayer } from '../overlays/ChromaKeyLayer';
import type { KeySettings, LayerSettings, OutputMode, PipSettings, TransitionType, VideoAspectRatio } from '../../types/mixer';
import { PIP_SIZE_MAP } from '../../types/mixer';
import { cn } from '../../lib/utils';
import { StreamPlayer } from '../stream/StreamPlayer';
import { VideoOverlay } from '../overlays/VideoOverlay';
import { AspectRatioFrame } from './AspectRatioFrame';
import type { LayerStackId } from '../mixer/panels/layers/layerStackTypes';

interface CompositeMonitorProps {
  label: 'PST' | 'PGM';
  device: Device | null;
  subDevice?: Device | null;
  /** During transition: outgoing PGM source */
  fromDevice?: Device | null;
  /** During transition: incoming PST source */
  toDevice?: Device | null;
  transitionProgress?: number;
  transitionType?: TransitionType;
  fadeToBlackLevel?: number;
  outputMode?: OutputMode;
  pip: PipSettings;
  keySettings: KeySettings;
  layers: LayerSettings;
  overlay: OverlayType;
  quality: StreamQuality;
  audioMuted: boolean;
  volume?: number;
  isOnAir?: boolean;
  showClock?: boolean;
  aspectRatio?: VideoAspectRatio;
  /** When true (PST), show staged graphics including placeholders while editing. */
  stagingPreview?: boolean;
  highlightLayerId?: LayerStackId | null;
  highlightLayerLabel?: string;
  graphicsDragEnabled?: boolean;
  onPatchLayers?: (partial: Partial<LayerSettings>) => void;
  audioDeviceId?: string | null;
  onPgmVideoRef?: (el: HTMLVideoElement | null) => void;
  onPgmPlaybackStream?: (stream: MediaStream | null) => void;
  onPgmOutputRef?: (el: HTMLDivElement | null) => void;
  /** When set, PST monitor must not route the same feed to speakers (PGM bus owns it). */
  pgmDeviceId?: string | null;
  /** Borderless fullscreen layout for external program output window. */
  cleanOutput?: boolean;
  /** Render video content only — parent supplies monitor chrome and aspect frame. */
  embedded?: boolean;
}

const pipPositionClasses: Record<PipSettings['position'], string> = {
  'top-left': 'left-2 top-8',
  'top-right': 'right-2 top-8',
  'bottom-left': 'bottom-8 left-2',
  'bottom-right': 'bottom-8 right-2',
  center: 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
};

const SILENT_PLAYER = {
  enableSpeakerPlayback: false,
  audioMuted: true,
  volume: 0,
} as const;

function TransitionBlend({
  fromDevice,
  toDevice,
  progress,
  type,
  overlay,
  quality,
  audioMuted,
  volume,
  audioDeviceId = null,
  onBusPlaybackStream,
  onPgmVideoRef,
}: {
  fromDevice: Device | null;
  toDevice: Device | null;
  progress: number;
  type: TransitionType;
  overlay: OverlayType;
  quality: StreamQuality;
  audioMuted: boolean;
  volume: number;
  audioDeviceId?: string | null;
  onBusPlaybackStream?: (stream: MediaStream | null) => void;
  onPgmVideoRef?: (el: HTMLVideoElement | null) => void;
}) {
  const p = progress / 100;
  const busDevice = p >= 0.5 ? toDevice : fromDevice;

  const pgmBusPlayer = onBusPlaybackStream ? (
    <StreamPlayer
      device={busDevice}
      audioDeviceId={audioDeviceId}
      overlay={overlay}
      quality={quality}
      audioMuted={audioMuted}
      volume={volume}
      showLabel={false}
      enableSpeakerPlayback={false}
      className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0"
      onVideoRef={onPgmVideoRef}
      onBusPlaybackStream={onBusPlaybackStream}
    />
  ) : null;

  if (type === 'wipe') {
    return (
      <div className="absolute inset-0">
        <StreamPlayer
          device={fromDevice}
          overlay={overlay}
          quality={quality}
          showLabel={false}
          className="absolute inset-0"
          {...SILENT_PLAYER}
        />
        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - p * 100}% 0 0)` }}>
          <StreamPlayer
            device={toDevice}
            overlay={overlay}
            quality={quality}
            showLabel={false}
            className="absolute inset-0"
            {...SILENT_PLAYER}
          />
        </div>
        {pgmBusPlayer}
      </div>
    );
  }

  if (type === 'dip') {
    return (
      <div className="absolute inset-0">
        <StreamPlayer
          device={fromDevice}
          overlay={overlay}
          quality={quality}
          showLabel={false}
          className="absolute inset-0"
          style={{ opacity: p < 0.5 ? 1 - p * 2 : 0 }}
          {...SILENT_PLAYER}
        />
        <div className="absolute inset-0 bg-black" style={{ opacity: p < 0.5 ? p * 2 : 2 - p * 2 }} />
        <StreamPlayer
          device={toDevice}
          overlay={overlay}
          quality={quality}
          showLabel={false}
          className="absolute inset-0"
          style={{ opacity: p < 0.5 ? 0 : (p - 0.5) * 2 }}
          {...SILENT_PLAYER}
        />
        {pgmBusPlayer}
      </div>
    );
  }

  // mix / fade — video crossfades only; one PGM bus stream avoids double monitor output (crackle).
  return (
    <div className="absolute inset-0">
      <StreamPlayer
        device={fromDevice}
        overlay={overlay}
        quality={quality}
        showLabel={false}
        className="absolute inset-0"
        style={{ opacity: 1 - p }}
        {...SILENT_PLAYER}
      />
      <StreamPlayer
        device={toDevice}
        overlay={overlay}
        quality={quality}
        showLabel={false}
        className="absolute inset-0"
        style={{ opacity: p }}
        {...SILENT_PLAYER}
      />
      {pgmBusPlayer}
    </div>
  );
}

export function CompositeMonitor({
  label,
  device,
  subDevice,
  fromDevice,
  toDevice,
  transitionProgress = 0,
  transitionType = 'mix',
  fadeToBlackLevel = 0,
  outputMode = 'main',
  pip,
  keySettings,
  layers,
  overlay,
  quality,
  audioMuted,
  volume = 1,
  isOnAir,
  showClock = true,
  aspectRatio = '16:9',
  stagingPreview = false,
  highlightLayerId = null,
  highlightLayerLabel = '',
  graphicsDragEnabled = false,
  onPatchLayers,
  audioDeviceId = null,
  onPgmVideoRef,
  onPgmPlaybackStream,
  onPgmOutputRef,
  pgmDeviceId = null,
  cleanOutput = false,
  embedded = false,
}: CompositeMonitorProps) {
  const sameAsPgm = Boolean(device && pgmDeviceId && device.deviceId === pgmDeviceId);
  const isPgm = label === 'PGM';
  const showPip =
    outputMode === 'pip' && subDevice && device && subDevice.deviceId !== device.deviceId;
  const keyFillReady =
    keySettings.fillSource === 'preset' || Boolean(subDevice);
  const showKey = outputMode === 'key' && keySettings.enabled && device && keyFillReady;
  const isTransitioning = isPgm && transitionProgress > 0 && fromDevice && toDevice && fromDevice.deviceId !== toDevice.deviceId;
  const pipSize = PIP_SIZE_MAP[pip.size];
  const [keyMainVideo, setKeyMainVideo] = useState<HTMLVideoElement | null>(null);
  const [keyFillVideo, setKeyFillVideo] = useState<HTMLVideoElement | null>(null);

  const handleVideoRef = (el: HTMLVideoElement | null) => {
    if (isPgm) onPgmVideoRef?.(el);
  };

  const handleBusPlaybackStream = (stream: MediaStream | null) => {
    if (isPgm) onPgmPlaybackStream?.(stream);
  };

  const monitorBody = (
    <div
      ref={isPgm ? onPgmOutputRef : undefined}
      data-pgm-output={isPgm ? 'true' : undefined}
      className="relative h-full w-full"
    >
            {isTransitioning ? (
              <TransitionBlend
                fromDevice={fromDevice}
                toDevice={toDevice}
                progress={transitionProgress}
                type={transitionType}
                overlay={overlay}
                quality={quality}
                audioMuted={audioMuted}
                volume={volume}
                audioDeviceId={isPgm ? audioDeviceId : null}
                onBusPlaybackStream={isPgm ? handleBusPlaybackStream : undefined}
                onPgmVideoRef={isPgm ? handleVideoRef : undefined}
              />
            ) : showKey ? (
              <>
                <div className="pointer-events-none absolute inset-0 opacity-0">
                  <StreamPlayer
                    device={device}
                    quality={quality}
                    audioMuted
                    showLabel={false}
                    className="absolute inset-0"
                    onVideoRef={setKeyMainVideo}
                    displayFeedLive={isPgm}
                  />
                  {keySettings.fillSource === 'camera' && subDevice && (
                    <StreamPlayer
                      device={subDevice}
                      quality={quality}
                      audioMuted
                      showLabel={false}
                      className="absolute inset-0"
                      onVideoRef={setKeyFillVideo}
                    />
                  )}
                </div>
                <ChromaKeyLayer
                  mainVideo={keyMainVideo}
                  keyVideo={keyFillVideo}
                  keySettings={keySettings}
                />
                {isPgm && (
                  <StreamPlayer
                    device={device}
                    quality={quality}
                    audioMuted={audioMuted}
                    volume={volume}
                    audioDeviceId={audioDeviceId}
                    showLabel={false}
                    className="pointer-events-none absolute h-0 w-0 opacity-0"
                    onVideoRef={handleVideoRef}
                    onBusPlaybackStream={handleBusPlaybackStream}
                  />
                )}
              </>
            ) : (
              <StreamPlayer
                device={device}
                overlay={overlay}
                quality={quality}
                audioMuted={audioMuted}
                volume={volume}
                audioDeviceId={isPgm ? audioDeviceId : null}
                showLabel={false}
                className="absolute inset-0"
                onVideoRef={isPgm ? handleVideoRef : undefined}
                onBusPlaybackStream={isPgm ? handleBusPlaybackStream : undefined}
                enableSpeakerPlayback={!isPgm && !sameAsPgm}
                displayFeedLive={isPgm}
              />
            )}

            {showPip && (
              <div
                className={cn('absolute z-20 overflow-hidden shadow-lg', pipPositionClasses[pip.position])}
                style={{
                  width: pipSize.w,
                  height: pipSize.h,
                  opacity: pip.opacity / 100,
                  border: pip.border ? '2px solid rgba(255,255,255,0.7)' : 'none',
                }}
              >
                <StreamPlayer device={subDevice} quality={quality} audioMuted compact showLabel />
              </div>
            )}

            <VideoOverlay
              type={overlay}
              deviceLabel={device?.label ?? ''}
              layers={layers}
              showSafeZone={layers.showSafeZone}
              showCrosshair={layers.showCrosshair}
              stagingPreview={stagingPreview}
              highlightLayerId={stagingPreview ? highlightLayerId : null}
              highlightLayerLabel={highlightLayerLabel}
              graphicsDragEnabled={graphicsDragEnabled}
              onPatchLayers={onPatchLayers}
            />

            {fadeToBlackLevel > 0 && (
              <div className="pointer-events-none absolute inset-0 z-30 bg-black" style={{ opacity: fadeToBlackLevel / 100 }} />
            )}
          </div>
  );

  if (embedded) {
    return monitorBody;
  }

  return (
    <div
      className={cn(
        'flex flex-col',
        cleanOutput ? 'h-full w-full' : 'mixer-monitor flex-1',
        !cleanOutput && isPgm && isOnAir && 'mixer-monitor-pgm',
      )}
    >
      {!cleanOutput && (
      <div className={cn('mixer-label flex items-center gap-2', isPgm ? 'mixer-label-pgm' : 'mixer-label-pst')}>
        <span>{label}</span>
        {!isPgm && stagingPreview && (
          <span className="text-[8px] font-normal text-mixer-green">+ GRAPHICS PREVIEW</span>
        )}
        {device && <span className="text-[10px] font-normal text-mixer-muted">{device.label}</span>}
        {isPgm && isOnAir && (
          <span className="inline-flex items-center gap-1 text-[10px]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mixer-red" />
            ON AIR
          </span>
        )}
        {showClock && (
          <span className="ml-auto font-mono text-[10px] text-mixer-muted">
            {new Date().toLocaleTimeString()}
          </span>
        )}
      </div>
      )}

      <div className={cn('relative min-h-0', cleanOutput ? 'h-full flex-1' : 'flex-1')}>
        <AspectRatioFrame ratio={aspectRatio} className="h-full">
          {monitorBody}
        </AspectRatioFrame>
      </div>
    </div>
  );
}
