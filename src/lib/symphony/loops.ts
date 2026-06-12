import type { LoopItem, NoteEvent } from '../../types/symphony';

function drumPattern(kick: number[], snare: number[], hihat: number[]): NoteEvent[] {
  const notes: NoteEvent[] = [];
  for (const beat of kick) notes.push({ pitch: 36, startBeat: beat, durationBeats: 0.25, velocity: 100 });
  for (const beat of snare) notes.push({ pitch: 38, startBeat: beat, durationBeats: 0.25, velocity: 90 });
  for (const beat of hihat) notes.push({ pitch: 42, startBeat: beat, durationBeats: 0.125, velocity: 70 });
  return notes;
}

function bassLine(notes: [number, number][]): NoteEvent[] {
  return notes.map(([pitch, startBeat]) => ({
    pitch,
    startBeat,
    durationBeats: 0.75,
    velocity: 85,
  }));
}

function chordProgression(chords: number[][], startBar = 0): NoteEvent[] {
  const notes: NoteEvent[] = [];
  chords.forEach((chord, i) => {
    const beat = startBar * 4 + i * 4;
    chord.forEach((pitch) => {
      notes.push({ pitch, startBeat: beat, durationBeats: 3.5, velocity: 75 });
    });
  });
  return notes;
}

/** Regal Symphony loop browser library. */
export const LOOP_LIBRARY: LoopItem[] = [
  {
    id: 'loop-rising-tension',
    name: 'Rising Tension Beat',
    bpm: 127,
    bars: 4,
    tags: ['Drums', 'Pattern Loop', 'Trap', 'Bright'],
    category: 'drums',
    pattern: drumPattern([0, 1.5, 2, 3.5], [1, 3], [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]),
  },
  {
    id: 'loop-ground-up',
    name: 'From the Ground Up Beat',
    bpm: 120,
    bars: 4,
    tags: ['Drums', 'Bass Music', 'Dubstep'],
    category: 'drums',
    pattern: drumPattern([0, 2], [1, 3], [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75]),
  },
  {
    id: 'loop-midnight-ride',
    name: 'Midnight Ride Beat',
    bpm: 140,
    bars: 4,
    tags: ['Drums', 'Pattern Loop', 'Trap'],
    category: 'drums',
    pattern: drumPattern([0, 1, 2, 3], [1.5, 3.5], [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]),
  },
  {
    id: 'loop-heavy-bass',
    name: 'Heavy Bass Line',
    bpm: 127,
    bars: 4,
    tags: ['Bass', 'Synth Bass', 'Trap'],
    category: 'synth_bass',
    pattern: bassLine([[36, 0], [36, 1], [38, 2], [36, 3], [41, 4], [36, 5], [38, 6], [36, 7]]),
  },
  {
    id: 'loop-synth-lead-arp',
    name: 'Synth Lead Arpeggio',
    bpm: 127,
    bars: 4,
    tags: ['Synth Lead', 'Arp', 'Bright'],
    category: 'synth_lead',
    pattern: [
      { pitch: 60, startBeat: 0, durationBeats: 0.5, velocity: 80 },
      { pitch: 64, startBeat: 0.5, durationBeats: 0.5, velocity: 75 },
      { pitch: 67, startBeat: 1, durationBeats: 0.5, velocity: 80 },
      { pitch: 72, startBeat: 1.5, durationBeats: 0.5, velocity: 85 },
      { pitch: 67, startBeat: 2, durationBeats: 0.5, velocity: 80 },
      { pitch: 64, startBeat: 2.5, durationBeats: 0.5, velocity: 75 },
      { pitch: 60, startBeat: 3, durationBeats: 0.5, velocity: 80 },
      { pitch: 64, startBeat: 3.5, durationBeats: 0.5, velocity: 75 },
    ],
  },
  {
    id: 'loop-string-pad',
    name: 'String Pad Progression',
    bpm: 90,
    bars: 8,
    tags: ['Strings', 'Pad', 'Cinematic'],
    category: 'strings',
    pattern: chordProgression([[48, 52, 55], [50, 53, 57], [52, 55, 59], [48, 52, 55]]),
  },
  {
    id: 'loop-vocal-shouts',
    name: 'Vocal Shout Stabs',
    bpm: 127,
    bars: 4,
    tags: ['Vocals', 'Trap', 'Bright'],
    category: 'vocals',
    pattern: [
      { pitch: 72, startBeat: 0, durationBeats: 0.25, velocity: 95 },
      { pitch: 72, startBeat: 2, durationBeats: 0.25, velocity: 90 },
      { pitch: 74, startBeat: 3.5, durationBeats: 0.25, velocity: 100 },
    ],
  },
  {
    id: 'loop-perc-groove',
    name: 'Electronic Percussion Groove',
    bpm: 120,
    bars: 4,
    tags: ['Percussion', 'Pattern Loop'],
    category: 'percussion',
    pattern: [
      { pitch: 60, startBeat: 0, durationBeats: 0.125, velocity: 60 },
      { pitch: 62, startBeat: 0.75, durationBeats: 0.125, velocity: 55 },
      { pitch: 60, startBeat: 1.5, durationBeats: 0.125, velocity: 65 },
      { pitch: 64, startBeat: 2.25, durationBeats: 0.125, velocity: 70 },
      { pitch: 60, startBeat: 3, durationBeats: 0.125, velocity: 60 },
    ],
  },
  {
    id: 'loop-lofi-drums',
    name: 'Lo-Fi Drum Break',
    bpm: 85,
    bars: 4,
    tags: ['Drums', 'Pattern Loop', 'Cinematic'],
    category: 'drums',
    pattern: drumPattern([0, 1.75, 2.5, 3.25], [1, 3], [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]),
  },
  {
    id: 'loop-ambient-pad',
    name: 'Ambient Glass Pad',
    bpm: 90,
    bars: 8,
    tags: ['Synth Pad', 'Cinematic', 'Bright'],
    category: 'synth_pad',
    pattern: chordProgression([[52, 55, 59], [53, 57, 60], [55, 59, 62], [50, 53, 57]]),
  },
  {
    id: 'loop-trap-hats',
    name: 'Trap Hi-Hat Roll',
    bpm: 140,
    bars: 2,
    tags: ['Drums', 'Trap', 'Pattern Loop'],
    category: 'drums',
    pattern: Array.from({ length: 32 }, (_, i) => ({
      pitch: 42,
      startBeat: i * 0.25,
      durationBeats: 0.1,
      velocity: 55 + (i % 4) * 8,
    })),
  },
  {
    id: 'loop-funk-bass',
    name: 'Funk Bass Groove',
    bpm: 110,
    bars: 4,
    tags: ['Bass', 'Synth Bass', 'Bright'],
    category: 'synth_bass',
    pattern: bassLine([[36, 0], [39, 0.75], [41, 1.5], [36, 2], [43, 2.75], [41, 3.5], [38, 4], [36, 5], [41, 6], [36, 7]]),
  },
  {
    id: 'loop-orchestral-hit',
    name: 'Orchestral Brass Hit',
    bpm: 120,
    bars: 4,
    tags: ['Brass', 'Cinematic'],
    category: 'brass',
    pattern: [
      { pitch: 48, startBeat: 0, durationBeats: 1.5, velocity: 100 },
      { pitch: 52, startBeat: 0, durationBeats: 1.5, velocity: 95 },
      { pitch: 55, startBeat: 0, durationBeats: 1.5, velocity: 90 },
      { pitch: 60, startBeat: 2, durationBeats: 0.5, velocity: 110 },
      { pitch: 64, startBeat: 2, durationBeats: 0.5, velocity: 105 },
    ],
  },
];

export const LOOP_FILTER_TAGS = [
  'Drums', 'Pattern Loop', 'Trap', 'Bass Music', 'Dubstep', 'Bright',
  'Synth Lead', 'Synth Pad', 'Strings', 'Vocals', 'Percussion', 'Bass', 'Arp', 'Cinematic', 'Brass',
];
