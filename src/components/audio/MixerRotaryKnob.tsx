import { useCallback, useRef, type PointerEvent } from 'react';
import { cn } from '../../lib/utils';

export function MixerRotaryKnob({
  label,
  value,
  min,
  max,
  disabled,
  unit = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  unit?: string;
  onChange: (value: number) => void;
}) {
  const dragRef = useRef<{ startY: number; startVal: number } | null>(null);
  const pct = (value - min) / (max - min);
  const rotation = pct * 270 - 135;

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { startY: e.clientY, startVal: value };
    },
    [disabled, value],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current || disabled) return;
      const delta = dragRef.current.startY - e.clientY;
      const range = max - min;
      const next = Math.min(max, Math.max(min, dragRef.current.startVal + delta * (range / 120)));
      onChange(Math.round(next));
    },
    [disabled, max, min, onChange],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  return (
    <div className={cn('mixer-hw-knob', disabled && 'mixer-hw-knob--disabled')}>
      <span className="mixer-hw-knob__label">{label}</span>
      <div className="mixer-hw-knob__housing">
        <div
          role="slider"
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          tabIndex={disabled ? -1 : 0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={(e) => {
            if (disabled) return;
            const step = e.shiftKey ? 10 : 2;
            if (e.key === 'ArrowUp') onChange(Math.min(max, value + step));
            if (e.key === 'ArrowDown') onChange(Math.max(min, value - step));
          }}
          className="mixer-hw-knob__dial"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <span className="mixer-hw-knob__pointer" />
        </div>
      </div>
      <span className="mixer-hw-knob__value">
        {value}
        {unit}
      </span>
    </div>
  );
}
