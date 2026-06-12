import type { NoteEvent, Region } from '../../types/symphony';

/** Apply region transpose and gain to a note for playback. */
export function applyRegionNoteTransform(note: NoteEvent, region: Region): NoteEvent {
  const transpose = region.transpose ?? 0;
  const gain = region.gain ?? 100;
  return {
    ...note,
    pitch: Math.max(0, Math.min(127, note.pitch + transpose)),
    velocity: Math.min(127, Math.round(note.velocity * (gain / 100))),
  };
}

/** Time-stretch note timing when loop BPM differs from project tempo. */
export function stretchPatternToTempo(notes: NoteEvent[], fromBpm: number, toBpm: number): NoteEvent[] {
  if (fromBpm === toBpm || fromBpm <= 0) return notes.map((n) => ({ ...n }));
  const ratio = fromBpm / toBpm;
  return notes.map((n) => ({
    ...n,
    startBeat: n.startBeat * ratio,
    durationBeats: n.durationBeats * ratio,
  }));
}

/** Snap notes to a rhythmic grid (in beats). */
export function quantizeNotes(notes: NoteEvent[], grid = 0.25): NoteEvent[] {
  return notes.map((n) => ({
    ...n,
    startBeat: Math.round(n.startBeat / grid) * grid,
    durationBeats: Math.max(grid, Math.round(n.durationBeats / grid) * grid),
  }));
}

export function transposeNotes(notes: NoteEvent[], semitones: number): NoteEvent[] {
  return notes.map((n) => ({
    ...n,
    pitch: Math.max(0, Math.min(127, n.pitch + semitones)),
  }));
}

/** Humanize timing and velocity slightly. */
export function humanizeNotes(notes: NoteEvent[], amount = 0.08): NoteEvent[] {
  return notes.map((n) => ({
    ...n,
    startBeat: n.startBeat + (Math.random() - 0.5) * amount,
    velocity: Math.min(127, Math.max(1, n.velocity + Math.round((Math.random() - 0.5) * 20))),
  }));
}
