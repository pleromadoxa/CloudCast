import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Film, Image as ImageIcon, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { useMediaFeedOptional } from '../../context/MediaFeedContext';
import type { MediaFeedRole } from '../../lib/mediaFeedState';
import type { ActiveMediaFeed } from '../../types/mediaFeed';
import { cn } from '../../lib/utils';
import { useStreamSpeakerPlayback } from '../../hooks/useStreamSpeakerPlayback';
import { useOwnedVideoOutRef } from '../../lib/videoOutRef';

interface MediaFeedPlayerProps {
  feedRole: MediaFeedRole;
  compact?: boolean;
  showLabel?: boolean;
  className?: string;
  onVideoRef?: (el: HTMLVideoElement | null) => void;
  /** False on the hidden encode clone so it cannot steal PGM shot registration. */
  registerShot?: boolean;
  onBusPlaybackStream?: (stream: MediaStream | null) => void;
  enableSpeakerPlayback?: boolean;
  volume?: number;
  audioMuted?: boolean;
}

function wireVideoElement(video: HTMLVideoElement, active: ActiveMediaFeed, playing: boolean) {
  const url = active.playUrl;
  if (!url) return;

  const needsSrc = !video.currentSrc || !video.currentSrc.includes(url.split('?')[0] ?? url);
  if (needsSrc) {
    video.src = url;
    video.loop = active.loop ?? true;
    video.muted = true;
    video.playsInline = true;
    try {
      video.load();
    } catch {
      /* ignore */
    }
  }

  if (playing && video.readyState >= 2) {
    void video.play().catch(() => undefined);
  } else if (!playing) {
    video.pause();
  }
}

/** Video Mixer source player for the Media virtual input. */
export function MediaFeedPlayer({
  feedRole,
  compact = false,
  showLabel = true,
  className,
  onVideoRef,
  registerShot = true,
  onBusPlaybackStream,
  enableSpeakerPlayback = false,
  volume = 1,
  audioMuted = true,
}: MediaFeedPlayerProps) {
  const mediaFeed = useMediaFeedOptional();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { bindVideoOutRef } = useOwnedVideoOutRef(onVideoRef);

  const active = useMemo(() => {
    if (!mediaFeed) return null;
    if (feedRole === 'pst') return mediaFeed.pstMedia;
    if (feedRole === 'pgm') return mediaFeed.pgmMedia;
    if (mediaFeed.pstIsMedia) return mediaFeed.pstMedia;
    if (mediaFeed.pgmIsMedia) return mediaFeed.pgmMedia;
    return null;
  }, [mediaFeed, feedRole]);

  const transportPlaying = mediaFeed?.transport.playing ?? false;
  const transportPlayingRef = useRef(transportPlaying);
  useEffect(() => {
    transportPlayingRef.current = transportPlaying;
  }, [transportPlaying]);

  const applyActiveSource = useCallback(
    (video: HTMLVideoElement | null, playing = transportPlayingRef.current) => {
      if (!video || !active || active.kind !== 'video' || !active.playUrl) return;
      wireVideoElement(video, active, playing);
    },
    [active],
  );

  const registerShotVideoRef = useRef(mediaFeed?.registerShotVideo);
  registerShotVideoRef.current = mediaFeed?.registerShotVideo;

  const setShotVideoEl = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      if (registerShot) registerShotVideoRef.current?.(feedRole, el);
      bindVideoOutRef(el);
      applyActiveSource(el);
    },
    [feedRole, registerShot, bindVideoOutRef, applyActiveSource],
  );

  const isPreviewBus =
    feedRole === 'pst' || (feedRole === 'strip' && Boolean(mediaFeed?.pstIsMedia));
  const isProgramBus = feedRole === 'pgm' && Boolean(mediaFeed?.pgmIsMedia);

  const monitorStream = isPreviewBus
    ? mediaFeed?.previewStream ?? null
    : isProgramBus
      ? mediaFeed?.programStream ?? null
      : null;

  const shotMuted = isPreviewBus
    ? Boolean(mediaFeed?.isPreviewMuted)
    : isProgramBus
      ? Boolean(mediaFeed?.isProgramMuted)
      : false;

  const audible = isPreviewBus
    ? Boolean(mediaFeed?.previewAudioAllowed)
    : isProgramBus
      ? Boolean(mediaFeed?.programAudioAllowed)
      : false;

  const level = audioMuted || !audible ? 0 : Math.min(1, Math.max(0, volume));
  useStreamSpeakerPlayback(
    monitorStream,
    enableSpeakerPlayback && !onBusPlaybackStream && Boolean(monitorStream),
    level,
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !active || active.kind !== 'video' || !active.playUrl) return;

    wireVideoElement(video, active, transportPlayingRef.current);

    const syncTime = () => {
      if (!mediaFeed || !Number.isFinite(video.duration)) return;
      mediaFeed.setTransport({
        currentTime: video.currentTime,
        duration: video.duration,
      });
    };

    const onReady = () => {
      syncTime();
      if (transportPlayingRef.current) {
        void video.play().catch(() => undefined);
      }
    };

    video.addEventListener('loadedmetadata', onReady);
    video.addEventListener('canplay', onReady);
    video.addEventListener('timeupdate', syncTime);
    if (video.readyState >= 1) onReady();

    return () => {
      video.removeEventListener('loadedmetadata', onReady);
      video.removeEventListener('canplay', onReady);
      video.removeEventListener('timeupdate', syncTime);
    };
  }, [active?.id, active?.kind, active?.playUrl, active?.loop, mediaFeed]);

  useEffect(() => {
    applyActiveSource(videoRef.current, transportPlaying);
  }, [transportPlaying, applyActiveSource]);

  useEffect(() => {
    if (!onBusPlaybackStream) return;
    if (feedRole === 'pgm' && mediaFeed?.pgmIsMedia) {
      onBusPlaybackStream(mediaFeed.programStream);
      return () => onBusPlaybackStream(null);
    }
    onBusPlaybackStream(null);
    return () => onBusPlaybackStream(null);
  }, [onBusPlaybackStream, feedRole, mediaFeed?.pgmIsMedia, mediaFeed?.programStream]);

  const hasContent = Boolean(active?.playUrl);
  const showShotControls = hasContent && active?.kind === 'video' && !compact;

  return (
    <div className={cn('relative h-full w-full overflow-hidden bg-black', className)}>
      {hasContent && active?.kind === 'video' ? (
        <video ref={setShotVideoEl} className="h-full w-full object-contain" playsInline muted data-pgm-capture="1" />
      ) : hasContent && active?.kind === 'image' ? (
        <img src={active.playUrl} alt={active.name} className="h-full w-full object-contain" />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-violet-950/40 to-black p-4 text-center">
          {compact ? (
            <Film className="h-4 w-4 text-violet-400/60" />
          ) : (
            <>
              <Film className="h-8 w-8 text-violet-400/60" />
              <p className="text-xs font-bold tracking-[0.2em] text-violet-400/80">MEDIA</p>
              <p className="max-w-[200px] text-[10px] text-mixer-muted">
                Select media in the Media panel, preview on this shot, then take live.
              </p>
            </>
          )}
        </div>
      )}

      {showLabel && !compact && (
        <div className="absolute left-2 top-2 z-30 rounded bg-black/70 px-2 py-0.5 text-[9px] font-bold tracking-wider text-violet-300">
          {hasContent
            ? active?.liveOnPgm
              ? 'Media · LIVE'
              : 'Media · PREVIEW'
            : 'Media · STANDBY'}
        </div>
      )}

      {hasContent && active?.liveOnPgm && (
        <div className="absolute right-2 top-2 z-30 rounded bg-violet-600/90 px-2 py-0.5 text-[9px] font-bold tracking-wider text-white">
          LIVE
        </div>
      )}

      {showShotControls && mediaFeed && (
        <div className="absolute inset-x-0 bottom-0 z-40 flex items-center gap-1 bg-gradient-to-t from-black/90 to-transparent px-2 py-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              mediaFeed.togglePlay();
            }}
            className="rounded bg-black/60 p-1 text-white hover:bg-violet-600/80"
            title={mediaFeed.transport.playing ? 'Pause' : 'Play'}
          >
            {mediaFeed.transport.playing ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (isPreviewBus) mediaFeed.onTogglePreviewMute();
              else if (isProgramBus) mediaFeed.onToggleProgramMute();
            }}
            className={cn(
              'rounded bg-black/60 p-1 text-white hover:bg-violet-600/80',
              !shotMuted && 'ring-1 ring-violet-400/60',
            )}
            title={shotMuted ? 'Unmute' : 'Mute'}
          >
            {shotMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}

      {hasContent && active?.kind === 'image' && !compact && (
        <div className="absolute bottom-2 right-2 z-30 rounded bg-black/60 p-1">
          <ImageIcon className="h-3 w-3 text-violet-300" />
        </div>
      )}
    </div>
  );
}
