import { cn } from '../../lib/utils';

interface WorkspaceSplitHandleProps {
  isDragging?: boolean;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void;
}

/** Draggable divider between dashboard monitors and the control deck. */
export function WorkspaceSplitHandle({
  isDragging = false,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: WorkspaceSplitHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize monitor and panel areas"
      className={cn('workspace-split-handle', isDragging && 'workspace-split-handle--active')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div className="workspace-split-handle__grip" aria-hidden />
    </div>
  );
}
