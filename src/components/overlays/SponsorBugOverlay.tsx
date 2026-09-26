import { useEffect, useState } from 'react';
import type { SponsorBugSettings } from '../../types/overlays';
import { placementStyle, resolveCornerPlacement } from '../../lib/overlayPlacement';
import { carouselTiming } from '../../lib/graphicsPack';

interface SponsorBugOverlayProps {
  settings: SponsorBugSettings;
}

/** Small rotating sponsor / logo bug — top-corner broadcast identity. */
export function SponsorBugOverlay({ settings }: SponsorBugOverlayProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  if (settings.entries.length === 0) return null;

  const timing = carouselTiming(settings.entries, elapsed);
  const entry = settings.entries[Math.min(timing.index, settings.entries.length - 1)];
  if (!entry || !entry.logoDataUrl) return null;

  const posStyle = placementStyle(resolveCornerPlacement(settings.position, settings));

  return (
    <div
      className="absolute z-[16] animate-cloudcast-gfx-rise"
      style={{ ...posStyle, opacity: settings.opacity / 100 }}
    >
      <div
        className="flex items-center gap-2 rounded-full border border-white/15 bg-slate-950/60 px-2.5 py-1.5 shadow-[0_8px_22px_rgba(0,0,0,0.45)] backdrop-blur-md"
        style={{ width: `${settings.size * 8}px` }}
      >
        <img
          key={entry.id}
          src={entry.logoDataUrl}
          alt=""
          className="animate-cloudcast-gfx-fade h-7 w-auto max-w-full shrink-0 object-contain"
        />
        {entry.label?.trim() && (
          <span
            key={`${entry.id}-label`}
            className="animate-cloudcast-gfx-fade min-w-0 truncate text-[8px] font-bold uppercase tracking-[0.18em] text-white/85"
          >
            {entry.label}
          </span>
        )}
      </div>
    </div>
  );
}
