/**
 * CloudCast Symphony — AI composition engine.
 *
 * Turns a text prompt ("dark cinematic trailer in D minor with an epic
 * chorus") into a complete multi-track arrangement: structure, chords,
 * drums, bass, harmony, melody, arp — plus lyrics. Fully local and
 * deterministic (seeded), so results are reproducible "variations".
 *
 * Extension seam: swap `composeSong` internals for an LLM-backed provider
 * later — `songToProjectPatch` is the stable contract the UI consumes.
 */
import type {
  ArrangementSection, ChordEvent, NoteEvent, Region, TimelineMarker, Track, TrackColor,
} from '../../types/symphony';
import { defaultTrackFx } from '../../types/symphony';
import {
  buildChord, degreeToMidi, formatChordSymbol, keyRootMidi, mulberry32,
  parseKey, pick, progressionChords, swingBeat, PROGRESSIONS,
  type Progression, type Rng, type ScaleName,
} from './musicTheory';

/* ── Style profile ──────────────────────────────────────────────── */

export type Genre =
  | 'pop' | 'edm' | 'trap' | 'lofi' | 'rock' | 'jazz'
  | 'ambient' | 'synthwave' | 'orchestral';

export type Mood =
  | 'happy' | 'dark' | 'sad' | 'dreamy' | 'epic' | 'chill' | 'romantic' | 'energetic' | 'neutral';

export type DrumStyle = 'fourOnFloor' | 'backbeat' | 'trapHalfTime' | 'lofiSwing' | 'sparse';
export type BassStyle = 'rootEighths' | 'offbeatEighths' | 'trap808' | 'walking' | 'wholeNotes';

export interface AiStyleProfile {
  genre: Genre;
  mood: Mood;
  key: string;         // "C maj" / "A min"
  scale: ScaleName;
  tempo: number;
  swing: number;       // 0–100
  energy: number;      // 0–100
  complexity: number;  // 0–100
  drumStyle: DrumStyle;
  bassStyle: BassStyle;
  arp: boolean;
  strings: boolean;
  progressionId: string;
  hookProgressionId: string;
}

/* ── Prompt analysis ────────────────────────────────────────────── */

const GENRE_KEYWORDS: [Genre, string[]][] = [
  ['edm', ['edm', 'house', 'dance', 'club', 'techno', 'rave', 'festival', 'banger', 'groove']],
  ['trap', ['trap', '808', 'hip-hop', 'hip hop', 'rap', 'drill', 'boom bap', 'beat']],
  ['lofi', ['lofi', 'lo-fi', 'study', 'dusty', 'jazzy', 'beats to', 'coffee']],
  ['rock', ['rock', 'guitar', 'punk', 'band', 'indie', 'grunge']],
  ['jazz', ['jazz', 'swing', 'blues', 'sax', 'soul', 'funk']],
  ['ambient', ['ambient', 'drone', 'meditation', 'sleep', 'soundscape', 'yoga', 'deep focus']],
  ['synthwave', ['synthwave', 'retro', '80s', 'outrun', 'vaporwave', 'neon', 'arcade']],
  ['orchestral', ['orchestral', 'trailer', 'film', 'score', 'symphony', 'strings', 'heroic']],
  ['pop', ['pop', 'radio', 'catchy', 'anthem', 'summer', 'singalong', 'chart']],
];

const MOOD_KEYWORDS: [Mood, string[]][] = [
  ['happy', ['happy', 'uplifting', 'joyful', 'sunny', 'bright', 'feel good', 'fun', 'cheerful']],
  ['dark', ['dark', 'sinister', 'menacing', 'horror', 'night', 'moody', 'gritty', 'ominous']],
  ['sad', ['sad', 'melancholy', 'heartbreak', 'lonely', 'blue', 'emotional', 'tearful', 'grief']],
  ['dreamy', ['dreamy', 'ethereal', 'floating', 'space', 'cosmic', 'magical', 'airy', 'clouds']],
  ['epic', ['epic', 'powerful', 'triumphant', 'massive', 'grand', 'legendary', 'battle']],
  ['chill', ['chill', 'relax', 'calm', 'mellow', 'smooth', 'laid back', 'lazy', 'peaceful']],
  ['romantic', ['romantic', 'love', 'tender', 'intimate', 'warm', 'heart', 'kiss']],
  ['energetic', ['energetic', 'aggressive', 'intense', 'driving', 'pump', 'hype', 'wild', 'fast']],
];

const GENRE_PRESETS: Record<Genre, Omit<AiStyleProfile, 'genre' | 'mood' | 'key' | 'scale' | 'energy' | 'complexity'>> = {
  pop: { tempo: 118, swing: 0, drumStyle: 'fourOnFloor', bassStyle: 'rootEighths', arp: true, strings: true, progressionId: 'pop-4', hookProgressionId: 'pop-5645' },
  edm: { tempo: 126, swing: 0, drumStyle: 'fourOnFloor', bassStyle: 'offbeatEighths', arp: true, strings: false, progressionId: 'edm-6415', hookProgressionId: 'pop-4' },
  trap: { tempo: 140, swing: 0, drumStyle: 'trapHalfTime', bassStyle: 'trap808', arp: false, strings: true, progressionId: 'sad-6415', hookProgressionId: 'epic-1-6-3-4' },
  lofi: { tempo: 84, swing: 55, drumStyle: 'lofiSwing', bassStyle: 'wholeNotes', arp: false, strings: true, progressionId: 'jazz-2516', hookProgressionId: 'jazz-1625' },
  rock: { tempo: 132, swing: 0, drumStyle: 'backbeat', bassStyle: 'rootEighths', arp: false, strings: false, progressionId: 'pop-1564', hookProgressionId: 'pop-5645' },
  jazz: { tempo: 112, swing: 60, drumStyle: 'lofiSwing', bassStyle: 'walking', arp: false, strings: true, progressionId: 'jazz-1625', hookProgressionId: 'jazz-2516' },
  ambient: { tempo: 72, swing: 0, drumStyle: 'sparse', bassStyle: 'wholeNotes', arp: true, strings: true, progressionId: 'dream-4-5-6', hookProgressionId: 'dorian-1-4' },
  synthwave: { tempo: 104, swing: 0, drumStyle: 'fourOnFloor', bassStyle: 'rootEighths', arp: true, strings: false, progressionId: 'sad-6415', hookProgressionId: 'pop-4' },
  orchestral: { tempo: 92, swing: 0, drumStyle: 'sparse', bassStyle: 'wholeNotes', arp: false, strings: true, progressionId: 'epic-1-6-3-4', hookProgressionId: 'pop-5645' },
};

/** Weighted keyword match: most specific (highest hit count) wins; ties → table order. */
function matchKeywords<T extends string>(text: string, table: [T, string[]][]): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const [value, words] of table) {
    const score = words.reduce((s, w) => s + (text.includes(w) ? w.split(/\s+/).length : 0), 0);
    if (score > bestScore) {
      best = value;
      bestScore = score;
    }
  }
  return best;
}

export interface PromptAnalysis {
  genre: Genre;
  mood: Mood;
  tempoHint?: number;
  keyHint?: string;
  energyHint?: number;
}

/** Keyword-level prompt understanding (deterministic, no network). */
export function analyzePrompt(prompt: string): PromptAnalysis {
  const text = prompt.toLowerCase();
  const genre = matchKeywords(text, GENRE_KEYWORDS) ?? 'pop';
  let mood = matchKeywords(text, MOOD_KEYWORDS) ?? 'neutral';

  let tempoHint: number | undefined;
  if (/\b(slow|down|ballad|half.?time)\b/.test(text)) tempoHint = 78;
  else if (/\b(chill|relax|calm|laid.?back)\b/.test(text)) tempoHint = 88;
  else if (/\b(upbeat|bouncy|groovy|dance)\b/.test(text)) tempoHint = 122;
  else if (/\b(fast|energetic|hype|speed|frantic)\b/.test(text)) tempoHint = 142;

  const keyMatch = text.match(/\bin ([a-g][#b]?)\s*(major|maj|minor|min)\b/);
  const keyHint = keyMatch
    ? `${keyMatch[1].charAt(0).toUpperCase()}${keyMatch[1].slice(1)} ${keyMatch[2].startsWith('min') ? 'min' : 'maj'}`
    : undefined;

  let energyHint: number | undefined;
  if (/\b(calm|gentle|soft|quiet|ambient)\b/.test(text)) energyHint = 25;
  else if (/\b(intense|aggressive|heavy|powerful|epic)\b/.test(text)) energyHint = 85;
  else if (/\b(energetic|driving|up)\b/.test(text)) energyHint = 70;

  if (mood === 'neutral') {
    mood = energyHint !== undefined && energyHint >= 70 ? 'energetic' : 'neutral';
  }
  return { genre, mood, tempoHint, keyHint, energyHint };
}

/* ── Composition ────────────────────────────────────────────────── */

export interface AiComposeOptions {
  prompt: string;
  seed?: number;
  /** Overrides (else derived from the prompt). */
  key?: string;
  tempo?: number;
  energy?: number;      // 0–100
  complexity?: number;  // 0–100
  /** Restrict output to these arrangement section names (else auto). */
  sections?: string[];
}

export interface AiSongRegion {
  name: string;
  startBar: number;
  lengthBars: number;
  notes: NoteEvent[];
}

export interface AiSongTrack {
  name: string;
  instrumentId: string;
  color: TrackColor;
  volume: number;
  pan: number;
  reverbSend: number;
  delaySend: number;
  regions: AiSongRegion[];
}

export interface AiSong {
  style: AiStyleProfile;
  title: string;
  arrangement: ArrangementSection[];
  chordEvents: ChordEvent[];
  tracks: AiSongTrack[];
  lyrics: string;
}

const SECTION_LAYOUTS: Record<Genre, [string, number][]> = {
  pop: [['Intro', 4], ['Verse', 8], ['Chorus', 8], ['Verse', 8], ['Chorus', 8], ['Bridge', 8], ['Chorus', 8], ['Outro', 4]],
  edm: [['Intro', 8], ['Build', 8], ['Drop', 8], ['Breakdown', 8], ['Build', 8], ['Drop', 8], ['Outro', 8]],
  trap: [['Intro', 4], ['Verse', 8], ['Chorus', 8], ['Verse', 8], ['Chorus', 8], ['Outro', 4]],
  lofi: [['Intro', 4], ['A', 8], ['B', 8], ['A', 8], ['Outro', 4]],
  rock: [['Intro', 4], ['Verse', 8], ['Chorus', 8], ['Verse', 8], ['Chorus', 8], ['Solo', 8], ['Chorus', 8], ['Outro', 4]],
  jazz: [['Head', 8], ['A', 8], ['B', 8], ['Head', 8], ['Outro', 4]],
  ambient: [['Intro', 8], ['A', 16], ['B', 16], ['A', 16], ['Outro', 8]],
  synthwave: [['Intro', 8], ['Verse', 8], ['Chorus', 8], ['Breakdown', 8], ['Chorus', 8], ['Outro', 8]],
  orchestral: [['Intro', 8], ['Build', 8], ['Theme', 16], ['Breakdown', 8], ['Theme', 16], ['Outro', 8]],
};

const SECTION_INTENSITY: Record<string, number> = {
  intro: 0.45, verse: 0.75, chorus: 1, hook: 1, drop: 1, theme: 1, head: 0.8,
  bridge: 0.6, breakdown: 0.35, build: 0.7, solo: 0.9, a: 0.7, b: 0.8, outro: 0.4,
};

const KEYS = ['C maj', 'G maj', 'D maj', 'A maj', 'E maj', 'F maj', 'B maj', 'A min', 'E min', 'D min'];

function resolveStyle(opts: AiComposeOptions, rng: Rng): AiStyleProfile {
  const analysis = analyzePrompt(opts.prompt);
  const preset = GENRE_PRESETS[analysis.genre];
  const darkMood = analysis.mood === 'dark' || analysis.mood === 'sad' || analysis.genre === 'trap' || analysis.genre === 'orchestral';
  const key = opts.key ?? analysis.keyHint ?? pick(rng, darkMood ? ['A min', 'E min', 'D min'] : KEYS);
  const scale: ScaleName = parseKey(key).mode === 'major' ? 'major' : 'minor';
  const tempo = Math.round(
    opts.tempo ?? analysis.tempoHint ?? preset.tempo + (rng() * 8 - 4),
  );
  return {
    ...preset,
    genre: analysis.genre,
    mood: analysis.mood,
    key,
    scale,
    tempo: Math.max(50, Math.min(190, tempo)),
    energy: opts.energy ?? analysis.energyHint ?? (analysis.mood === 'energetic' || analysis.mood === 'epic' ? 75 : analysis.mood === 'chill' || analysis.mood === 'sad' ? 35 : 55),
    complexity: opts.complexity ?? (analysis.genre === 'jazz' || analysis.genre === 'lofi' ? 65 : 50),
    swing: preset.swing,
  };
}

function buildArrangement(style: AiStyleProfile, rng: Rng): ArrangementSection[] {
  const layout = SECTION_LAYOUTS[style.genre];
  const sections: ArrangementSection[] = [];
  let bar = 0;
  for (const [name, len] of layout) {
    sections.push({ id: `sec-${bar}-${name.toLowerCase()}`, name, startBar: bar, lengthBars: len });
    bar += len;
  }
  // Low energy songs trim a repeated section for a tighter arrangement.
  if (style.energy < 35 && sections.length > 5) {
    const cut = sections[3];
    const rest = sections.filter((s) => s !== cut);
    let b = 0;
    return rest.map((s) => {
      const next = { ...s, startBar: b };
      b += s.lengthBars;
      return next;
    });
  }
  void rng;
  return sections;
}

function chordPlanFor(style: AiStyleProfile, arrangement: ArrangementSection[], rng: Rng): ChordEvent[] {
  const main = PROGRESSIONS.find((p) => p.id === style.progressionId) ?? PROGRESSIONS[0];
  const hook = PROGRESSIONS.find((p) => p.id === style.hookProgressionId) ?? main;
  const bridge = PROGRESSIONS.find((p) => p.id === 'dream-4-5-6') ?? main;
  const events: ChordEvent[] = [];
  for (const sec of arrangement) {
    const isHook = /chorus|drop|theme|head/i.test(sec.name);
    const isBridge = /bridge|breakdown/i.test(sec.name);
    const prog: Progression = isBridge ? bridge : isHook ? hook : main;
    const chords = progressionChords(prog, style.key);
    const barsPerChord = style.genre === 'ambient' ? 2 : 1;
    for (let b = 0; b < sec.lengthBars; b += barsPerChord) {
      const chord = chords[(b / barsPerChord) % chords.length];
      events.push({
        bar: sec.startBar + b,
        lengthBars: Math.min(barsPerChord, sec.lengthBars - b),
        chord: formatChordSymbol(chord.rootPc, chord.quality),
      });
    }
  }
  void rng;
  return events;
}

function chordAtBar(events: ChordEvent[], bar: number): ChordEvent {
  return events.find((e) => bar >= e.bar && bar < e.bar + e.lengthBars) ?? events[0];
}

/* ── Part generators ────────────────────────────────────────────── */

function drumNotes(style: AiStyleProfile, intensity: number, bars: number, rng: Rng): NoteEvent[] {
  const notes: NoteEvent[] = [];
  const push = (pitch: number, beat: number, dur: number, vel: number) => {
    if (beat < 0 || beat >= bars * 4) return;
    notes.push({
      pitch,
      startBeat: Math.round(swingBeat(beat, style.swing) * 1000) / 1000,
      durationBeats: dur,
      velocity: Math.max(15, Math.min(127, Math.round(vel))),
    });
  };
  const KICK = 36, SNARE = 38, CLAP = 39, HAT = 42, OPEN = 46;

  for (let bar = 0; bar < bars; bar++) {
    const lastBar = bar === bars - 1;
    const fill = lastBar && bars > 1 && intensity > 0.5;
    switch (style.drumStyle) {
      case 'fourOnFloor': {
        for (let b = 0; b < 4; b++) push(KICK, bar * 4 + b, 0.25, 105 * intensity);
        push(CLAP, bar * 4 + 1, 0.25, 95 * intensity);
        push(CLAP, bar * 4 + 3, 0.25, 95 * intensity);
        for (let e = 0; e < 8; e++) {
          if (e % 2 === 1) push(OPEN, bar * 4 + e * 0.5, 0.2, 60 * intensity);
          else push(HAT, bar * 4 + e * 0.5, 0.125, 70 * intensity);
        }
        break;
      }
      case 'backbeat': {
        push(KICK, bar * 4, 0.25, 105 * intensity);
        push(KICK, bar * 4 + 2.5, 0.25, 100 * intensity);
        push(SNARE, bar * 4 + 1, 0.25, 100 * intensity);
        push(SNARE, bar * 4 + 3, 0.25, 100 * intensity);
        for (let e = 0; e < 8; e++) push(HAT, bar * 4 + e * 0.5, 0.125, (e % 2 ? 62 : 74) * intensity);
        break;
      }
      case 'trapHalfTime': {
        push(KICK, bar * 4, 0.5, 112 * intensity);
        if (rng() > 0.4) push(KICK, bar * 4 + 1.75, 0.35, 100 * intensity);
        if (rng() > 0.6) push(KICK, bar * 4 + 3.5, 0.35, 96 * intensity);
        push(SNARE, bar * 4 + 2, 0.3, 108 * intensity);
        for (let s = 0; s < 16; s++) {
          const rollBoost = s >= 12 && rng() > 0.55 ? 1.25 : 1;
          push(HAT, bar * 4 + s * 0.25, 0.1, (s % 4 === 0 ? 72 : s % 2 === 0 ? 58 : 46) * intensity * rollBoost);
        }
        break;
      }
      case 'lofiSwing': {
        push(KICK, bar * 4, 0.3, 92 * intensity);
        push(KICK, bar * 4 + 2.5, 0.3, 80 * intensity);
        push(SNARE, bar * 4 + 1, 0.3, 88 * intensity);
        push(SNARE, bar * 4 + 3, 0.3, 88 * intensity);
        for (let e = 0; e < 8; e++) push(HAT, bar * 4 + e * 0.5, 0.12, (e % 2 ? 52 : 64) * intensity);
        break;
      }
      case 'sparse': {
        if (bar % 2 === 0) push(KICK, bar * 4, 0.5, 70 * intensity);
        push(HAT, bar * 4, 0.2, 40 * intensity);
        if (bar % 4 === 3) push(CLAP, bar * 4 + 3.5, 0.3, 45 * intensity);
        break;
      }
    }
    if (fill) {
      for (let s = 0; s < 4; s++) {
        push(SNARE, bar * 4 + 3 + s * 0.25, 0.15, (60 + s * 14) * intensity);
      }
    }
  }
  return notes;
}

function bassNotes(style: AiStyleProfile, chords: ChordEvent[], bars: number, startBar: number, intensity: number, rng: Rng): NoteEvent[] {
  const notes: NoteEvent[] = [];
  const rootMidi = keyRootMidi(style.key, 36); // bass register
  for (let bar = 0; bar < bars; bar++) {
    const chord = chordAtBar(chords, startBar + bar);
    const chordRoot = 48 + parseChordRootPc(chord.chord);
    const root = rootMidi + (((chordRoot - rootMidi) % 12) + 12) % 12;
    const push = (pitch: number, beat: number, dur: number, vel: number) =>
      notes.push({
        pitch,
        startBeat: Math.round(swingBeat(beat, style.swing) * 1000) / 1000,
        durationBeats: dur,
        velocity: Math.max(20, Math.min(127, Math.round(vel))),
      });
    switch (style.bassStyle) {
      case 'rootEighths':
        for (let e = 0; e < 8; e++) {
          const pitch = e >= 6 ? root + 12 : root;
          push(pitch, bar * 4 + e * 0.5, 0.45, (e % 2 === 0 ? 96 : 74) * intensity);
        }
        break;
      case 'offbeatEighths':
        for (let e = 1; e < 8; e += 2) push(root + 12, bar * 4 + e * 0.5, 0.3, 84 * intensity);
        break;
      case 'trap808':
        push(root, bar * 4, 1.6, 110 * intensity);
        if (rng() > 0.5) push(root + 7, bar * 4 + 2, 1.2, 92 * intensity);
        if (rng() > 0.7) push(root - 2, bar * 4 + 3.5, 0.4, 84 * intensity);
        break;
      case 'walking': {
        const targets = [root, root + 4, root + 7, root + 9];
        for (let b = 0; b < 4; b++) push(targets[(bar + b) % 4], bar * 4 + b, 0.9, 88 * intensity);
        break;
      }
      case 'wholeNotes':
        push(root, bar * 4, 3.9, 72 * intensity);
        break;
    }
  }
  return notes;
}

function parseChordRootPc(symbol: string): number {
  const m = symbol.match(/^([A-G][#b]?)/);
  if (!m) return 0;
  const n = m[1];
  const sharps: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  const flats: Record<string, number> = { Db: 1, Eb: 3, Gb: 6, Ab: 8, Bb: 10 };
  return sharps[n] ?? flats[n] ?? 0;
}

function chordVoiceNotes(style: AiStyleProfile, chords: ChordEvent[], bars: number, startBar: number, intensity: number): NoteEvent[] {
  const notes: NoteEvent[] = [];
  const rootMidi = keyRootMidi(style.key, 60);
  for (let bar = 0; bar < bars; bar++) {
    const chord = chordAtBar(chords, startBar + bar);
    const pc = parseChordRootPc(chord.chord);
    const quality = chord.chord.includes('m') && !chord.chord.includes('maj') ? 'min' as const : 'maj' as const;
    const seventh = /7|9/.test(chord.chord) ? (quality === 'min' ? 'min7' as const : 'maj7' as const) : quality;
    const root = rootMidi + (((pc - (rootMidi % 12)) % 12) + 12) % 12;
    for (const pitch of buildChord(root, seventh)) {
      notes.push({
        pitch: pitch + 12,
        startBeat: bar * 4,
        durationBeats: 3.9,
        velocity: Math.max(25, Math.min(110, Math.round(72 * intensity))),
      });
    }
  }
  return notes;
}

function melodyNotes(
  style: AiStyleProfile, chords: ChordEvent[], bars: number, startBar: number,
  intensity: number, rng: Rng, registerLift = 0,
): NoteEvent[] {
  const notes: NoteEvent[] = [];
  const rootMidi = keyRootMidi(style.key, 72) + registerLift;
  const scale = style.scale;
  const eighthStyle = style.genre === 'edm' || style.genre === 'trap' || style.genre === 'pop';

  // Two-bar phrase rhythm templates (offset, duration).
  const phrases: [number, number][][] = [
    [[0, 0.75], [1, 0.5], [1.5, 0.5], [2, 1.5], [3.5, 0.5]],
    [[0, 0.5], [0.5, 0.5], [1, 1], [2.5, 0.5], [3, 1]],
    [[0, 1.5], [2, 0.5], [2.5, 0.5], [3, 1]],
    [[0, 0.5], [0.75, 0.25], [1, 0.5], [2, 0.5], [2.5, 0.5], [3, 1]],
  ];

  let prevDegree = 7; // around octave 1
  for (let phraseStart = 0; phraseStart < bars; phraseStart += 2) {
    const template = pick(rng, phrases);
    const phraseSpan = Math.min(2, bars - phraseStart);
    for (const [off, dur] of template) {
      if (off >= phraseSpan * 4) continue;
      const absBeat = phraseStart * 4 + off;
      const chord = chordAtBar(chords, startBar + phraseStart);
      const chordPc = parseChordRootPc(chord.chord);

      // Land on chord tones on strong beats; passing tones elsewhere.
      const strong = off % 1 === 0;
      const minorish = style.mood === 'dark' || style.mood === 'sad' || parseKey(style.key).mode === 'minor';
      const triad = minorish ? [0, 3, 7] : [0, 4, 7];
      let degree = prevDegree + (rng() > 0.5 ? 1 : -1) * (rng() > 0.7 ? 2 : 1);
      degree = Math.max(2, Math.min(14, degree));
      const relToChord = (midi: number) => ((midi - (48 + chordPc)) % 12 + 12) % 12;
      const isChordTone = triad.includes(relToChord(degreeToMidi(rootMidi, scale, degree)));
      if (strong && !isChordTone) {
        // Snap toward nearest chord tone.
        for (const d of [degree, degree + 1, degree - 1, degree + 2, degree - 2]) {
          if (triad.includes(relToChord(degreeToMidi(rootMidi, scale, d)))) { degree = d; break; }
        }
      }
      if (eighthStyle && rng() > 0.6) degree += rng() > 0.5 ? 1 : -1;

      const velocity = (strong ? 96 : 72) * intensity + (style.complexity > 60 ? rng() * 12 : 0);
      notes.push({
        pitch: degreeToMidi(rootMidi, scale, degree),
        startBeat: Math.round(swingBeat(absBeat, style.swing) * 1000) / 1000,
        durationBeats: Math.max(0.2, dur * (style.genre === 'ambient' ? 2 : 1)),
        velocity: Math.max(25, Math.min(120, Math.round(velocity))),
      });
      prevDegree = degree;
    }
  }
  return notes;
}

function arpNotes(style: AiStyleProfile, chords: ChordEvent[], bars: number, startBar: number, intensity: number): NoteEvent[] {
  const notes: NoteEvent[] = [];
  const rootMidi = keyRootMidi(style.key, 60);
  for (let bar = 0; bar < bars; bar++) {
    const chord = chordAtBar(chords, startBar + bar);
    const pc = parseChordRootPc(chord.chord);
    const root = rootMidi + (((pc - (rootMidi % 12)) % 12) + 12) % 12;
    const voicing = buildChord(root, 'maj').map((p) => p + 12);
    const sequence = [...voicing, ...voicing.slice().reverse()];
    for (let e = 0; e < 8; e++) {
      notes.push({
        pitch: sequence[e % sequence.length],
        startBeat: Math.round(swingBeat(bar * 4 + e * 0.5, style.swing) * 1000) / 1000,
        durationBeats: 0.4,
        velocity: Math.max(20, Math.min(100, Math.round((e % 2 === 0 ? 70 : 52) * intensity))),
      });
    }
  }
  return notes;
}

/* ── Lyrics (template-based, local) ─────────────────────────────── */

const LYRIC_BANK: Record<Mood, { images: string[]; verbs: string[]; nouns: string[] }> = {
  happy: { images: ['golden mornings', 'city lights', 'summer rain', 'open roads'], verbs: ['rising', 'shining', 'dancing', 'calling'], nouns: ['sunshine', 'rhythm', 'fire', 'dreams'] },
  dark: { images: ['shadows falling', 'empty hallways', 'cold neon', 'burning skies'], verbs: ['crawling', 'haunting', 'breaking', 'waiting'], nouns: ['silence', 'ghosts', 'thunder', 'secrets'] },
  sad: { images: ['fading echoes', 'rain on glass', 'empty rooms', 'distant trains'], verbs: ['fading', 'falling', 'aching', 'drifting'], nouns: ['goodbye', 'tears', 'memories', 'distance'] },
  dreamy: { images: ['floating oceans', 'silver clouds', 'starlit waves', 'endless skies'], verbs: ['gliding', 'soaring', 'melting', 'spinning'], nouns: ['starlight', 'echoes', 'wonder', 'gravity'] },
  epic: { images: ['rising kingdoms', 'thunder rolling', 'ancient fires', 'the final stand'], verbs: ['conquering', 'awakening', 'marching', 'burning'], nouns: ['glory', 'legends', 'thunder', 'freedom'] },
  chill: { images: ['slow evenings', 'coffee steam', 'window rain', 'late-night drives'], verbs: ['drifting', 'unwinding', 'breathing', 'lingering'], nouns: ['stillness', 'warmth', 'ease', 'time'] },
  romantic: { images: ['soft horizons', 'candlelight', 'midnight calls', 'slow dances'], verbs: ['holding', 'whispering', 'falling', 'staying'], nouns: ['heartbeat', 'promises', 'devotion', 'home'] },
  energetic: { images: ['neon crowds', 'roaring engines', 'flashbulbs', 'wild nights'], verbs: ['charging', 'igniting', 'breaking', 'roaring'], nouns: ['voltage', 'adrenaline', 'motion', 'dynamite'] },
  neutral: { images: ['quiet signals', 'open highways', 'strangers waving', 'colored noise'], verbs: ['moving', 'turning', 'searching', 'becoming'], nouns: ['moment', 'signal', 'story', 'season'] },
};

/** Template lyric writer — title hook + verse/chorus blocks. */
export function generateLyrics(style: AiStyleProfile, title: string): string {
  const bank = LYRIC_BANK[style.mood];
  const rng = mulberry32(title.length * 7 + style.tempo);
  const line = () => `We're ${pick(rng, bank.verbs)} through ${pick(rng, bank.images)}`;
  const hook = `${title} — hold on to the ${pick(rng, bank.nouns)}`;
  return [
    `[Verse 1]`,
    line(),
    line(),
    `Every ${pick(rng, bank.nouns)} is calling our name`,
    line(),
    ``,
    `[Chorus]`,
    hook,
    `${title} — we're never the same`,
    hook,
    `Feel the ${pick(rng, bank.nouns)} in the ${pick(rng, bank.images)}`,
    ``,
    `[Verse 2]`,
    line(),
    line(),
    `Nothing but ${pick(rng, bank.nouns)} and ${pick(rng, bank.images)}`,
    ``,
    `[Chorus]`,
    hook,
    `${title} — we're never the same`,
  ].join('\n');
}

const TITLE_BANK: Record<Mood, string[]> = {
  happy: ['Golden Hour', 'Sunrise Avenue', 'Better Days'],
  dark: ['Shadowline', 'Nightfall City', 'Hollow Crown'],
  sad: ['Fading Light', 'Last Goodbye', 'Paper Hearts'],
  dreamy: ['Weightless', 'Cloudrunner', 'Starlit'],
  epic: ['Rise of Kings', 'Thunderborn', 'Final Horizon'],
  chill: ['Slow Motion', 'Late Night Coffee', 'Velvet Hours'],
  romantic: ['Only You', 'Midnight Dance', 'Stay Awhile'],
  energetic: ['Overdrive', 'Neon Rush', 'Wildfire'],
  neutral: ['Open Roads', 'Signal', 'Colored Noise'],
};

/* ── Public API ─────────────────────────────────────────────────── */

/** Compose a full song from a text prompt. Deterministic per seed. */
export function composeSong(opts: AiComposeOptions): AiSong {
  const seed = opts.seed ?? hashPrompt(opts.prompt);
  const rng = mulberry32(seed);
  const style = resolveStyle(opts, rng);
  const arrangement = buildArrangement(style, rng);
  const chordEvents = chordPlanFor(style, arrangement, rng);
  const title = pick(rng, TITLE_BANK[style.mood]);

  const isMusical = (name: string) => !/intro|outro|breakdown/i.test(name);

  // Drums — one region per section with per-section intensity.
  const drumRegions: AiSongRegion[] = arrangement.map((sec) => {
    const intensity = SECTION_INTENSITY[sec.name.toLowerCase()] ?? 0.8;
    return {
      name: `Drums · ${sec.name}`,
      startBar: sec.startBar,
      lengthBars: sec.lengthBars,
      notes: drumNotes(style, Math.max(0.3, intensity), sec.lengthBars, rng),
    };
  });

  // Bass — plays through musical sections.
  const bassRegions: AiSongRegion[] = arrangement
    .filter((sec) => isMusical(sec.name) || style.genre === 'ambient')
    .map((sec) => ({
      name: `Bass · ${sec.name}`,
      startBar: sec.startBar,
      lengthBars: sec.lengthBars,
      notes: bassNotes(style, chordEvents, sec.lengthBars, sec.startBar, SECTION_INTENSITY[sec.name.toLowerCase()] ?? 0.8, rng),
    }));

  // Harmony (pad / piano chords).
  const harmonyRegions: AiSongRegion[] = arrangement.map((sec) => ({
    name: `Chords · ${sec.name}`,
    startBar: sec.startBar,
    lengthBars: sec.lengthBars,
    notes: chordVoiceNotes(style, chordEvents, sec.lengthBars, sec.startBar, SECTION_INTENSITY[sec.name.toLowerCase()] ?? 0.8),
  }));

  // Melody — main sections only, chorus lifts a register.
  const melodyRegions: AiSongRegion[] = arrangement
    .filter((sec) => isMusical(sec.name))
    .map((sec) => {
      const isHook = /chorus|drop|theme|head/i.test(sec.name);
      return {
        name: `Lead · ${sec.name}`,
        startBar: sec.startBar,
        lengthBars: sec.lengthBars,
        notes: melodyNotes(style, chordEvents, sec.lengthBars, sec.startBar, SECTION_INTENSITY[sec.name.toLowerCase()] ?? 0.8, rng, isHook ? 2 : 0),
      };
    });

  const tracks: AiSongTrack[] = [
    {
      name: 'AI Drums', instrumentId: style.drumStyle === 'trapHalfTime' ? 'drums-trap' : 'drums-kit',
      color: 'red', volume: 88, pan: 0, reverbSend: 8, delaySend: 0, regions: drumRegions,
    },
    {
      name: 'AI Bass', instrumentId: style.bassStyle === 'trap808' ? 'synth-bass-sub' : 'synth-bass-pluck',
      color: 'blue', volume: 84, pan: 0, reverbSend: 4, delaySend: 0, regions: bassRegions,
    },
    {
      name: 'AI Harmony', instrumentId: style.genre === 'lofi' || style.genre === 'jazz' ? 'synth-pad-glass' : 'synth-pad-warm',
      color: 'purple', volume: 72, pan: -12, reverbSend: 30, delaySend: 12, regions: harmonyRegions,
    },
    {
      name: 'AI Lead', instrumentId: style.genre === 'trap' ? 'synth-lead-pluck' : style.genre === 'orchestral' ? 'strings-legato' : 'synth-lead-bright',
      color: 'yellow', volume: 78, pan: 10, reverbSend: 22, delaySend: 18, regions: melodyRegions,
    },
  ];

  if (style.strings) {
    tracks.push({
      name: 'AI Strings', instrumentId: 'strings-chamber', color: 'cyan', volume: 62, pan: -20,
      reverbSend: 38, delaySend: 6,
      regions: arrangement
        .filter((sec) => /chorus|theme|drop|bridge/i.test(sec.name))
        .map((sec) => ({
          name: `Strings · ${sec.name}`, startBar: sec.startBar, lengthBars: sec.lengthBars,
          notes: chordVoiceNotes({ ...style }, chordEvents, sec.lengthBars, sec.startBar, 0.7),
        })),
    });
  }
  if (style.arp) {
    tracks.push({
      name: 'AI Arp', instrumentId: 'synth-lead-arp', color: 'green', volume: 64, pan: 18,
      reverbSend: 26, delaySend: 24,
      regions: arrangement
        .filter((sec) => isMusical(sec.name))
        .map((sec) => ({
          name: `Arp · ${sec.name}`, startBar: sec.startBar, lengthBars: sec.lengthBars,
          notes: arpNotes(style, chordEvents, sec.lengthBars, sec.startBar, SECTION_INTENSITY[sec.name.toLowerCase()] ?? 0.8),
        })),
    });
  }

  return {
    style,
    title,
    arrangement,
    chordEvents,
    tracks,
    lyrics: generateLyrics(style, title),
  };
}

function hashPrompt(prompt: string): number {
  let h = 2166136261;
  for (let i = 0; i < prompt.length; i++) {
    h ^= prompt.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Stable contract for the UI: convert a song into project mutations. */
export interface AiProjectPatch {
  tempo: number;
  key: string;
  swing: number;
  name: string;
  tracks: Track[];
  regions: Region[];
  chordTrack: ChordEvent[];
  arrangement: ArrangementSection[];
  markers: TimelineMarker[];
}

export function songToProjectPatch(song: AiSong, idPrefix = 'ai'): AiProjectPatch {
  const tracks: Track[] = [];
  const regions: Region[] = [];

  song.tracks.forEach((t, i) => {
    const trackId = `${idPrefix}-track-${i}`;
    tracks.push({
      id: trackId,
      index: i + 1,
      name: t.name,
      color: t.color,
      instrumentId: t.instrumentId,
      volume: t.volume,
      pan: t.pan,
      muted: false,
      solo: false,
      armed: false,
      reverbSend: t.reverbSend,
      delaySend: t.delaySend,
      fx: defaultTrackFx(),
    });
    t.regions.forEach((r, j) => {
      if (r.notes.length === 0) return;
      regions.push({
        id: `${idPrefix}-region-${i}-${j}`,
        trackId,
        name: r.name,
        startBar: r.startBar,
        lengthBars: r.lengthBars,
        notes: r.notes.map((n) => ({ ...n })),
      });
    });
  });

  return {
    tempo: song.style.tempo,
    key: song.style.key,
    swing: song.style.swing,
    name: song.title,
    tracks,
    regions,
    chordTrack: song.chordEvents,
    arrangement: song.arrangement,
    markers: song.arrangement.map((s) => ({ id: `${idPrefix}-marker-${s.id}`, bar: s.startBar, name: s.name })),
  };
}

/** One-click song scaffold: standard structure + chord track + markers (no generated parts). */
export function scaffoldSong(key: string): {
  arrangement: ArrangementSection[];
  chordTrack: ChordEvent[];
  markers: TimelineMarker[];
} {
  let bar = 0;
  const arrangement: ArrangementSection[] = SECTION_LAYOUTS.pop.map(([name, len]) => {
    const sec: ArrangementSection = { id: `sec-${bar}-${name.toLowerCase()}`, name, startBar: bar, lengthBars: len };
    bar += len;
    return sec;
  });
  const main = PROGRESSIONS.find((p) => p.id === 'pop-4') ?? PROGRESSIONS[0];
  const hook = PROGRESSIONS.find((p) => p.id === 'pop-5645') ?? main;
  const chordTrack: ChordEvent[] = [];
  for (const sec of arrangement) {
    const prog = /chorus/i.test(sec.name) ? hook : main;
    const chords = progressionChords(prog, key);
    for (let b = 0; b < sec.lengthBars; b++) {
      chordTrack.push({ bar: sec.startBar + b, lengthBars: 1, chord: formatChordSymbol(chords[b % chords.length].rootPc, chords[b % chords.length].quality) });
    }
  }
  return {
    arrangement,
    chordTrack,
    markers: arrangement.map((s) => ({ id: `scaf-marker-${s.id}`, bar: s.startBar, name: s.name })),
  };
}

/** Human-readable one-liner for the AI panel. */
export function describeSong(song: AiSong): string {
  const s = song.style;
  const bars = song.arrangement.reduce((sum, sec) => sum + sec.lengthBars, 0);
  const secs = (bars * 4 * 60) / s.tempo;
  const mins = Math.floor(secs / 60);
  const rest = Math.round(secs % 60);
  return `${s.genre.toUpperCase()} · ${s.mood.toUpperCase()} · ${s.key} · ${s.tempo} BPM · ${bars} bars (~${mins}:${String(rest).padStart(2, '0')}) · seed-stable`;
}
