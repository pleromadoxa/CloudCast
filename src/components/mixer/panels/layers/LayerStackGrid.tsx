import { useCallback, useRef, useState } from 'react';
import { Eye, EyeOff, GripVertical, Radio, Trash2 } from 'lucide-react';
import type { LayerStackItem, LayerStackId } from './layerStackTypes';
import { cn } from '../../../../lib/utils';

interface LayerStackGridProps {
  items: LayerStackItem[];
  selectedId: LayerStackId;
  chromaLocked?: boolean;
  advancedLocked?: boolean;
  compact?: boolean;
  onSelect: (id: LayerStackId) => void;
  onTogglePreview: (id: LayerStackId, on: boolean) => void;
  onToggleLive: (id: LayerStackId, live: boolean) => void;
  onDelete: (id: LayerStackId) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

const GRID_COLS = 'layer-stack-cols';

function StatusCell({ preview, live }: { preview: boolean; live: boolean }) {
  if (!preview && !live) {
    return <span className="layer-stack-status-idle">—</span>;
  }
  return (
    <div className="flex flex-col items-center gap-0.5">
      {preview && <span className="layer-stack-badge-pst">PST</span>}
      {live && <span className="layer-stack-badge-air">AIR</span>}
    </div>
  );
}

export function LayerStackGrid({
  items,
  selectedId,
  chromaLocked,
  advancedLocked = false,
  compact = false,
  onSelect,
  onTogglePreview,
  onToggleLive,
  onDelete,
  onReorder,
}: LayerStackGridProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const dragIndexRef = useRef<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const resolveDropIndex = useCallback((clientY: number) => {
    const body = bodyRef.current;
    if (!body) return null;
    const rows = Array.from(body.querySelectorAll<HTMLElement>('[data-stack-row]'));
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (clientY < mid) return i;
    }
    return rows.length - 1;
  }, []);

  const finishDrag = useCallback(
    (from: number | null, targetIndex: number | null) => {
      if (from !== null && targetIndex !== null && from !== targetIndex) {
        onReorder(from, targetIndex);
      }
      dragIndexRef.current = null;
      setDragIndex(null);
      setOverIndex(null);
    },
    [onReorder],
  );

  return (
    <div className={cn('layer-stack-grid', !compact && 'flex min-h-0 flex-1 flex-col')}>
      <div className={cn('layer-stack-header', GRID_COLS)}>
        <span />
        <span>Z</span>
        <span>Layer</span>
        <span className="text-center">Status</span>
        <span className="text-center">PST</span>
        <span className="text-center">PGM</span>
        <span />
      </div>

      <div ref={bodyRef} className={cn('layer-stack-body', compact && 'layer-stack-body-compact')}>
        {items.map((item, rowIndex) => {
          const selected = selectedId === item.id;
          const isAdvancedLayer =
            item.id === 'breaking' ||
            item.id === 'crawler' ||
            item.id === 'transition' ||
            item.id.startsWith('image:');
          const locked =
            (item.id === 'chroma' && chromaLocked) || (advancedLocked && isAdvancedLayer);
          const isDragging = dragIndex === rowIndex;
          const isDropTarget = overIndex === rowIndex && dragIndex !== null && dragIndex !== rowIndex;

          return (
            <div
              key={item.id}
              data-stack-row
              className={cn(
                GRID_COLS,
                'layer-stack-row',
                selected && 'layer-stack-row-selected',
                rowIndex % 2 === 1 && 'layer-stack-row-alt',
                locked && 'opacity-50',
                isDragging && 'layer-stack-row-dragging',
                isDropTarget && 'layer-stack-row-drop-target',
              )}
            >
              <div className="flex justify-center">
                {item.canReorder ? (
                  <button
                    type="button"
                    aria-label={`Reorder ${item.label}`}
                    className="layer-stack-grip"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      dragIndexRef.current = rowIndex;
                      setDragIndex(rowIndex);
                      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    }}
                    onPointerMove={(e) => {
                      if (dragIndexRef.current === null) return;
                      setOverIndex(resolveDropIndex(e.clientY));
                    }}
                    onPointerUp={(e) => {
                      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                      const target = resolveDropIndex(e.clientY);
                      finishDrag(dragIndexRef.current, target);
                    }}
                    onPointerCancel={(e) => {
                      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                      finishDrag(null, null);
                    }}
                  >
                    <GripVertical className="h-3 w-3" />
                  </button>
                ) : (
                  <span className="text-mixer-muted/20">·</span>
                )}
              </div>

              <span className="layer-stack-z">L{item.zIndex}</span>

              <button
                type="button"
                className="layer-stack-name"
                onClick={() => onSelect(item.id)}
              >
                <span className="truncate font-semibold">{item.label}</span>
                {item.sublabel && (
                  <span className="truncate text-mixer-muted">{item.sublabel}</span>
                )}
              </button>

              <div className="flex justify-center">
                <StatusCell preview={item.isPreview} live={item.isLive} />
              </div>

              <div className="flex justify-center">
                {item.canPreview ? (
                  <button
                    type="button"
                    title={item.isPreview ? 'Hide PST' : 'Show PST'}
                    onClick={() => onTogglePreview(item.id, !item.isPreview)}
                    className={cn('layer-stack-icon-btn', item.isPreview && 'atem-toggle-on')}
                  >
                    {item.isPreview ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  </button>
                ) : (
                  <span className="text-mixer-muted/30">·</span>
                )}
              </div>

              <div className="flex items-center justify-center gap-0.5">
                {item.canGoLive ? (
                  <>
                    <button
                      type="button"
                      title="Take live"
                      onClick={() => onToggleLive(item.id, true)}
                      className={cn('layer-stack-icon-btn', item.isLive && 'atem-toggle-on')}
                    >
                      <Radio className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      title="Off air"
                      onClick={() => onToggleLive(item.id, false)}
                      disabled={!item.isLive}
                      className={cn('layer-stack-off-btn', item.isLive && 'atem-toggle-glow')}
                    >
                      OFF
                    </button>
                  </>
                ) : (
                  <span className="text-mixer-muted/30">·</span>
                )}
              </div>

              <div className="flex justify-center">
                {item.canDelete ? (
                  <button
                    type="button"
                    title="Remove layer"
                    onClick={() => onDelete(item.id)}
                    className="layer-stack-icon-btn layer-stack-icon-btn-danger"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                ) : (
                  <span className="text-mixer-muted/30">·</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
