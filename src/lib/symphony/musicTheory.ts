/**
 * CloudCast Symphony — music theory core.
 *
 * Deterministic scale/chord/progression math shared by the AI composer,
 * the chord track, and the step sequencer. Pure functions only.
 */

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

export type ScaleName =
  | 'major' | 'minor' | 'harmonicMinor' | 'dorian' | 'mixolydian'
  | 'pentatonicMajor' | 'pentatonicMinor' | 'blues';

export const SCALES: Record<ScaleName, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  pentatonicMajor: [0, 2, 4, 7, 9],
  pentatonicMinor: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
};

export type ChordQuality =
  | 'maj' | 'min' | 'dim' | 'aug'
  | 'maj7' | 'min7' | 'dom7' | 'min7b5' | 'dim7'
  | 'sus2' | 'sus4' | 'add9' | 'min9' | 'maj9' | 'dom9';

const CHORD_INTERVALS: Record<ChordQuality, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
  min7b5: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  add9: [0, 4, 7, 14],
  min9: [0, 3, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  dom9: [0, 4, 7, 10, 14],
};

const QUALITY_BY_DEGREE_MAJOR: ChordQuality[] = ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'];
const QUALITY_BY_DEGREE_MINOR: ChordQuality[] = ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'];

export interface ParsedKey {
  rootPc: number; // pitch class 0–11
  scale: ScaleName;
  mode: 'major' | 'minor';
}

/** Parse "C maj" / "A min" / "F# minor" style keys (TransportBar format). */
export function parseKey(key: string): ParsedKey {
  const m = key.trim().match(/^([A-G][#b]?)\s*(maj|min|major|minor)?$/i);
  const rootPc = m ? nameToPc(m[1]) : 0;
  const modeStr = (m?.[2] ?? 'maj').toLowerCase();
  const mode: 'major' | 'minor' = modeStr.startsWith('min') ? 'minor' : 'major';
  return { rootPc, scale: mode === 'major' ? 'major' : 'minor', mode };
}

export function nameToPc(name: string): number {
  const n = name.trim();
  const idx = (NOTE_NAMES as readonly string[]).indexOf(n) >= 0
    ? (NOTE_NAMES as readonly string[]).indexOf(n)
    : (FLAT_NAMES as readonly string[]).indexOf(n);
  return idx >= 0 ? idx : 0;
}

export function pcToName(pc: number, preferFlats = false): string {
  const names = preferFlats ? FLAT_NAMES : NOTE_NAMES;
  return names[((pc % 12) + 12) % 12];
}

/** MIDI note of the scale root near the given anchor (default around C4=60). */
export function keyRootMidi(key: string, anchor = 60): number {
  const { rootPc } = parseKey(key);
  let midi = anchor - ((anchor - rootPc) % 12 + 12) % 12;
  if (midi < anchor - 6) midi += 12;
  return midi;
}

/** Scale degree (0-based, octaves allowed) → MIDI note. */
export function degreeToMidi(rootMidi: number, scale: ScaleName, degree: number): number {
  const steps = SCALES[scale];
  const oct = Math.floor(degree / steps.length);
  const idx = ((degree % steps.length) + steps.length) % steps.length;
  return rootMidi + oct * 12 + steps[idx];
}

/** Build chord MIDI notes from a root MIDI note and quality. */
export function buildChord(rootMidi: number, quality: ChordQuality): number[] {
  return CHORD_INTERVALS[quality].map((i) => rootMidi + i);
}

export interface ParsedChord {
  rootPc: number;
  quality: ChordQuality;
  /** Inversion bass pitch class, when slash notation is used. */
  bassPc?: number;
}

const CHORD_RE = /^([A-G][#b]?)(m|maj|min|dim|aug|sus2|sus4|add9|m7b5|min7b5|dim7|m7|min7|maj7|M7|7|m9|min9|maj9|9|dom9)?(?:\/([A-G][#b]?))?$/;

/** Parse "Am7", "C#dim", "Bb/F", "Gsus4", "D9" style chord symbols. */
export function parseChordSymbol(symbol: string): ParsedChord | null {
  const m = symbol.trim().match(CHORD_RE);
  if (!m) return null;
  const rootPc = nameToPc(m[1]);
  const q = m[2] ?? '';
  const quality: ChordQuality =
    q === '' ? 'maj'
      : q === 'm' || q === 'min' ? 'min'
        : q === 'dim' ? 'dim'
          : q === 'aug' ? 'aug'
            : q === 'sus2' ? 'sus2'
              : q === 'sus4' ? 'sus4'
                : q === 'add9' ? 'add9'
                  : q === 'm7b5' || q === 'min7b5' ? 'min7b5'
                    : q === 'dim7' ? 'dim7'
                      : q === 'm7' || q === 'min7' ? 'min7'
                        : q === 'maj7' || q === 'M7' ? 'maj7'
                          : q === '7' || q === 'dom9' ? 'dom7'
                            : q === 'm9' || q === 'min9' ? 'min9'
                              : q === 'maj9' ? 'maj9'
                                : q === '9' ? 'dom9'
                                  : 'maj';
  return { rootPc, quality, bassPc: m[3] ? nameToPc(m[3]) : undefined };
}

/** Conventional chart spelling: Db, Eb, Ab, Bb in flat form. */
const FLAT_SPELLING = new Set([1, 3, 8, 10]);

export function formatChordSymbol(rootPc: number, quality: ChordQuality, bassPc?: number): string {
  const suffix: Record<ChordQuality, string> = {
    maj: '', min: 'm', dim: 'dim', aug: 'aug',
    maj7: 'maj7', min7: 'm7', dom7: '7', min7b5: 'm7b5', dim7: 'dim7',
    sus2: 'sus2', sus4: 'sus4', add9: 'add9', min9: 'm9', maj9: 'maj9', dom9: '9',
  };
  const pcName = (pc: number) => pcToName(pc, FLAT_SPELLING.has(((pc % 12) + 12) % 12));
  return `${pcName(rootPc)}${suffix[quality]}${bassPc !== undefined ? `/${pcName(bassPc)}` : ''}`;
}

/** Chord for a diatonic scale degree (0-based) in the given key. */
export function diatonicChord(key: string, degree: number, seventh = false): ParsedChord {
  const { rootPc, mode } = parseKey(key);
  const scale = mode === 'major' ? 'major' : 'minor';
  const rootMidi = 60 + rootPc;
  const chordRoot = degreeToMidi(rootMidi, scale, degree);
  const qualIdx = ((degree % 7) + 7) % 7;
  const base = (mode === 'major' ? QUALITY_BY_DEGREE_MAJOR : QUALITY_BY_DEGREE_MINOR)[qualIdx];
  const quality: ChordQuality = seventh
    ? base === 'maj' ? 'maj7' : base === 'min' ? 'min7' : 'dim7'
    : base;
  return { rootPc: chordRoot % 12, quality };
}

/** Step a chord symbol to the next/previous diatonic chord in the key (chord track editing). */
export function cycleDiatonicChord(symbol: string, key: string, dir: 1 | -1 = 1): string {
  const parsed = parseChordSymbol(symbol);
  const { rootPc, mode } = parseKey(key);
  const steps = SCALES[mode === 'major' ? 'major' : 'minor'];
  if (!parsed) {
    const t = diatonicChord(key, 0);
    return formatChordSymbol(t.rootPc, t.quality);
  }
  let degree = 0;
  for (let d = 0; d < 7; d++) {
    if ((rootPc + steps[d]) % 12 === parsed.rootPc) { degree = d; break; }
  }
  const next = (((degree + dir) % 7) + 7) % 7;
  const c = diatonicChord(key, next);
  return formatChordSymbol(c.rootPc, c.quality);
}

/* ── Roman-numeral progressions ─────────────────────────────────── */

export type RomanDegree = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Progression {
  id: string;
  label: string;
  /** Degrees (0 = tonic) — 4 entries = one chord per bar over 4 bars. */
  degrees: number[];
  sevenths?: boolean;
}

export const PROGRESSIONS: Progression[] = [
  { id: 'pop-4', label: 'Pop I–V–vi–IV', degrees: [0, 4, 5, 3] },
  { id: 'pop-5645', label: 'Pop vi–IV–I–V', degrees: [5, 3, 0, 4] },
  { id: 'pop-1564', label: 'Pop I–vi–IV–V', degrees: [0, 5, 3, 4] },
  { id: 'axis-2', label: 'Pop ii–V–I–vi', degrees: [1, 4, 0, 5], sevenths: true },
  { id: 'edm-6415', label: 'EDM vi–IV–I–V', degrees: [5, 3, 0, 4] },
  { id: 'edm-1645', label: 'EDM I–vi–IV–V', degrees: [0, 5, 3, 4] },
  { id: 'sad-6415', label: 'Emo vi–IV–I–V', degrees: [5, 3, 0, 4] },
  { id: 'jazz-2516', label: 'Jazz ii–V–I–vi', degrees: [1, 4, 0, 5], sevenths: true },
  { id: 'jazz-1625', label: 'Jazz I–vi–ii–V', degrees: [0, 5, 1, 4], sevenths: true },
  { id: 'blues-145', label: 'Blues I–IV–V', degrees: [0, 3, 4, 3], sevenths: true },
  { id: 'dorian-1-4', label: 'Dorian i–IV', degrees: [0, 3, 0, 3] },
  { id: 'epic-1-6-3-4', label: 'Epic i–VI–III–IV', degrees: [0, 5, 2, 3] },
  { id: 'dream-4-5-6', label: 'Dream IV–V–vi', degrees: [3, 4, 5, 4] },
];

export function progressionChords(prog: Progression, key: string): ParsedChord[] {
  return prog.degrees.map((d) => diatonicChord(key, d, prog.sevenths));
}

/* ── Seeded RNG (deterministic variations) ──────────────────────── */

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

/** Swing: delay the second half of each 2-grid pair toward triplet feel. amount 0–100. */
export function swingBeat(beat: number, amount: number, grid = 0.5): number {
  if (amount <= 0) return beat;
  const pairLen = grid * 2;
  const t = beat - Math.floor(beat / pairLen) * pairLen;
  if (t < grid) return beat;
  return beat + (amount / 100) * (grid / 3);
}
