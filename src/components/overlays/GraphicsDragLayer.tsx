import { useCallback, useRef, useState } from 'react';
import { Move } from 'lucide-react';
import type { LayerSettings } from '../../types/mixer';
import type { LayerStackId } from '../mixer/panels/layers/layerStackTypes';
import {
  isDraggableLayer,
  isLayerVisibleOnStagingPreview,
  LOWER_THIRD_Y,
  nearestCornerPreset,
  placementStyle,
  resolveCornerPlacement,
  resolveLowerThirdX,
  xToLowerThirdPosition,
} from '../../lib/overlayPlacement';
import { rescaleOverlayDimensions } from '../../lib/imageResize';
import { cn } from '../../lib/utils';

interface GraphicsDragLayerProps {
  layers: LayerSettings;
  selectedLayerId: LayerStackId | null;
  enabled: boolean;
  onPatch: (partial: Partial<LayerSettings>) => void;
}

function percentFromPointer(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): { x: number; y: number } {
  return {
    x: ((clientX - rect.left) / rect.width) * 100,
    y: ((clientY - rect.top) / rect.height) * 100,
  };
}

export function GraphicsDragLayer({
  layers,
  selectedLayerId,
  enabled,
  onPatch,
}: GraphicsDragLayerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const patchPlacement = useCallback(
    (x: number, y: number) => {
      if (!selectedLayerId) return;

      if (selectedLayerId === 'logo') {
        const logo = layers.programLogo;
        onPatch({
          programLogo: {
            ...logo,
            xPercent: x,
            yPercent: y,
            position: nearestCornerPreset(x, y),
          },
        });
        return;
      }

      if (selectedLayerId === 'lower-third') {
        const c = layers.lowerThirdCustomization;
        const pos = xToLowerThirdPosition(x);
        onPatch({
          lowerThirdCustomization: {
            ...c,
            position: pos,
            xPercent: x,
          },
        });
        return;
      }

      if (selectedLayerId === 'live-button') {
        onPatch({
          liveButton: {
            ...layers.liveButton,
            xPercent: x,
            yPercent: y,
            position: nearestCornerPreset(x, y),
          },
        });
        return;
      }

      if (selectedLayerId.startsWith('image:')) {
        const imgId = selectedLayerId.slice(6);
        onPatch({
          imageOverlays: layers.imageOverlays.map((o) =>
            o.id === imgId
              ? { ...o, xPercent: x, yPercent: y, position: nearestCornerPreset(x, y) }
              : o,
          ),
        });
      }
    },
    [layers, onPatch, selectedLayerId],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || !selectedLayerId || !isDraggableLayer(selectedLayerId)) return;
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setDragging(true);
    },
    [enabled, selectedLayerId],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || !rootRef.current) return;
      const rect = rootRef.current.getBoundingClientRect();
      const { x, y } = percentFromPointer(e.clientX, e.clientY, rect);
      patchPlacement(x, selectedLayerId === 'lower-third' ? LOWER_THIRD_Y : y);
    },
    [dragging, patchPlacement, selectedLayerId],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    setDragging(false);
  }, []);

  if (
    !enabled ||
    !selectedLayerId ||
    !isDraggableLayer(selectedLayerId) ||
    !isLayerVisibleOnStagingPreview(selectedLayerId, layers)
  ) {
    return null;
  }

  let handleStyle: React.CSSProperties = {};
  let handleSize: { w: string; h: string } = { w: '22%', h: '12%' };

  if (selectedLayerId === 'logo') {
    const p = resolveCornerPlacement(layers.programLogo.position, layers.programLogo);
    handleStyle = placementStyle(p);
    if (layers.programLogo.mode === 'image' && layers.programLogo.imageDataUrl) {
      const size = rescaleOverlayDimensions(
        layers.programLogo.naturalWidth,
        layers.programLogo.naturalHeight,
        layers.programLogo.scale,
      );
      handleSize = { w: size.width, h: size.height };
    }
  } else if (selectedLayerId === 'lower-third') {
    const x = resolveLowerThirdX(
      layers.lowerThirdCustomization.position,
      layers.lowerThirdCustomization.xPercent,
    );
    handleStyle = {
      left: `${x}%`,
      top: `${LOWER_THIRD_Y}%`,
      transform: 'translate(-50%, -50%)',
    };
    handleSize = { w: '55%', h: '14%' };
  } else if (selectedLayerId === 'live-button') {
    const p = resolveCornerPlacement(layers.liveButton.position, layers.liveButton);
    handleStyle = placementStyle(p);
    handleSize = { w: '18%', h: '10%' };
  } else if (selectedLayerId.startsWith('image:')) {
    const img = layers.imageOverlays.find((o) => o.id === selectedLayerId.slice(6));
    if (!img) return null;
    const p = resolveCornerPlacement(img.position, img);
    handleStyle = placementStyle(p);
    const size = rescaleOverlayDimensions(img.naturalWidth, img.naturalHeight, img.scale);
    handleSize = { w: size.width, h: size.height };
  }

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 z-[35]">
      <div
        role="button"
        tabIndex={0}
        aria-label="Drag to position graphic"
        className={cn(
          'pointer-events-auto absolute touch-none rounded border-2 border-dashed border-mixer-green bg-mixer-green/10 shadow-[0_0_14px_rgba(34,197,94,0.45)]',
          dragging ? 'cursor-grabbing border-solid bg-mixer-green/20' : 'cursor-grab hover:bg-mixer-green/15',
        )}
        style={{
          ...handleStyle,
          width: handleSize.w,
          height: handleSize.h,
          minWidth: 48,
          minHeight: 32,
          maxWidth: '55%',
          maxHeight: '45%',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="flex h-full items-center justify-center gap-1 text-mixer-green">
          <Move className={cn('h-4 w-4', dragging && 'scale-110')} />
          {!dragging && (
            <span className="text-[8px] font-bold uppercase tracking-wide opacity-90">Drag</span>
          )}
        </div>
      </div>
    </div>
  );
}
