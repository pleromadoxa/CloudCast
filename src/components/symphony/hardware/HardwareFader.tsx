import { useCallback, useRef } from 'react';
import { cn } from '../../../lib/utils';

export interface HardwareFaderProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  height?: number;
  label?: string;
  displayValue?: (value: number) => string;
  showScale?: boolean;
  disabled?: boolean;
  className?: string;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Standard console dB legend positions (top → bottom). */
const SCALE_LABELS = ['+6', '0', '−6', '−12', '−24', '−∞'];

export function HardwareFader({
  value, min = 0, max = 100, onChange, height = 168, label,
  displayValue, showScale = true, disabled = false, className,
}: HardwareFaderProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const span = max - min;
  const norm = span === 0 ? 0 : (value - min) / span;
  const capBottom = 8 + norm * (height - 16);

  const valueFromPointer = useCallback((clientY: number) => {
    const track = trackRef.current;
    if (!track) return value;
    const rect = track.getBoundingClientRect();
    const rel = 1 - (clientY - rect.top - 8) / (rect.height - 16);
    return clamp(min + rel * span, min, max);
  }, [value, min, max, span]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    draggingRef.current = true;
    (e.target as Element).setPointerCapture(e.pointerId);
    onChange(valueFromPointer(e.clientY));
  }, [disabled, onChange, valueFromPointer]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    onChange(valueFromPointer(e.clientY));
  }, [onChange, valueFromPointer]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    draggingRef.current = false;
    try { (e.target as Element).releasePointerCapture(e.pointerId); } catch { /* noop */ }
  }, []);

  const valueText = displayValue
    ? displayValue(value)
    : `${Math.round(value)}`;

  return (
    <div className={cn('sym-fader-rail', className)}>
      <div
        ref={trackRef}
        className="sym-fader-track"
        style={{ height }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="slider"
        aria-label={label ?? 'Fader'}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Math.round(value)}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          const step = span / 40;
          if (e.key === 'ArrowUp') { e.preventDefault(); onChange(clamp(value + step, min, max)); }
          if (e.key === 'ArrowDown') { e.preventDefault(); onChange(clamp(value - step, min, max)); }
          if (e.key === 'PageUp') { e.preventDefault(); onChange(clamp(value + span / 10, min, max)); }
          if (e.key === 'PageDown') { e.preventDefault(); onChange(clamp(value - span / 10, min, max)); }
        }}
      >
        <div className="sym-fader-groove" />
        {showScale && (
          <div className="sym-fader-scale" style={{ left: 2, right: 2 }}>
            {SCALE_LABELS.map((s) => <span key={s}>{s}</span>)}
          </div>
        )}
        <div className="sym-fader-cap" style={{ bottom: capBottom }} />
      </div>
      {label && <span className="sym-knob__label">{label}</span>}
      <span className="sym-knob__value">{valueText}</span>
    </div>
  );
}
