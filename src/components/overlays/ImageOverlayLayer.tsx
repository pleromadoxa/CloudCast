import type { ImageOverlay } from '../../types/overlays';
import { overlayCanvasPercentSize } from '../../lib/mediaImagePlacement';
import { placementStyle, resolveCornerPlacement } from '../../lib/overlayPlacement';

interface ImageOverlayLayerProps {
  overlays: ImageOverlay[];
}

export function ImageOverlayLayer({ overlays }: ImageOverlayLayerProps) {
  const visible = overlays.filter((o) => o.visible);

  if (visible.length === 0) return null;

  return (
    <>
      {visible.map((overlay) => {
        if (overlay.fillScreen) {
          return (
            <img
              key={overlay.id}
              src={overlay.dataUrl}
              alt={overlay.name}
              draggable={false}
              className="pointer-events-none absolute inset-0 z-[14] h-full w-full object-cover"
              style={{ opacity: overlay.opacity / 100 }}
            />
          );
        }

        const size = overlayCanvasPercentSize(
          overlay.naturalWidth,
          overlay.naturalHeight,
          overlay.scale,
        );
        const posStyle = placementStyle(resolveCornerPlacement(overlay.position, overlay));
        return (
          <img
            key={overlay.id}
            src={overlay.dataUrl}
            alt={overlay.name}
            draggable={false}
            className="pointer-events-none absolute z-[15] object-contain"
            style={{
              ...posStyle,
              width: `${size.widthPct}%`,
              height: `${size.heightPct}%`,
              opacity: overlay.opacity / 100,
            }}
          />
        );
      })}
    </>
  );
}
