import { describe, expect, it } from 'vitest';
import {
  buildChord, cycleDiatonicChord, degreeToMidi, diatonicChord, formatChordSymbol, keyRootMidi,
  mulberry32, parseChordSymbol, parseKey, pcToName, progressionChords,
  swingBeat, PROGRESSIONS,
} from './musicTheory';

describe('parseKey', () => {
  it('parses TransportBar key format', () => {
    expect(parseKey('C maj')).toEqual({ rootPc: 0, scale: 'major', mode: 'major' });
    expect(parseKey('A min')).toEqual({ rootPc: 9, scale: 'minor', mode: 'minor' });
    expect(parseKey('F# major').rootPc).toBe(6);
    expect(parseKey('Bb minor')).toEqual({ rootPc: 10, scale: 'minor', mode: 'minor' });
    expect(parseKey('??')).toEqual({ rootPc: 0, scale: 'major', mode: 'major' });
  });
});

describe('keyRootMidi / degreeToMidi', () => {
  it('anchors the tonic near C4', () => {
    expect(keyRootMidi('C maj')).toBe(60);
    expect(keyRootMidi('A min')).toBe(57);
    expect(keyRootMidi('D maj')).toBe(62);
  });

  it('maps scale degrees with octave wrap', () => {
    expect(degreeToMidi(60, 'major', 0)).toBe(60);
    expect(degreeToMidi(60, 'major', 4)).toBe(67); // G4
    expect(degreeToMidi(60, 'major', 7)).toBe(72); // C5
    expect(degreeToMidi(60, 'minor', 2)).toBe(63); // Eb in C minor
  });
});

describe('chords', () => {
  it('builds chord voicings', () => {
    expect(buildChord(60, 'maj')).toEqual([60, 64, 67]);
    expect(buildChord(57, 'min7')).toEqual([57, 60, 64, 67]);
  });

  it('cycles diatonic chords within the key', () => {
    expect(cycleDiatonicChord('C', 'C maj', 1)).toBe('Dm');
    expect(cycleDiatonicChord('C', 'C maj', -1)).toBe('Bdim');
    expect(cycleDiatonicChord('G', 'C maj', 1)).toBe('Am');
    expect(cycleDiatonicChord('garbage', 'C maj', 1)).toBe('C');
  });

  it('parses chord symbols incl. slash chords', () => {
    expect(parseChordSymbol('Am7')).toEqual({ rootPc: 9, quality: 'min7', bassPc: undefined });
    expect(parseChordSymbol('C#dim')).toEqual({ rootPc: 1, quality: 'dim', bassPc: undefined });
    expect(parseChordSymbol('Bb/F')?.bassPc).toBe(5);
    expect(parseChordSymbol('Gsus4')?.quality).toBe('sus4');
    expect(parseChordSymbol('D9')?.quality).toBe('dom9');
    expect(parseChordSymbol('not a chord')).toBeNull();
  });

  it('round-trips symbol formatting', () => {
    expect(formatChordSymbol(9, 'min7')).toBe('Am7');
    expect(formatChordSymbol(0, 'maj')).toBe('C');
    expect(formatChordSymbol(10, 'maj', 5)).toBe('Bb/F');
  });

  it('derives diatonic chords per key', () => {
    expect(diatonicChord('C maj', 0)).toEqual({ rootPc: 0, quality: 'maj', bassPc: undefined });
    expect(diatonicChord('C maj', 5).quality).toBe('min'); // Am
    expect(diatonicChord('A min', 5).quality).toBe('maj'); // F in A minor
    expect(diatonicChord('C maj', 1, true).quality).toBe('min7'); // Dm7
    expect(formatChordSymbol(diatonicChord('G maj', 4).rootPc, diatonicChord('G maj', 4).quality)).toBe('D');
  });
});

describe('progressions', () => {
  it('resolves every library progression in any key', () => {
    for (const prog of PROGRESSIONS) {
      const chords = progressionChords(prog, 'Eb maj');
      expect(chords).toHaveLength(prog.degrees.length);
      for (const c of chords) expect(c.quality).toBeTruthy();
    }
  });

  it('resolves pop I–V–vi–IV in C', () => {
    const chords = progressionChords(PROGRESSIONS[0], 'C maj').map((c) => formatChordSymbol(c.rootPc, c.quality));
    expect(chords).toEqual(['C', 'G', 'Am', 'F']);
  });
});

describe('rng & swing', () => {
  it('mulberry32 is deterministic', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('swing delays offbeats only', () => {
    expect(swingBeat(0, 50)).toBe(0);
    expect(swingBeat(1, 50)).toBe(1);
    const off = swingBeat(0.5, 60);
    expect(off).toBeGreaterThan(0.5);
    expect(off).toBeLessThan(0.8);
    expect(swingBeat(0.5, 0)).toBe(0.5);
  });

  it('pcToName round-trips', () => {
    expect(pcToName(0)).toBe('C');
    expect(pcToName(10, true)).toBe('Bb');
    expect(pcToName(13)).toBe('C#');
  });
});
