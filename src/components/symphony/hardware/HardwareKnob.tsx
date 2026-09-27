import { useCallback, useId, useRef } from 'react';
import { cn } from '../../../lib/utils';

export interface HardwareKnobProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
  displayValue?: (value: number) => string;
  /** Reset target on double-click (defaults to min + span/2). */
  defaultValue?: number;
  /** Draw the indicator arc from the center position (pan-style). */
  bipolar?: boolean;
  size?: number;
  accent?: string;
  disabled?: boolean;
  className?: string;
}

const SWEEP = 270; // degrees
const START_ANGLE = -135; // 0° points up; sweep runs −135° → +135°

function polar(cx: number, cy: number, radius: number, angleDeg: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)];
}

function arcPath(cx: number, cy: number, radius: number, fromDeg: number, toDeg: number): string {
  const [x1, y1] = polar(cx, cy, radius, toDeg);
  const [x2, y2] = polar(cx, cy, radius, fromDeg);
  const large = toDeg - fromDeg <= 180 ? 0 : 1;
  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 0 ${x2} ${y2}`;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export function HardwareKnob({
  value, min, max, onChange, label, displayValue, defaultValue,
  bipolar = false, size = 46, accent = '#a78bfa', disabled = false, className,
}: HardwareKnobProps) {
  const gradId = useId().replace(/:/g, '');
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null);
  const span = max - min;
  const norm = span === 0 ? 0 : (value - min) / span;
  const angle = START_ANGLE + norm * SWEEP;
  const center = 28;
  const resetValue = defaultValue ?? (bipolar ? (min + max) / 2 : min + span / 2);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { startY: e.clientY, startValue: value };
  }, [disabled, value]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const fine = e.shiftKey ? 0.25 : 1;
    const delta = ((drag.startY - e.clientY) / 160) * span * fine;
    onChange(clamp(drag.startValue + delta, min, max));
  }, [onChange, min, max, span]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    dragRef.current = null;
    try { (e.target as Element).releasePointerCapture(e.pointerId); } catch { /* noop */ }
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (disabled) return;
    const step = span / 100 * (e.shiftKey ? 0.25 : 1.5);
    onChange(clamp(value + (e.deltaY < 0 ? step : -step), min, max));
  }, [disabled, onChange, value, min, max, span]);

  const valueText = displayValue
    ? displayValue(value)
    : Math.round(value * 10) / 10 + '';

  return (
    <div className={cn('sym-knob', bipolar && 'sym-knob--bipolar', size <= 36 && 'sym-knob--sm', className)}>
      <div
        className="sym-knob__dial"
        style={{ width: size, height: size }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        onDoubleClick={() => !disabled && onChange(resetValue)}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Math.round(value * 10) / 10}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          const step = span / 40;
          if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); onChange(clamp(value + step, min, max)); }
          if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); onChange(clamp(value - step, min, max)); }
        }}
      >
        <svg className="sym-knob__svg" width={size} height={size} viewBox="0 0 56 56">
          <defs>
            <radialGradient id={`knobMetal-${gradId}`} cx="38%" cy="30%" r="75%">
              <stop offset="0%" stopColor="#7c7c88" />
              <stop offset="42%" stopColor="#4b4b55" />
              <stop offset="78%" stopColor="#2a2a31" />
              <stop offset="100%" stopColor="#15151a" />
            </radialGradient>
            <radialGradient id={`knobCap-${gradId}`} cx="40%" cy="32%" r="70%">
              <stop offset="0%" stopColor="#5c5c67" />
              <stop offset="65%" stopColor="#34343c" />
              <stop offset="100%" stopColor="#202026" />
            </radialGradient>
          </defs>

          {/* ticks */}
          {Array.from({ length: 11 }).map((_, i) => {
            const t = i / 10;
            const a = START_ANGLE + t * SWEEP;
            const [x1, y1] = polar(center, center, 24.5, a);
            const [x2, y2] = polar(center, center, 21.5, a);
            return (
              <line
                key={i}
                x1={x1} y1={y1} x2={x2} y2={y2}
                className={cn('sym-knob__tick', bipolar && i === 5 && 'sym-knob__tick--center')}
              />
            );
          })}

          {/* value arc */}
          <path className="sym-knob__arc-bg" d={arcPath(center, center, 20, START_ANGLE, START_ANGLE + SWEEP)} />
          {norm > 0.005 && (
            <path
              className="sym-knob__arc-val"
              stroke={accent}
              style={{ color: accent }}
              d={bipolar
                ? arcPath(center, center, 20, Math.min(angle, START_ANGLE + SWEEP / 2), Math.max(angle, START_ANGLE + SWEEP / 2))
                : arcPath(center, center, 20, START_ANGLE, angle)}
            />
          )}

          {/* knob body */}
          <circle className="sym-knob__body" cx={center} cy={center} r={16} fill={`url(#knobMetal-${gradId})`} />
          <circle className="sym-knob__cap" cx={center} cy={center} r={10.5} fill={`url(#knobCap-${gradId})`} />
          <circle cx={center} cy={center} r={16} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth={0.8} />

          {/* pointer */}
          <line
            className="sym-knob__pointer"
            x1={center} y1={center - 4}
            x2={center} y2={center - 13}
            transform={`rotate(${angle} ${center} ${center})`}
          />
        </svg>
      </div>
      <span className="sym-knob__label">{label}</span>
      <span className="sym-knob__value">{valueText}</span>
    </div>
  );
}
