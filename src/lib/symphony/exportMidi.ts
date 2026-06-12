import type { SymphonyProject } from '../../types/symphony';
import { applyRegionNoteTransform } from './noteUtils';
import { downloadBlob } from './exportMixdown';

const TICKS_PER_BEAT = 480;

interface MidiEvent {
  tick: number;
  type: 'noteOn' | 'noteOff';
  channel: number;
  pitch: number;
  velocity: number;
}

function varLen(value: number): number[] {
  const buffer: number[] = [value & 0x7f];
  let v = value >> 7;
  while (v > 0) {
    buffer.unshift((v & 0x7f) | 0x80);
    v >>= 7;
  }
  return buffer;
}

function u32(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

function u16(n: number): number[] {
  return [(n >> 8) & 0xff, n & 0xff];
}

function strBytes(s: string): number[] {
  return [...s].map((c) => c.charCodeAt(0));
}

function collectTrackEvents(trackId: string, regions: SymphonyProject['regions'], channel: number): MidiEvent[] {
  const events: MidiEvent[] = [];

  for (const region of regions.filter((r) => r.trackId === trackId)) {
    if (region.muted) continue;
    const stretch = region.stretchFactor ?? 1;
    for (const raw of region.notes ?? []) {
      const note = applyRegionNoteTransform(raw, region);
      const startBeat = region.startBar * 4 + raw.startBeat * stretch;
      const endBeat = startBeat + raw.durationBeats * stretch;
      events.push({
        tick: Math.round(startBeat * TICKS_PER_BEAT),
        type: 'noteOn',
        channel,
        pitch: note.pitch,
        velocity: note.velocity,
      });
      events.push({
        tick: Math.round(endBeat * TICKS_PER_BEAT),
        type: 'noteOff',
        channel,
        pitch: note.pitch,
        velocity: 0,
      });
    }
  }

  events.sort((a, b) => a.tick - b.tick || (a.type === 'noteOff' ? 1 : -1));
  return events;
}

function buildTrackChunk(events: MidiEvent[], trackName: string): Uint8Array {
  const data: number[] = [];
  let lastTick = 0;

  data.push(...varLen(0), 0xff, 0x03, ...varLen(trackName.length), ...strBytes(trackName));

  for (const ev of events) {
    const delta = ev.tick - lastTick;
    lastTick = ev.tick;
    data.push(...varLen(Math.max(0, delta)));
    if (ev.type === 'noteOn') {
      data.push(0x90 | ev.channel, ev.pitch & 0x7f, ev.velocity & 0x7f);
    } else {
      data.push(0x80 | ev.channel, ev.pitch & 0x7f, 0);
    }
  }

  data.push(...varLen(0), 0xff, 0x2f, 0x00);
  return new Uint8Array([...strBytes('MTrk'), ...u32(data.length), ...data]);
}

/** Export Symphony project as Standard MIDI File (Type 1). */
export function renderProjectToMidi(project: SymphonyProject): Blob {
  const tempo = Math.round(60000000 / project.tempo);
  const trackChunks: Uint8Array[] = [];

  {
    const data: number[] = [];
    data.push(...varLen(0), 0xff, 0x03, ...varLen(project.name.length), ...strBytes(project.name));
    data.push(...varLen(0), 0xff, 0x51, ...varLen(3), (tempo >> 16) & 0xff, (tempo >> 8) & 0xff, tempo & 0xff);
    data.push(...varLen(0), 0xff, 0x2f, 0x00);
    trackChunks.push(new Uint8Array([...strBytes('MTrk'), ...u32(data.length), ...data]));
  }

  project.tracks.forEach((track, i) => {
    const events = collectTrackEvents(track.id, project.regions, i % 16);
    if (events.length > 0) trackChunks.push(buildTrackChunk(events, track.name));
  });

  const header = new Uint8Array([
    ...strBytes('MThd'), ...u32(6), ...u16(1), ...u16(trackChunks.length), ...u16(TICKS_PER_BEAT),
  ]);

  let totalLen = header.length;
  for (const c of trackChunks) totalLen += c.length;
  const out = new Uint8Array(totalLen);
  out.set(header, 0);
  let offset = header.length;
  for (const c of trackChunks) {
    out.set(c, offset);
    offset += c.length;
  }

  return new Blob([out], { type: 'audio/midi' });
}

export function exportProjectMidi(project: SymphonyProject): void {
  downloadBlob(renderProjectToMidi(project), `${project.name}.mid`);
}
