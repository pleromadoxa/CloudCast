import { useCallback, useState } from 'react';
import { Pencil, SlidersHorizontal } from 'lucide-react';
import type { SymphonyProject, Track, TrackFx } from '../../types/symphony';
import { defaultTrackFx, normalizeTrackFx } from '../../types/symphony';
import { trackLanes } from '../../lib/symphony/automationSchedule';
import { cn } from '../../lib/utils';
import { HardwareKnob } from './hardware/HardwareKnob';
import { HardwareFader } from './hardware/HardwareFader';
import { StereoVuMeter } from './hardware/PeakVuMeter';
import { TRACK_COLORS, TRACK_COLOR_MAP } from './symphonyTheme';

export interface MixerConsoleProps {
  project: SymphonyProject;
  tracks: Track[];
  selectedTrackId: string | null;
  meterLevels: Record<string, number>;
  meterPeaks: Record<string, number>;
  masterMeter: { level: number; peak: number };
  limiterReductionDb: number;
  playing: boolean;
  onSelectTrack: (id: string) => void;
  onTrackChange: (id: string, patch: Partial<Track>) => void;
  onProjectChange: (patch: Partial<SymphonyProject>) => void;
  onOpenFxRack?: (trackId: string) => void;
}

type InsertKind = 'eq' | 'comp' | 'filter' | 'chorus' | 'drive';

const INSERT_LABELS: Record<InsertKind, string> = {
  eq: 'EQ 3-BAND',
  comp: 'COMP',
  filter: 'FILTER',
  chorus: 'CHORUS',
  drive: 'DRIVE',
};

function insertActive(kind: InsertKind, fx: TrackFx): boolean {
  switch (kind) {
    case 'eq':
      return fx.eq.low !== 0 || fx.eq.mid !== 0 || fx.eq.high !== 0;
    case 'comp':
      return fx.comp.enabled;
    case 'filter':
      return fx.filter.enabled;
    case 'chorus':
      return fx.chorus.enabled;
    case 'drive':
      return fx.drive > 0;
  }
}

function toggleInsert(kind: InsertKind, fx: TrackFx): TrackFx {
  const next = normalizeTrackFx(fx);
  const active = insertActive(kind, fx);
  const defaults = defaultTrackFx();
  switch (kind) {
    case 'eq':
      next.eq = active ? { ...defaults.eq } : { ...defaults.eq, low: 1.5, high: 1.5 };
      break;
    case 'comp':
      next.comp = { ...next.comp, enabled: !active };
      break;
    case 'filter':
      next.filter = { ...next.filter, enabled: !active };
      break;
    case 'chorus':
      next.chorus = { ...next.chorus, enabled: !active };
      break;
    case 'drive':
      next.drive = active ? 0 : 18;
      break;
  }
  return next;
}

const dbFromPercent = (v: number): string => {
  if (v <= 0) return '−∞ dB';
  const db = 20 * Math.log10(v / 100);
  return `${db > 0 ? '+' : ''}${db.toFixed(1)} dB`;
};

const panDisplay = (v: number): string => (v > 0 ? `R${Math.round(v)}` : v < 0 ? `L${Math.round(-v)}` : 'C');

export function MixerConsole({
  project, tracks, selectedTrackId, meterLevels, meterPeaks,
  masterMeter, limiterReductionDb, playing,
  onSelectTrack, onTrackChange, onProjectChange, onOpenFxRack,
}: MixerConsoleProps) {
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [paletteFor, setPaletteFor] = useState<string | null>(null);

  const patchFx = useCallback((track: Track, mutate: (fx: TrackFx) => TrackFx) => {
    onTrackChange(track.id, { fx: mutate(normalizeTrackFx(track.fx)) });
  }, [onTrackChange]);

  const commitRename = useCallback(() => {
    if (renaming && renaming.value.trim()) {
      onTrackChange(renaming.id, { name: renaming.value.trim() });
    }
    setRenaming(null);
  }, [renaming, onTrackChange]);

  const masterEq = project.masterEq ?? { low: 0, mid: 0, high: 0, midFreq: 1000 };

  return (
    <div className="sym-console sym-grain relative">
      {tracks.map((track) => {
        const colors = TRACK_COLOR_MAP[track.color];
        const fx = normalizeTrackFx(track.fx);
        const selected = track.id === selectedTrackId;
        return (
          <div
            key={track.id}
            className={cn('sym-strip sym-grain relative', selected && 'sym-strip--selected')}
            onMouseDown={() => onSelectTrack(track.id)}
          >
            <div className="flex w-full items-center justify-between px-1">
              <div className="relative">
                <button
                  type="button"
                  className={cn('h-1.5 w-8 cursor-pointer rounded-full transition-transform hover:scale-y-150', colors.stripe)}
                  title="Track color"
                  onClick={(e) => { e.stopPropagation(); setPaletteFor(paletteFor === track.id ? null : track.id); }}
                />
                {paletteFor === track.id && (
                  <div className="sym-color-pop" onClick={(e) => e.stopPropagation()}>
                    {TRACK_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={cn('sym-color-pop__dot', TRACK_COLOR_MAP[c].stripe, track.color === c && 'sym-color-pop__dot--active')}
                        onClick={() => { onTrackChange(track.id, { color: c }); setPaletteFor(null); }}
                        aria-label={`Set color ${c}`}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                {trackLanes(track).length > 0 && (
                  <span className="sym-pro-chip sym-pro-chip--gold" title="Track has automation lanes">AUTO</span>
                )}
                <span className="sym-knob__label">{String(track.index).padStart(2, '0')}</span>
              </div>
            </div>

            {renaming?.id === track.id ? (
              <input
                autoFocus
                className="sym-strip__label-input"
                value={renaming.value}
                onChange={(e) => setRenaming({ id: track.id, value: e.target.value })}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setRenaming(null);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div
                className={cn('sym-strip__label', colors.bg, colors.border)}
                title="Double-click to rename"
                onDoubleClick={(e) => { e.stopPropagation(); setRenaming({ id: track.id, value: track.name }); }}
              >
                {track.name}
              </div>
            )}

            <div className="flex w-full items-center justify-between px-0.5">
              <span className="sym-knob__label">Inserts</span>
              <button
                type="button"
                className="text-white/35 transition-colors hover:text-violet-300"
                title="Open FX rack for this channel"
                onClick={(e) => { e.stopPropagation(); onOpenFxRack?.(track.id); }}
              >
                <Pencil className="h-2.5 w-2.5" />
              </button>
            </div>

            <div className="sym-strip__inserts">
              {(Object.keys(INSERT_LABELS) as InsertKind[]).map((kind) => {
                const active = insertActive(kind, fx);
                return (
                  <button
                    key={kind}
                    type="button"
                    className={cn('sym-insert-slot', active && 'sym-insert-slot--on')}
                    title={`${INSERT_LABELS[kind]} — click to ${active ? 'bypass' : 'engage'}`}
                    onClick={() => patchFx(track, (f) => toggleInsert(kind, f))}
                  >
                    <span className={cn('sym-insert-led', active && 'sym-insert-led--on')} />
                    {INSERT_LABELS[kind]}
                  </button>
                );
              })}
            </div>

            <HardwareKnob
              value={track.pan}
              min={-100}
              max={100}
              bipolar
              size={38}
              label="Pan"
              displayValue={panDisplay}
              defaultValue={0}
              accent="#38bdf8"
              onChange={(pan) => onTrackChange(track.id, { pan })}
            />

            <div className="sym-strip__row">
              <HardwareKnob
                value={track.reverbSend ?? 0}
                min={0}
                max={100}
                size={32}
                label="Rev"
                displayValue={(v) => `${Math.round(v)}%`}
                defaultValue={0}
                accent="#a78bfa"
                onChange={(reverbSend) => onTrackChange(track.id, { reverbSend })}
              />
              <HardwareKnob
                value={track.delaySend ?? 0}
                min={0}
                max={100}
                size={32}
                label="Dly"
                displayValue={(v) => `${Math.round(v)}%`}
                defaultValue={0}
                accent="#22d3ee"
                onChange={(delaySend) => onTrackChange(track.id, { delaySend })}
              />
            </div>

            <div className="sym-strip__row">
              <HardwareKnob
                value={fx.drive}
                min={0}
                max={100}
                size={32}
                label="Drive"
                displayValue={(v) => `${Math.round(v)}%`}
                defaultValue={0}
                accent="#fb923c"
                onChange={(drive) => patchFx(track, (f) => ({ ...f, drive }))}
              />
              <HardwareKnob
                value={fx.eq.midFreq}
                min={200}
                max={5000}
                size={32}
                label="Mid Hz"
                displayValue={(v) => `${Math.round(v)} Hz`}
                defaultValue={1000}
                accent="#fbbf24"
                onChange={(midFreq) => patchFx(track, (f) => ({ ...f, eq: { ...f.eq, midFreq } }))}
              />
            </div>

            <div className="sym-strip__btns">
              <button
                type="button"
                className={cn('sym-msr', track.muted && 'sym-msr--mute')}
                onClick={() => onTrackChange(track.id, { muted: !track.muted })}
                title="Mute"
              >
                M
              </button>
              <button
                type="button"
                className={cn('sym-msr', track.solo && 'sym-msr--solo')}
                onClick={() => onTrackChange(track.id, { solo: !track.solo })}
                title="Solo"
              >
                S
              </button>
              <button
                type="button"
                className={cn('sym-msr', track.armed && 'sym-msr--arm')}
                onClick={() => onTrackChange(track.id, { armed: !track.armed })}
                title="Record arm"
              >
                R
              </button>
            </div>

            <div className="flex items-end gap-2">
              <HardwareFader
                value={track.volume}
                min={0}
                max={100}
                height={132}
                displayValue={dbFromPercent}
                onChange={(volume) => onTrackChange(track.id, { volume })}
              />
              <div className="flex flex-col items-center gap-1 pb-6">
                <StereoVuMeter
                  left={meterLevels[track.id] ?? 0}
                  right={(meterLevels[track.id] ?? 0) * 0.92}
                  leftPeak={meterPeaks[track.id] ?? 0}
                  rightPeak={(meterPeaks[track.id] ?? 0) * 0.92}
                  segments={14}
                  height={118}
                />
              </div>
            </div>
          </div>
        );
      })}

      {/* ── Master strip ── */}
      <div className="sym-strip sym-strip--master sym-grain relative">
        <div className="flex w-full items-center justify-between px-1">
          <SlidersHorizontal className="h-3 w-3 text-violet-300/70" />
          <span className="sym-pro-chip sym-pro-chip--gold">MASTER</span>
        </div>

        <div className="sym-strip__label" style={{ background: 'linear-gradient(180deg,#3b2a6b,#241545)', color: '#e8e2ff' }}>
          MAIN OUT
        </div>

        <div className="sym-strip__row">
          <HardwareKnob
            value={masterEq.low}
            min={-15}
            max={15}
            bipolar
            size={32}
            label="Low"
            displayValue={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`}
            defaultValue={0}
            accent="#4be07c"
            onChange={(low) => onProjectChange({ masterEq: { ...masterEq, low } })}
          />
          <HardwareKnob
            value={masterEq.mid}
            min={-15}
            max={15}
            bipolar
            size={32}
            label="Mid"
            displayValue={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`}
            defaultValue={0}
            accent="#ffcf4a"
            onChange={(mid) => onProjectChange({ masterEq: { ...masterEq, mid } })}
          />
          <HardwareKnob
            value={masterEq.high}
            min={-15}
            max={15}
            bipolar
            size={32}
            label="High"
            displayValue={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`}
            defaultValue={0}
            accent="#38bdf8"
            onChange={(high) => onProjectChange({ masterEq: { ...masterEq, high } })}
          />
        </div>

        <div className="sym-strip__row">
          <HardwareKnob
            value={project.masterDrive ?? 0}
            min={0}
            max={100}
            size={32}
            label="Drive"
            displayValue={(v) => `${Math.round(v)}%`}
            defaultValue={0}
            accent="#fb923c"
            onChange={(masterDrive) => onProjectChange({ masterDrive })}
          />
          <HardwareKnob
            value={project.limiterThreshold ?? -18}
            min={-36}
            max={0}
            size={32}
            label="Limit"
            displayValue={(v) => `${v.toFixed(0)} dB`}
            defaultValue={-18}
            accent="#ff5f56"
            onChange={(limiterThreshold) => onProjectChange({ limiterThreshold })}
          />
        </div>

        <div className="flex w-full items-center justify-center gap-2">
          <button
            type="button"
            className={cn('sym-msr', project.limiterEnabled !== false && 'sym-msr--solo')}
            onClick={() => onProjectChange({ limiterEnabled: project.limiterEnabled === false })}
            title="Master limiter"
          >
            LIM
          </button>
          <div className="sym-master-reduction">
            GR {limiterReductionDb < -0.05 ? limiterReductionDb.toFixed(1) : '0.0'} dB
          </div>
        </div>

        <div className="flex items-end gap-2">
          <HardwareFader
            value={project.masterVolume ?? 85}
            min={0}
            max={100}
            height={150}
            displayValue={dbFromPercent}
            onChange={(masterVolume) => onProjectChange({ masterVolume })}
          />
          <div className="flex flex-col items-center gap-1 pb-6">
            <StereoVuMeter
              left={masterMeter.level}
              right={masterMeter.level * 0.94}
              leftPeak={masterMeter.peak}
              rightPeak={masterMeter.peak * 0.94}
              segments={16}
              height={136}
            />
          </div>
        </div>

        <div className={cn(
          'sym-lcd-pro w-full px-2 py-1 text-center text-[9px] tracking-widest',
          playing && 'sym-lcd-pro--amber',
        )}>
          {playing ? '● SIGNAL FLOW ACTIVE' : '○ ENGINE IDLE'}
        </div>
      </div>
    </div>
  );
}
