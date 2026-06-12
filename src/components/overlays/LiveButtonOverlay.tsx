import type { LiveButtonSettings } from '../../types/overlays';
import { placementStyle, resolveCornerPlacement } from '../../lib/overlayPlacement';
import { cn } from '../../lib/utils';

interface LiveButtonOverlayProps {
  settings: LiveButtonSettings;
}

export function LiveButtonOverlay({ settings }: LiveButtonOverlayProps) {
  const posStyle = placementStyle(resolveCornerPlacement(settings.position, settings));

  return (
    <div className="absolute z-[18]" style={{ ...posStyle, opacity: settings.opacity / 100 }}>
      <div
        className={cn(
          'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold tracking-widest shadow-lg',
          settings.pulse && 'animate-pulse',
        )}
        style={{
          backgroundColor: settings.backgroundColor,
          color: '#fff',
          border: `2px solid ${settings.accentColor}`,
        }}
      >
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: settings.accentColor }}
        />
        {settings.label.toUpperCase()}
      </div>
    </div>
  );
}
