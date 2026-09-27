import { describe, expect, it } from 'vitest';
import {
  analyzePrompt, composeSong, describeSong, generateLyrics, songToProjectPatch,
} from './aiComposer';

describe('analyzePrompt', () => {
  it('detects genre, mood, key and tempo hints', () => {
    const a = analyzePrompt('dark cinematic trailer in D minor with an epic chorus');
    expect(a.genre).toBe('orchestral');
    expect(a.mood).toBe('dark'); // first keyword match wins deterministically
    expect(a.keyHint).toBe('D min');

    const b = analyzePrompt('lofi chill study beats');
    expect(b.genre).toBe('lofi');
    expect(b.tempoHint).toBe(88);

    const c = analyzePrompt('fast energetic trap banger with 808s');
    expect(c.genre).toBe('trap');
    expect(c.mood).toBe('energetic');
    expect(c.tempoHint).toBe(142);

    const d = analyzePrompt('something unrecognizable');
    expect(d.genre).toBe('pop');
    expect(d.mood).toBe('neutral');
  });
});

describe('composeSong', () => {
  const song = composeSong({ prompt: 'uplifting pop anthem with bright synths', seed: 7 });

  it('is deterministic per seed', () => {
    const again = composeSong({ prompt: 'uplifting pop anthem with bright synths', seed: 7 });
    expect(again.tracks).toEqual(song.tracks);
    expect(again.chordEvents).toEqual(song.chordEvents);
    expect(again.title).toBe(song.title);
  });

  it('produces a full arrangement with structure', () => {
    expect(song.arrangement.length).toBeGreaterThanOrEqual(5);
    expect(song.arrangement[0].startBar).toBe(0);
    // sections are contiguous
    for (let i = 1; i < song.arrangement.length; i++) {
      const prev = song.arrangement[i - 1];
      expect(song.arrangement[i].startBar).toBe(prev.startBar + prev.lengthBars);
    }
  });

  it('produces tracks with non-empty regions and valid note data', () => {
    expect(song.tracks.length).toBeGreaterThanOrEqual(4);
    for (const t of song.tracks) {
      expect(t.instrumentId).toBeTruthy();
      for (const r of t.regions) {
        expect(r.notes.length).toBeGreaterThan(0);
        for (const n of r.notes) {
          expect(n.startBeat).toBeGreaterThanOrEqual(0);
          expect(n.startBeat).toBeLessThan(r.lengthBars * 4 + 1);
          expect(n.durationBeats).toBeGreaterThan(0);
          expect(n.velocity).toBeGreaterThan(0);
          expect(n.velocity).toBeLessThanOrEqual(127);
          expect(n.pitch).toBeGreaterThanOrEqual(0);
          expect(n.pitch).toBeLessThanOrEqual(127);
        }
      }
    }
  });

  it('drums use the engine drum map (kick 36, snare 38, hats 42+)', () => {
    const drums = song.tracks.find((t) => t.name === 'AI Drums');
    expect(drums).toBeTruthy();
    const pitches = new Set(drums!.regions.flatMap((r) => r.notes.map((n) => n.pitch)));
    expect(pitches.has(36)).toBe(true); // kick
    for (const p of pitches) expect(p).toBeGreaterThanOrEqual(36);
    for (const p of pitches) expect(p).toBeLessThanOrEqual(46);
  });

  it('chord track covers the whole song bar-by-bar', () => {
    const totalBars = song.arrangement.reduce((s, sec) => s + sec.lengthBars, 0);
    const covered = song.chordEvents.reduce((s, e) => s + e.lengthBars, 0);
    expect(covered).toBe(totalBars);
    expect(song.chordEvents[0].bar).toBe(0);
  });

  it('respects option overrides', () => {
    const custom = composeSong({ prompt: 'anything', seed: 1, key: 'F maj', tempo: 99, energy: 90 });
    expect(custom.style.key).toBe('F maj');
    expect(custom.style.tempo).toBe(99);
    expect(custom.style.energy).toBe(90);
  });

  it('different seeds give different melodies', () => {
    const a = composeSong({ prompt: 'dreamy ambient', seed: 1 });
    const b = composeSong({ prompt: 'dreamy ambient', seed: 2 });
    const aNotes = JSON.stringify(a.tracks.map((t) => t.regions.map((r) => r.notes)));
    const bNotes = JSON.stringify(b.tracks.map((t) => t.regions.map((r) => r.notes)));
    expect(aNotes).not.toBe(bNotes);
  });

  it('includes lyrics and a description', () => {
    expect(song.lyrics).toContain('[Chorus]');
    expect(song.lyrics).toContain('[Verse 1]');
    expect(describeSong(song)).toContain('BPM');
  });
});

describe('songToProjectPatch', () => {
  it('produces valid project-ready tracks and regions', () => {
    const song = composeSong({ prompt: 'dark trap beat', seed: 3 });
    const patch = songToProjectPatch(song);
    expect(patch.tracks.length).toBe(song.tracks.length);
    expect(patch.regions.length).toBeGreaterThan(0);
    for (const t of patch.tracks) {
      expect(t.id).toBeTruthy();
      expect(t.fx).toBeTruthy();
    }
    const ids = new Set(patch.tracks.map((t) => t.id));
    for (const r of patch.regions) {
      expect(ids.has(r.trackId)).toBe(true);
      expect(r.notes!.length).toBeGreaterThan(0);
    }
    expect(patch.arrangement.length).toBe(song.arrangement.length);
    expect(patch.markers.length).toBe(song.arrangement.length);
    expect(patch.chordTrack).toBe(song.chordEvents);
  });
});

describe('generateLyrics', () => {
  it('matches the mood word bank', () => {
    const lyrics = generateLyrics(
      { mood: 'dark' } as never,
      'Shadowline',
    );
    expect(lyrics).toContain('Shadowline');
    expect(lyrics.split('\n').length).toBeGreaterThan(10);
  });
});
