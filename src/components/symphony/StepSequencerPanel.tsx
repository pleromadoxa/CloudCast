import { useMemo, useState } from 'react';
import { Grid3x3, Plus, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { NoteEvent, Region, Track } from '../../types/symphony';
import { keyRootMidi, degreeToMidi, parseKey, type ScaleName } from '../../lib/symphony/musicTheory';
import { SymphonyButton } from './SymphonyButton';

const DRUM_ROWS: { label: string; pitch: number; color: string }[] = [
  { label: 'KICK', pitch: 36, color: '#f87171' },
  { label: 'SNARE', pitch: 38, color: '#fbbf24' },
  { label: 'CLAP', pitch: 39, color: '#fb923c' },
  { label: 'HAT', pitch: 42, color: '#38bdf8' },
  { label: 'OPEN', pitch: 46, color: '#a78bfa' },
  { label: 'PERC', pitch: 37, color: '#34d399' },
];

const STEPS = 16;
const STEP_BEAT = 0.25;

export interface StepSequencerPanelProps {
  track: Track | null;
  region: Region | null;
  projectKey: string;
  onNotesChange: (notes: NoteEvent[]) => void;
  onCreateRegion: () => void;
  className?: string;
}

type Accent = 55 | 85 | 110;
const ACCENTS: Accent[] = [55, 85, 110];

export function StepSequencerPanel({
  track, region, projectKey, onNotesChange, onCreateRegion, className,
}: StepSequencerPanelProps) {
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const isDrum = track?.instrumentId.startsWith('drums') || track?.instrumentId.startsWith('perc');
    if (isDrum || !track) return DRUM_ROWS;
    // Melodic tracks: scale degrees of the project key.
    const { mode } = parseKey(projectKey);
    const rootMidi = keyRootMidi(projectKey, 60);
    const scaleName: ScaleName = mode === 'major' ? 'major' : 'minor';
    return [0, 1, 2, 3, 4, 5].map((deg) => ({
      label: `D${deg + 1}`,
      pitch: degreeToMidi(rootMidi, scaleName, deg),
      color: '#38bdf8',
    }));
  }, [track, projectKey]);

  const notes = region?.notes ?? [];
  const pageCount = region?.lengthBars ?? 1;
  const safePage = Math.min(page, pageCount - 1);

  const noteAt = (rowPitch: number, step: number): NoteEvent | undefined => {
    const beat = safePage * 4 + step * STEP_BEAT;
    return notes.find((n) => n.pitch === rowPitch && Math.abs(n.startBeat - beat) < 0.01);
  };

  const toggleStep = (rowPitch: number, step: number, shift: boolean) => {
    if (!region) return;
    const beat = safePage * 4 + step * STEP_BEAT;
    const existing = noteAt(rowPitch, step);
    if (existing) {
      if (shift) {
        // Cycle accent: soft → normal → accent → soft.
        const idx = ACCENTS.reduce(
          (best, a, i) => (Math.abs(a - existing.velocity) < Math.abs(ACCENTS[best] - existing.velocity) ? i : best),
          0,
        );
        onNotesChange(notes.map((n) => (n === existing ? { ...n, velocity: ACCENTS[(idx + 1) % ACCENTS.length] } : n)));
      } else {
        onNotesChange(notes.filter((n) => n !== existing));
      }
      return;
    }
    const next: NoteEvent = {
      pitch: rowPitch,
      startBeat: beat,
      durationBeats: STEP_BEAT * 0.9,
      velocity: 85,
    };
    onNotesChange([...notes, next].sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch));
  };

  const fillRow = (rowPitch: number, everySteps: number, velocity: Accent) => {
    if (!region) return;
    const kept = notes.filter((n) => !(n.pitch === rowPitch && n.startBeat >= safePage * 4 && n.startBeat < safePage * 4 + 4));
    const added: NoteEvent[] = [];
    for (let s = 0; s < STEPS; s += everySteps) {
      added.push({ pitch: rowPitch, startBeat: safePage * 4 + s * STEP_BEAT, durationBeats: STEP_BEAT * 0.9, velocity });
    }
    onNotesChange([...kept, ...added].sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch));
  };

  const clearPage = () => {
    if (!region) return;
    onNotesChange(notes.filter((n) => !(n.startBeat >= safePage * 4 && n.startBeat < safePage * 4 + 4)));
  };

  return (
    <div className={cn('flex h-full flex-col gap-2 p-3', className)}>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200">
          <Grid3x3 className="h-3.5 w-3.5 text-emerald-300" /> Step Sequencer
        </div>
        <span className="text-[9px] text-white/45">
          {region ? `${region.name} · bar ${safePage + 1}/${pageCount}` : 'no region selected'}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {pageCount > 1 && (
            <div className="flex items-center gap-1">
              {Array.from({ length: pageCount }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPage(i)}
                  className={cn(
                    'h-5 w-5 rounded text-[9px] font-bold transition',
                    i === safePage ? 'bg-emerald-400/25 text-emerald-100' : 'bg-white/[0.05] text-white/45 hover:bg-white/10',
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
          <SymphonyButton variant="toggle" accent="green" onClick={() => fillRow(42, 2, 85)} title="Fill hats on 8ths">HATS 8TH</SymphonyButton>
          <SymphonyButton variant="toggle" accent="amber" onClick={() => fillRow(38, 8, 110)} title="Backbeat snare">BACKBEAT</SymphonyButton>
          <SymphonyButton variant="toggle" accent="red" onClick={clearPage}>CLEAR</SymphonyButton>
          {!region && (
            <SymphonyButton variant="default" accent="violet" onClick={onCreateRegion}>
              <Plus className="h-3 w-3" /> NEW PATTERN
            </SymphonyButton>
          )}
        </div>
      </div>

      {/* Grid */}
      {region ? (
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-1 overflow-auto">
          {/* Beat ruler */}
          <div className="flex items-center gap-1 pl-12">
            {Array.from({ length: STEPS }, (_, s) => (
              <div
                key={s}
                className={cn(
                  'h-3 w-8 text-center text-[7px] font-bold leading-3',
                  s % 4 === 0 ? 'text-white/70' : s % 2 === 0 ? 'text-white/35' : 'text-white/15',
                )}
              >
                {s % 4 === 0 ? s / 4 + 1 : '·'}
              </div>
            ))}
          </div>
          {rows.map((row) => (
            <div key={row.pitch} className="flex items-center gap-1">
              <div className="flex w-11 shrink-0 items-center justify-end gap-1">
                <span className="text-[8px] font-bold tracking-wider" style={{ color: row.color }}>{row.label}</span>
              </div>
              {Array.from({ length: STEPS }, (_, s) => {
                const note = noteAt(row.pitch, s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={(e) => toggleStep(row.pitch, s, e.shiftKey)}
                    title={`${row.label} step ${s + 1}${note ? ` · vel ${note.velocity}` : ''}${note ? ' (shift-click: accent)' : ''}`}
                    className={cn(
                      'h-8 w-8 rounded-sm border transition-all duration-75',
                      s % 4 === 0 ? 'border-white/15' : 'border-white/[0.06]',
                      note
                        ? 'shadow-[inset_0_-3px_0_rgba(0,0,0,0.35)]'
                        : 'bg-white/[0.035] hover:bg-white/[0.09]',
                    )}
                    style={note ? {
                      backgroundColor: row.color,
                      opacity: 0.45 + (note.velocity / 127) * 0.55,
                    } : undefined}
                  />
                );
              })}
            </div>
          ))}
          <p className="mt-1 text-center text-[8px] text-white/35">
            Click: toggle step · Shift-click: cycle velocity accent (soft / normal / accent)
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-white/35">
          <Trash2 className="h-5 w-5 opacity-40" />
          <p className="text-[11px]">Select a region — or create a pattern region on the armed track.</p>
        </div>
      )}
    </div>
  );
}
