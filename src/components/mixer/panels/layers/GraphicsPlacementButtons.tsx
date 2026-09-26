import type { OverlayPosition } from '../../../../types/overlays';
import { PRESET_PLACEMENT } from '../../../../lib/overlayPlacement';
import { cn } from '../../../../lib/utils';

const POSITIONS: OverlayPosition[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'];

interface GraphicsPlacementButtonsProps {
  value: OverlayPosition;
  onChange: (position: OverlayPosition, xPercent: number, yPercent: number) => void;
}

/** Preset corner/center placement row shared by the graphics pack editors. */
export function GraphicsPlacementButtons({ value, onChange }: GraphicsPlacementButtonsProps) {
  return (
    <div className="flex flex-wrap gap-0.5">
      {POSITIONS.map((p) => {
        const pl = PRESET_PLACEMENT[p];
        return (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p, pl.xPercent, pl.yPercent)}
            className={cn('mixer-btn px-2 py-0.5 text-[8px]', value === p && 'mixer-btn-active')}
          >
            {p.replace('-', ' ')}
          </button>
        );
      })}
    </div>
  );
}
