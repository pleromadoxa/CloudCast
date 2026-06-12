import type { LayerSettings } from '../../types/mixer';
import type { LayerStackId } from '../mixer/panels/layers/layerStackTypes';
import {
  LOWER_THIRD_Y,
  placementStyle,
  resolveCornerPlacement,
  resolveLowerThirdX,
} from '../../lib/overlayPlacement';
import { cn } from '../../lib/utils';

interface LayerHighlightProps {
  layerId: LayerStackId;
  layers: LayerSettings;
  label: string;
  /** When true, drag handle owns the highlight — hide static box. */
  hideWhenDraggable?: boolean;
}

function HighlightBox({
  className,
  style,
  label,
}: {
  className?: string;
  style?: React.CSSProperties;
  label: string;
}) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute z-[30] rounded border-2 border-dashed border-mixer-green shadow-[0_0_12px_rgba(34,197,94,0.5)]',
        className,
      )}
      style={style}
    >
      <span className="absolute -top-4 left-0 whitespace-nowrap rounded bg-mixer-green px-1.5 py-0.5 text-[8px] font-bold uppercase text-black">
        {label}
      </span>
    </div>
  );
}

export function LayerHighlight({ layerId, layers, label, hideWhenDraggable }: LayerHighlightProps) {
  if (hideWhenDraggable && (layerId === 'logo' || layerId === 'lower-third' || layerId.startsWith('image:'))) {
    return null;
  }

  if (layerId === 'breaking') {
    return <HighlightBox className="left-0 right-0 top-0 h-[9%]" label={label} />;
  }
  if (layerId === 'lower-third') {
    const x = resolveLowerThirdX(layers.lowerThirdCustomization.position, layers.lowerThirdCustomization.xPercent);
    return (
      <HighlightBox
        label={label}
        style={{
          left: `${x}%`,
          top: `${LOWER_THIRD_Y}%`,
          transform: 'translate(-50%, -50%)',
          width: '55%',
          height: '14%',
        }}
      />
    );
  }
  if (layerId === 'logo') {
    return (
      <HighlightBox
        label={label}
        style={{
          ...placementStyle(resolveCornerPlacement(layers.programLogo.position, layers.programLogo)),
          width: '22%',
          height: '12%',
        }}
      />
    );
  }
  if (layerId === 'crawler') {
    return <HighlightBox className="bottom-0 left-0 right-0 h-[7%]" label={label} />;
  }
  if (layerId === 'transition') {
    return <HighlightBox className="inset-[8%]" label={label} />;
  }
  if (layerId.startsWith('image:')) {
    const imgId = layerId.slice(6);
    const img = layers.imageOverlays.find((o) => o.id === imgId);
    if (!img) return null;
    return (
      <HighlightBox
        label={label}
        style={{
          ...placementStyle(resolveCornerPlacement(img.position, img)),
          width: '22%',
          height: '12%',
        }}
      />
    );
  }
  if (layerId === 'chroma') {
    return <HighlightBox className="inset-[5%] border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.4)]" label={label} />;
  }
  return null;
}
