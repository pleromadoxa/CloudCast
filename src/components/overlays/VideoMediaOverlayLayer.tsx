import { useEffect, useRef } from 'react';
import type { VideoMediaOverlay } from '../../types/overlays';
import { useMediaFeedOptional } from '../../context/MediaFeedContext';
import { rescaleOverlayDimensions } from '../../lib/imageResize';
import { placementStyle, resolveCornerPlacement } from '../../lib/overlayPlacement';

interface VideoMediaOverlayLayerProps {
  overlays: VideoMediaOverlay[];
}

function SyncedOverlayVideo({
  overlay,
  fillScreen,
}: {
  overlay: VideoMediaOverlay;
  fillScreen: boolean;
}) {
  const mediaFeed = useMediaFeedOptional();
  const videoRef = useRef<HTMLVideoElement>(null);
  const syncTransport = overlay.liveOnPgm && Boolean(mediaFeed);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !syncTransport || !mediaFeed) return;

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
  }, [
    mediaFeed,
    overlay.dataUrl,
    overlay.id,
    syncTransport,
    mediaFeed?.transport.playing,
    mediaFeed?.transport.currentTime,
  ]);

  const commonProps = {
    ref: videoRef,
    src: overlay.dataUrl,
    autoPlay: !syncTransport,
    loop: overlay.loop,
    muted: true,
    playsInline: true as const,
    style: { opacity: overlay.opacity / 100 },
  };

  if (fillScreen) {
    return (
      <video
        {...commonProps}
        className="pointer-events-none absolute inset-0 z-[14] h-full w-full object-cover"
      />
    );
  }

  const size = rescaleOverlayDimensions(overlay.naturalWidth, overlay.naturalHeight, overlay.scale);
  const posStyle = placementStyle(resolveCornerPlacement(overlay.position, overlay));
  return (
    <video
      {...commonProps}
      className="pointer-events-none absolute z-[15] object-contain"
      style={{
        ...posStyle,
        width: size.width,
        height: size.height,
        maxWidth: '90%',
        maxHeight: '90%',
        opacity: overlay.opacity / 100,
      }}
    />
  );
}

export function VideoMediaOverlayLayer({ overlays }: VideoMediaOverlayLayerProps) {
  const visible = overlays.filter((o) => o.visible);

  if (visible.length === 0) return null;

  return (
    <>
      {visible.map((overlay) => (
        <SyncedOverlayVideo
          key={overlay.id}
          overlay={overlay}
          fillScreen={Boolean(overlay.fillScreen)}
        />
      ))}
    </>
  );
}
