import type { ImageOverlay } from '../../types/overlays';
import { rescaleOverlayDimensions } from '../../lib/imageResize';
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
        const size = rescaleOverlayDimensions(overlay.naturalWidth, overlay.naturalHeight, overlay.scale);
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
              width: size.width,
              height: size.height,
              maxWidth: '45%',
              maxHeight: '45%',
              opacity: overlay.opacity / 100,
            }}
          />
        );
      })}
    </>
  );
}
