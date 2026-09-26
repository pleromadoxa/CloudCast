import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AdCarouselEntry, AdLiveVideoSource, AdZoneSettings, MediaLibraryItem } from '../../types/overlays';
import { resolveMediaPlayUrl } from '../../types/overlays';
import { useMediaFeedOptional } from '../../context/MediaFeedContext';
import { placementStyle, resolveCornerPlacement } from '../../lib/overlayPlacement';
import { carouselTiming } from '../../lib/graphicsPack';
import { cn } from '../../lib/utils';

interface AdZoneOverlayProps {
  settings: AdZoneSettings;
  mediaLibrary: MediaLibraryItem[];
  /** True when rendered on the PGM bus — media sources sync to the studio transport. */
  liveOnPgm?: boolean;
}

// --------------------------------------------------------------------------
// Shared live video sources (camera / screen) — one capture, many monitors.
// --------------------------------------------------------------------------

interface LiveStreamEntry {
  refs: number;
  stream: MediaStream | null;
  pending: Promise<MediaStream | null> | null;
}

const liveStreamRegistry = new Map<AdLiveVideoSource, LiveStreamEntry>();

function requestLiveStream(source: AdLiveVideoSource): Promise<MediaStream | null> {
  if (source !== 'camera' && source !== 'browser') return Promise.resolve(null);
  if (!navigator.mediaDevices) return Promise.resolve(null);
  return source === 'camera'
    ? navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    : navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
}

function acquireLiveStream(
  source: AdLiveVideoSource,
  onStream: (stream: MediaStream | null) => void,
): () => void {
  if (source !== 'camera' && source !== 'browser') return () => undefined;
  let entry = liveStreamRegistry.get(source);
  if (!entry) {
    entry = { refs: 0, stream: null, pending: null };
    liveStreamRegistry.set(source, entry);
  }
  entry.refs += 1;
  const current = entry;

  if (current.stream) {
    onStream(current.stream);
  } else if (!current.pending) {
    current.pending = requestLiveStream(source)
      .then((stream) => {
        current.stream = stream;
        current.pending = null;
        onStream(stream);
        return stream;
      })
      .catch(() => {
        current.pending = null;
        onStream(null);
        return null;
      });
  } else {
    void current.pending.then((stream) => onStream(stream));
  }

  return () => {
    current.refs -= 1;
    if (current.refs <= 0) {
      current.stream?.getTracks().forEach((track) => track.stop());
      liveStreamRegistry.delete(source);
    }
  };
}

function LiveStreamVideo({ source, className }: { source: AdLiveVideoSource; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [failedFor, setFailedFor] = useState<AdLiveVideoSource | null>(null);
  const failed = failedFor === source;

  useEffect(() => {
    const release = acquireLiveStream(source, (next) => {
      if (next) setStream(next);
      else setFailedFor(source);
    });
    return release;
  }, [source]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (stream) {
      video.srcObject = stream;
      void video.play().catch(() => undefined);
    }
    return () => {
      if (video) video.srcObject = null;
    };
  }, [stream]);

  if (failed) {
    return (
      <div className={cn('flex items-center justify-center bg-slate-950/90 text-[8px] font-bold uppercase tracking-[0.22em] text-white/60', className)}>
        Source offline
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      muted
      autoPlay
      playsInline
      className={cn('h-full w-full object-cover', className)}
    />
  );
}

function SyncedAdVideo({
  src,
  syncTransport,
  className,
}: {
  src: string;
  syncTransport: boolean;
  className?: string;
}) {
  const mediaFeed = useMediaFeedOptional();
  const videoRef = useRef<HTMLVideoElement>(null);
  const sync = syncTransport && Boolean(mediaFeed);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !sync || !mediaFeed) return;

    const syncPlayback = () => {
      if (mediaFeed.transport.playing) {
        void video.play().catch(() => undefined);
      } else {
        video.pause();
      }
    };
    const syncTime = () => {
      if (!mediaFeed.transport.playing) return;
      const drift = Math.abs(video.currentTime - mediaFeed.transport.currentTime);
      if (drift > 0.35) {
        try {
          video.currentTime = mediaFeed.transport.currentTime;
        } catch {
          /* ignore seek errors while loading */
        }
      }
    };

    video.addEventListener('loadeddata', syncPlayback);
    video.addEventListener('canplay', syncPlayback);
    syncPlayback();
    syncTime();
    return () => {
      video.removeEventListener('loadeddata', syncPlayback);
      video.removeEventListener('canplay', syncPlayback);
    };
  }, [mediaFeed, src, sync, mediaFeed?.transport.playing, mediaFeed?.transport.currentTime]);

  return (
    <video
      ref={videoRef}
      src={src}
      autoPlay={!sync}
      loop
      muted
      playsInline
      className={cn('h-full w-full object-cover', className)}
    />
  );
}

// --------------------------------------------------------------------------
// Ad zone card
// --------------------------------------------------------------------------

function PlaceholderCreative({ message }: { message: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-slate-900 to-slate-950">
      <span className="text-[8px] font-black uppercase tracking-[0.28em] text-white/70">{message}</span>
      <span className="text-[7px] font-medium uppercase tracking-[0.18em] text-white/35">
        Set creative in Layers
      </span>
    </div>
  );
}

function CarouselSlide({ entry }: { entry: AdCarouselEntry }) {
  return (
    <>
      {entry.imageDataUrl ? (
        <img
          key={entry.id}
          src={entry.imageDataUrl}
          alt=""
          className="animate-cloudcast-gfx-fade h-full w-full object-cover"
        />
      ) : (
        <PlaceholderCreative message="Empty creative" />
      )}
    </>
  );
}

export function AdZoneOverlay({
  settings,
  mediaLibrary,
  liveOnPgm = false,
}: AdZoneOverlayProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (settings.sourceKind !== 'carousel' || settings.carousel.length < 2) return;
    const timer = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [settings.sourceKind, settings.carousel.length]);

  const posStyle = placementStyle(resolveCornerPlacement(settings.position, settings));
  const rotated = settings.carousel.map((entry) => ({
    ...entry,
    durationSeconds: entry.durationSeconds || settings.rotateIntervalSeconds,
  }));
  const timing = carouselTiming(rotated, elapsed);
  const activeEntry = rotated[Math.min(timing.index, rotated.length - 1)];

  let creative: ReactNode;
  if (settings.sourceKind === 'image') {
    creative = settings.imageDataUrl ? (
      <img src={settings.imageDataUrl} alt="" className="h-full w-full object-cover" />
    ) : (
      <PlaceholderCreative message="No creative loaded" />
    );
  } else if (settings.sourceKind === 'carousel') {
    creative = activeEntry ? (
      <CarouselSlide entry={activeEntry} />
    ) : (
      <PlaceholderCreative message="Carousel empty" />
    );
  } else if (settings.liveVideoSource === 'none') {
    creative = <PlaceholderCreative message="Select live source" />;
  } else if (settings.liveVideoSource === 'camera' || settings.liveVideoSource === 'browser') {
    creative = <LiveStreamVideo source={settings.liveVideoSource} />;
  } else {
    const mediaId = settings.liveVideoSource.startsWith('media:')
      ? settings.liveVideoSource.slice(6)
      : '';
    const item = mediaLibrary.find((m) => m.id === mediaId);
    const src = item ? resolveMediaPlayUrl(item) : '';
    creative = src ? (
      <SyncedAdVideo src={src} syncTransport={liveOnPgm} />
    ) : (
      <PlaceholderCreative message="Media not found" />
    );
  }

  const caption = settings.showCaptionBar
    ? activeEntry?.caption?.trim() || settings.adName
    : '';

  return (
    <div
      className="absolute z-[16] animate-cloudcast-gfx-rise"
      style={{ ...posStyle, opacity: settings.opacity / 100 }}
    >
      <div
        className="overflow-hidden rounded-md border border-white/15 shadow-[0_16px_38px_rgba(0,0,0,0.55)]"
        style={{ width: `${settings.widthPercent * 8}px`, background: 'rgba(2,6,23,0.9)' }}
      >
        <div className="relative aspect-video w-full">
          {creative}

          {settings.showAdBadge && (
            <span className="absolute left-1.5 top-1.5 rounded-sm border border-white/25 bg-black/70 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.22em] text-white backdrop-blur-sm">
              AD
            </span>
          )}

          {settings.sourceKind === 'carousel' && settings.carousel.length > 1 && (
            <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[7px] font-bold tabular-nums text-white/85 backdrop-blur-sm">
              {Math.min(timing.index, settings.carousel.length - 1) + 1}/{settings.carousel.length}
            </span>
          )}
        </div>

        {(settings.showCaptionBar || caption) && (
          <div
            className="flex items-center gap-2 px-2.5 py-1.5"
            style={{
              background: 'linear-gradient(90deg, rgba(15,23,42,0.98), rgba(30,41,59,0.92))',
              borderTop: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <span className="h-3 w-0.5 shrink-0 rounded-full bg-amber-400/90" />
            <div className="min-w-0">
              {settings.showCaptionBar && settings.sponsorLabel.trim() && (
                <p className="text-[6px] font-black uppercase tracking-[0.28em] text-amber-300/90">
                  {settings.sponsorLabel}
                </p>
              )}
              <p className="truncate text-[9px] font-semibold uppercase tracking-[0.12em] text-white/95">
                {caption || settings.adName || 'SPONSOR'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
