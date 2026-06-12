import type { NoteEvent, Region } from '../../types/symphony';
import { BEATS_PER_BAR } from './dragTypes';

export function splitRegion(region: Region, atBar: number): [Region, Region] | null {
  const splitPoint = atBar - region.startBar;
  if (splitPoint <= 0 || splitPoint >= region.lengthBars) return null;

  const notes = region.notes ?? [];
  const splitBeat = splitPoint * BEATS_PER_BAR;

  const leftNotes: NoteEvent[] = [];
  const rightNotes: NoteEvent[] = [];

  for (const note of notes) {
    const noteEnd = note.startBeat + note.durationBeats;
    if (noteEnd <= splitBeat) {
      leftNotes.push({ ...note });
    } else if (note.startBeat >= splitBeat) {
      rightNotes.push({ ...note, startBeat: note.startBeat - splitBeat });
    } else {
      leftNotes.push({ ...note, durationBeats: splitBeat - note.startBeat });
      rightNotes.push({
        ...note,
        startBeat: 0,
        durationBeats: noteEnd - splitBeat,
      });
    }
  }

  const left: Region = {
    ...region,
    id: crypto.randomUUID(),
    lengthBars: splitPoint,
    notes: leftNotes,
    name: `${region.name} (A)`,
  };
  const right: Region = {
    ...region,
    id: crypto.randomUUID(),
    startBar: atBar,
    lengthBars: region.lengthBars - splitPoint,
    notes: rightNotes,
    name: `${region.name} (B)`,
  };
  return [left, right];
}

export function joinRegions(a: Region, b: Region): Region | null {
  if (a.trackId !== b.trackId) return null;
  const aEnd = a.startBar + a.lengthBars;
  if (b.startBar !== aEnd) return null;

  const offsetBeats = a.lengthBars * BEATS_PER_BAR;
  const mergedNotes = [
    ...(a.notes ?? []),
    ...(b.notes ?? []).map((n) => ({ ...n, startBeat: n.startBeat + offsetBeats })),
  ];

  return {
    ...a,
    id: crypto.randomUUID(),
    lengthBars: a.lengthBars + b.lengthBars,
    notes: mergedNotes,
    name: a.name.replace(/ \(A\)$/, '').replace(/ \(B\)$/, ''),
  };
}

export function trimRegion(region: Region, newStartBar: number, newLengthBars: number): Region {
  const deltaBars = newStartBar - region.startBar;
  const deltaBeats = deltaBars * BEATS_PER_BAR;
  const maxBeats = newLengthBars * BEATS_PER_BAR;

  const notes = (region.notes ?? [])
    .map((n) => ({ ...n, startBeat: n.startBeat - deltaBeats }))
    .filter((n) => n.startBeat >= 0 && n.startBeat < maxBeats)
    .map((n) => ({
      ...n,
      durationBeats: Math.min(n.durationBeats, maxBeats - n.startBeat),
    }));

  return {
    ...region,
    startBar: newStartBar,
    lengthBars: Math.max(0.25, newLengthBars),
    notes,
  };
}

export function duplicateRegion(region: Region, offsetBars = region.lengthBars): Region {
  return {
    ...region,
    id: crypto.randomUUID(),
    startBar: region.startBar + offsetBars,
    name: `${region.name} copy`,
    notes: region.notes?.map((n) => ({ ...n })),
  };
}

export function regionsOverlap(a: Region, b: Region): boolean {
  if (a.trackId !== b.trackId || a.id === b.id) return false;
  const aEnd = a.startBar + a.lengthBars;
  const bEnd = b.startBar + b.lengthBars;
  return a.startBar < bEnd && b.startBar < aEnd;
}
