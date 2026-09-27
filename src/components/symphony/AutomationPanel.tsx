import { useEffect, useMemo, useRef, useState } from 'react';
import type { AutomationLane, AutomationParam, AutomationPoint, Track } from '../../types/symphony';
import { staticParamValue } from '../../lib/symphony/automationSchedule';
import { cn } from '../../lib/utils';
import { SymphonyButton } from './SymphonyButton';
import { ToggleSwitch } from './hardware/LcdPanel';

interface AutomationPanelProps {
  track: Track | null;
  totalBars: number;
  playheadBeat: number;
  onUpsertPoint: (trackId: string, param: AutomationParam, bar: number, beat: number, value: number) => void;
  onRemovePoint: (trackId: string, param: AutomationParam, bar: number, beat: number) => void;
  onSetLaneEnabled: (trackId: string, param: AutomationParam, enabled: boolean) => void;
  onClearLane: (trackId: string, param: AutomationParam) => void;
}

interface ParamDef {
  param: AutomationParam;
  label: string;
  min: number;
  max: number;
  accent: string;
}

const PARAM_DEFS: ParamDef[] = [
  { param: 'volume', label: 'VOLUME', min: 0, max: 100, accent: 'text-emerald-300' },
  { param: 'pan', label: 'PAN', min: -100, max: 100, accent: 'text-sky-300' },
  { param: 'reverbSend', label: 'REVERB', min: 0, max: 100, accent: 'text-violet-300' },
  { param: 'delaySend', label: 'DELAY', min: 0, max: 100, accent: 'text-amber-300' },
];

const CURVE_H = 150;
const PAD_X = 10;
const PAD_Y = 12;

function formatValue(param: AutomationParam, value: number): string {
  if (param === 'pan') {
    if (Math.abs(value) < 2) return 'C';
    return value < 0 ? `L${Math.round(-value)}` : `R${Math.round(value)}`;
  }
  return `${Math.round(value)}%`;
}

function pointsKey(p: AutomationPoint): string {
  return `${p.bar}:${p.beat.toFixed(2)}`;
}

export function AutomationPanel({
  track, totalBars, playheadBeat, onUpsertPoint, onRemovePoint, onSetLaneEnabled, onClearLane,
}: AutomationPanelProps) {
  const [param, setParam] = useState<AutomationParam>('volume');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [width, setWidth] = useState(640);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const def = PARAM_DEFS.find((d) => d.param === param) ?? PARAM_DEFS[0];
  const lane: AutomationLane | null = useMemo(() => {
    if (!track) return null;
    return track.automationLanes?.find((l) => l.param === param) ?? { param, points: [], enabled: true };
  }, [track, param]);

  const points = useMemo(
    () => [...(lane?.points ?? [])].sort((a, b) => a.bar * 4 + a.beat - (b.bar * 4 + b.beat)),
    [lane],
  );
  const laneEnabled = lane?.enabled !== false;
  const totalBeats = Math.max(4, totalBars * 4);

  const xFor = (beat: number) => PAD_X + (beat / totalBeats) * (width - PAD_X * 2);
  const yFor = (value: number) => {
    const t = (value - def.min) / (def.max - def.min);
    return PAD_Y + (1 - t) * (CURVE_H - PAD_Y * 2);
  };
  const beatAtX = (x: number) => {
    const t = (x - PAD_X) / Math.max(1, width - PAD_X * 2);
    return Math.max(0, Math.min(totalBeats, Math.round(t * totalBeats * 4) / 4));
  };
  const valueAtY = (y: number) => {
    const t = 1 - (y - PAD_Y) / (CURVE_H - PAD_Y * 2);
    return Math.round(def.min + Math.max(0, Math.min(1, t)) * (def.max - def.min));
  };

  const selected = points.find((p) => pointsKey(p) === selectedKey) ?? null;

  const handleGridPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!track) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const beat = beatAtX(e.clientX - rect.left);
    const value = valueAtY(e.clientY - rect.top);
    const bar = Math.floor(beat / 4);
    onUpsertPoint(track.id, param, bar, beat - bar * 4, value);
    setSelectedKey(`${bar}:${(beat - bar * 4).toFixed(2)}`);
  };

  const handleDeleteSelected = () => {
    if (!track || !selected) return;
    onRemovePoint(track.id, param, selected.bar, selected.beat);
    setSelectedKey(null);
  };

  const handleAddAtPlayhead = () => {
    if (!track) return;
    const bar = Math.floor(playheadBeat / 4);
    const beat = playheadBeat - bar * 4;
    const value = Math.round(staticParamValue(track, param));
    onUpsertPoint(track.id, param, bar, beat, value);
    setSelectedKey(`${bar}:${beat.toFixed(2)}`);
  };

  const nudgeSelected = (dBeat: number, dValue: number) => {
    if (!track || !selected) return;
    const beat = Math.max(0, Math.min(3.75, selected.beat + dBeat));
    const value = Math.max(def.min, Math.min(def.max, selected.value + dValue));
    onRemovePoint(track.id, param, selected.bar, selected.beat);
    onUpsertPoint(track.id, param, selected.bar, beat, value);
    setSelectedKey(`${selected.bar}:${beat.toFixed(2)}`);
  };

  // Polyline path with held edges (clamped curve look).
  const polyline = useMemo(() => {
    if (points.length === 0) return '';
    const pts = [
      { beat: 0, value: points[0].value },
      ...points.map((p) => ({ beat: p.bar * 4 + p.beat, value: p.value })),
      { beat: totalBeats, value: points[points.length - 1].value },
    ];
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(p.beat).toFixed(1)},${yFor(p.value).toFixed(1)}`).join(' ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, width, def, totalBeats]);

  return (
    <div className="sym-panel sym-grain flex min-h-0 flex-1 flex-col">
      <div className="sym-panel__header">
        <span>
          Automation
          <span className="ml-2 text-white/40">{track ? track.name : 'No track selected'}</span>
        </span>
        <div className="flex items-center gap-1">
          <SymphonyButton variant="toggle" accent="violet" onClick={handleAddAtPlayhead} disabled={!track} className="!min-h-0 px-2 py-0.5 text-[8px]">
            + AT PLAYHEAD
          </SymphonyButton>
          <SymphonyButton variant="toggle" accent="red" onClick={() => track && onClearLane(track.id, param)} disabled={!track || points.length === 0} className="!min-h-0 px-2 py-0.5 text-[8px]">
            CLEAR
          </SymphonyButton>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-3 p-3">
        {/* Curve editor */}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-1.5">
            {PARAM_DEFS.map((d) => {
              const lanePts = track?.automationLanes?.find((l) => l.param === d.param);
              return (
                <button
                  key={d.param}
                  type="button"
                  className={cn('sym-chip', param === d.param && 'sym-chip--active')}
                  onClick={() => { setParam(d.param); setSelectedKey(null); }}
                >
                  <span className={cn('mr-1 inline-block h-1.5 w-1.5 rounded-full', lanePts?.points.length ? 'bg-emerald-400' : 'bg-white/20')} />
                  {d.label}
                </button>
              );
            })}
            <div className="ml-auto flex items-center gap-2">
              <span className={cn('text-[8px] font-semibold tracking-widest', def.accent)}>READ</span>
              <ToggleSwitch
                label="Lane read"
                checked={laneEnabled}
                onChange={(v) => track && onSetLaneEnabled(track.id, param, v)}
              />
            </div>
          </div>

          <div ref={wrapRef} className="sym-auto-canvas">
            <svg
              width={width}
              height={CURVE_H}
              className="block cursor-crosshair"
              onPointerDown={handleGridPointerDown}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); handleDeleteSelected(); }
                else if (selected && e.key === 'ArrowLeft') { e.preventDefault(); nudgeSelected(-0.25, 0); }
                else if (selected && e.key === 'ArrowRight') { e.preventDefault(); nudgeSelected(0.25, 0); }
                else if (selected && e.key === 'ArrowUp') { e.preventDefault(); nudgeSelected(0, 1); }
                else if (selected && e.key === 'ArrowDown') { e.preventDefault(); nudgeSelected(0, -1); }
              }}
            >
              {/* Bar grid */}
              {Array.from({ length: Math.min(totalBars, 64) }).map((_, i) => (
                <line
                  key={i}
                  x1={xFor(i * 4)} x2={xFor(i * 4)} y1={PAD_Y - 6} y2={CURVE_H - PAD_Y + 6}
                  stroke="rgba(255,255,255,0.07)" strokeWidth={1}
                />
              ))}
              {/* Center / zero line */}
              <line
                x1={PAD_X} x2={width - PAD_X} y1={yFor(def.param === 'pan' ? 0 : (def.min + def.max) / 2)} y2={yFor(def.param === 'pan' ? 0 : (def.min + def.max) / 2)}
                stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" strokeWidth={1}
              />
              {/* Static value reference */}
              {track && (
                <line
                  x1={PAD_X} x2={width - PAD_X} y1={yFor(staticParamValue(track, param))} y2={yFor(staticParamValue(track, param))}
                  stroke="rgba(139,92,246,0.35)" strokeDasharray="2 4" strokeWidth={1}
                />
              )}
              {polyline && <path d={polyline} fill="none" stroke={laneEnabled ? '#34d399' : 'rgba(255,255,255,0.35)'} strokeWidth={2} />}
              {points.map((p) => {
                const key = pointsKey(p);
                const isSel = key === selectedKey;
                return (
                  <circle
                    key={key}
                    cx={xFor(p.bar * 4 + p.beat)}
                    cy={yFor(p.value)}
                    r={isSel ? 6 : 4}
                    fill={isSel ? '#a78bfa' : laneEnabled ? '#34d399' : '#9ca3af'}
                    stroke="#0b0f1a"
                    strokeWidth={1.5}
                    className="cursor-pointer"
                    onPointerDown={(e) => { e.stopPropagation(); setSelectedKey(key); }}
                  />
                );
              })}
            </svg>
            {points.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] text-white/40">
                Click the grid to draw the {def.label.toLowerCase()} curve · arrows nudge · ⌫ deletes
              </div>
            )}
          </div>
        </div>

        {/* Point list */}
        <div className="sym-auto-points">
          <div className="sym-lcd-pro__label mb-1.5">Points · {points.length}</div>
          <div className="flex max-h-[190px] flex-col gap-1 overflow-y-auto pr-1">
            {points.length === 0 && (
              <div className="py-4 text-center text-[9px] text-white/35">No points yet</div>
            )}
            {points.map((p) => {
              const key = pointsKey(p);
              return (
                <div
                  key={key}
                  className={cn('sym-auto-point', key === selectedKey && 'sym-auto-point--selected')}
                  onClick={() => setSelectedKey(key)}
                >
                  <span className="w-12 text-[9px] tabular-nums text-white/70">
                    {p.bar + 1}.{Math.floor(p.beat * 4) + 1}
                  </span>
                  <input
                    type="range"
                    min={def.min}
                    max={def.max}
                    value={p.value}
                    className="sym-fader flex-1"
                    onChange={(e) => {
                      if (!track) return;
                      onUpsertPoint(track.id, param, p.bar, p.beat, Number(e.target.value));
                    }}
                  />
                  <span className={cn('w-9 text-right text-[9px] tabular-nums', def.accent)}>{formatValue(param, p.value)}</span>
                  <button
                    type="button"
                    className="text-white/40 transition-colors hover:text-red-400"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (track) onRemovePoint(track.id, param, p.bar, p.beat);
                    }}
                    aria-label="Delete point"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
          {selected && (
            <div className="mt-2 flex items-center gap-1">
              <SymphonyButton variant="ms" accent="neutral" onClick={() => nudgeSelected(-0.25, 0)} className="!h-5 px-1.5 text-[8px]">◀</SymphonyButton>
              <SymphonyButton variant="ms" accent="neutral" onClick={() => nudgeSelected(0.25, 0)} className="!h-5 px-1.5 text-[8px]">▶</SymphonyButton>
              <SymphonyButton variant="ms" accent="neutral" onClick={() => nudgeSelected(0, 1)} className="!h-5 px-1.5 text-[8px]">▲</SymphonyButton>
              <SymphonyButton variant="ms" accent="neutral" onClick={() => nudgeSelected(0, -1)} className="!h-5 px-1.5 text-[8px]">▼</SymphonyButton>
              <SymphonyButton variant="ms" accent="red" onClick={handleDeleteSelected} className="!h-5 px-1.5 text-[8px]">DEL</SymphonyButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
