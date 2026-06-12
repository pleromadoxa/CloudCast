import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import {
  type PlayheadPosition,
  playheadToPx,
  pxToPosition,
} from '../../lib/symphony/dragTypes';

interface PlayheadTickerProps {
  bar: number;
  beat: number;
  tick: number;
  playing: boolean;
  snapEnabled: boolean;
  clientXToPx: (clientX: number) => number;
  onSeekStart: () => void;
  onSeek: (position: PlayheadPosition) => void;
  onSeekEnd: (position: PlayheadPosition) => void;
  barWidth?: number;
  className?: string;
}

/** Full-height playhead line + ruler triangle; drag horizontally to seek. */
export function PlayheadTicker({
  bar,
  beat,
  tick,
  playing,
  snapEnabled,
  clientXToPx,
  onSeekStart,
  onSeek,
  onSeekEnd,
  barWidth,
  className,
}: PlayheadTickerProps) {
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(false);
  const left = playheadToPx(bar, beat, tick, barWidth);

  const seekFromClientX = useCallback((clientX: number) => {
    const px = clientXToPx(clientX);
    return pxToPosition(px, snapEnabled, barWidth);
  }, [clientXToPx, snapEnabled, barWidth]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = true;
    setDragging(true);
    onSeekStart();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    onSeek(seekFromClientX(e.clientX));
  }, [onSeek, onSeekStart, seekFromClientX]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    e.preventDefault();
    onSeek(seekFromClientX(e.clientX));
  }, [onSeek, seekFromClientX]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = false;
    setDragging(false);
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    onSeekEnd(seekFromClientX(e.clientX));
  }, [onSeekEnd, seekFromClientX]);

  useEffect(() => () => { dragRef.current = false; }, []);

  return (
    <div
      className={cn(
        'sym-playhead',
        playing && !dragging && 'sym-playhead--playing',
        dragging && 'sym-playhead--dragging',
        className,
      )}
      style={{ left }}
      role="slider"
      aria-label="Playhead"
      aria-valuemin={1}
      aria-valuemax={999}
      aria-valuenow={bar}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="sym-playhead__hit" />
      <div className="sym-playhead__head" />
      <div className="sym-playhead__line" />
    </div>
  );
}
