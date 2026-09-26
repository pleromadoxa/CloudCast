import { useEffect, useRef, useState } from 'react';
import type { ProductHeroMedia } from '../../config/productHeroMedia';
import { cn } from '../../lib/utils';

interface ProductHeroBackgroundProps {
  media: ProductHeroMedia;
  className?: string;
}

/**
 * Decorative, full-bleed background video for a product landing hero.
 *
 * The clip is always muted + looping and is blended into the dark marketing
 * theme so foreground copy stays readable. When the visitor prefers reduced
 * motion (or the video fails to load) we fall back to the static poster frame
 * and drop the motion entirely.
 */
export function ProductHeroBackground({ media, className }: ProductHeroBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [ready, setReady] = useState(false);

  // Respect the OS-level "reduce motion" preference at mount + on change.
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  // Stop playback (and prevent it resuming) when reduced motion is requested.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (reducedMotion) {
      video.pause();
      video.removeAttribute('autoplay');
    } else {
      video.setAttribute('autoplay', '');
      void video.play().catch(() => {
        // Autoplay can be blocked; the poster frame remains as a graceful fallback.
      });
    }
  }, [reducedMotion]);

  return (
    <div
      aria-hidden
      data-label={media.label}
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      {/* Video (or poster when motion is reduced) — blended into the dark theme. */}
      {reducedMotion ? (
        <img
          src={media.posterSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ mixBlendMode: media.blendMode, opacity: media.opacity, filter: media.filter }}
        />
      ) : (
        <video
          ref={videoRef}
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-700',
            ready ? 'opacity-100' : 'opacity-0',
          )}
          style={{ mixBlendMode: media.blendMode, opacity: media.opacity, filter: media.filter }}
          src={media.videoSrc}
          poster={media.posterSrc}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onCanPlay={() => setReady(true)}
          onLoadedData={() => setReady(true)}
          onError={() => setReady(true)}
        />
      )}

      {/* Scrims keep foreground copy legible and dissolve the clip into the page. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(6,6,6,0.72) 0%, rgba(6,6,6,0.30) 30%, rgba(6,6,6,0.42) 62%, rgba(10,10,10,0.92) 100%)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 100% 85% at 50% 32%, rgba(6,6,6,0) 0%, rgba(6,6,6,0.35) 55%, rgba(6,6,6,0.78) 100%)',
        }}
      />
      {/* Bottom fade — blends the video edge into the marketing page background. */}
      <div
        className="absolute inset-x-0 bottom-0 h-40"
        style={{
          background: 'linear-gradient(180deg, rgba(10,10,10,0) 0%, #0a0a0a 100%)',
        }}
      />
    </div>
  );
}
