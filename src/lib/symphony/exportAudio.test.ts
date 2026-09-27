import { describe, expect, it } from 'vitest';
import {
  encodeAiff,
  encodeWav,
  estimateFileSizeBytes,
  normalizeBuffer,
  renderWindowBeats,
  stemTracks,
} from './exportAudio';
import { defaultExportSettings, type SymphonyProject } from '../../types/symphony';

/** Minimal AudioBuffer stand-in (the encoders only touch these members). */
function fakeBuffer(channels: number, frames: number, sampleRate: number, fill = 0.5): AudioBuffer {
  const data = Array.from({ length: channels }, () => {
    const arr = new Float32Array(frames);
    arr.fill(fill);
    return arr;
  });
  return {
    numberOfChannels: channels,
    length: frames,
    sampleRate,
    getChannelData: (ch: number) => data[ch],
  } as unknown as AudioBuffer;
}

async function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

describe('encodeWav', () => {
  it('writes a valid 16-bit RIFF/WAVE header', async () => {
    const buffer = fakeBuffer(2, 100, 44100);
    const blob = encodeWav(buffer, 16, false);
    const bytes = await blobBytes(blob);
    const view = new DataView(bytes.buffer);

    expect(readAscii(bytes, 0, 4)).toBe('RIFF');
    expect(readAscii(bytes, 8, 4)).toBe('WAVE');
    expect(readAscii(bytes, 12, 4)).toBe('fmt ');
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(2); // channels
    expect(view.getUint32(24, true)).toBe(44100);
    expect(view.getUint16(34, true)).toBe(16); // bit depth
    expect(readAscii(bytes, 36, 4)).toBe('data');
    expect(view.getUint32(40, true)).toBe(100 * 2 * 2); // frames * ch * bytes
    expect(bytes.length).toBe(44 + 100 * 2 * 2);
  });

  it('writes 24-bit samples as three bytes', async () => {
    const buffer = fakeBuffer(1, 4, 48000);
    const blob = encodeWav(buffer, 24, false);
    const bytes = await blobBytes(blob);
    const view = new DataView(bytes.buffer);
    expect(view.getUint16(34, true)).toBe(24);
    expect(view.getUint32(40, true)).toBe(4 * 3);
    expect(bytes.length).toBe(44 + 12);
    // Math.round(0.5 * 0x7fffff) = 0x400000 stored little-endian
    expect(bytes[44]).toBe(0x00);
    expect(bytes[45]).toBe(0x00);
    expect(bytes[46]).toBe(0x40);
  });
});

describe('encodeAiff', () => {
  it('writes FORM/COMM/SSND chunks with big-endian PCM', async () => {
    const buffer = fakeBuffer(2, 50, 44100);
    const blob = encodeAiff(buffer, 16, false);
    const bytes = await blobBytes(blob);
    const view = new DataView(bytes.buffer);

    expect(readAscii(bytes, 0, 4)).toBe('FORM');
    expect(readAscii(bytes, 8, 4)).toBe('AIFF');
    expect(readAscii(bytes, 12, 4)).toBe('COMM');
    expect(view.getUint32(16, false)).toBe(18); // COMM size
    expect(view.getUint16(20, false)).toBe(2); // channels
    expect(view.getUint32(22, false)).toBe(50); // sample frames
    expect(view.getUint16(26, false)).toBe(16); // sample size
    // 44100 Hz in 80-bit extended: exponent 0x400E, mantissa starts 0xAC44
    expect(view.getUint16(28, false)).toBe(0x400e);
    expect(view.getUint16(30, false)).toBe(0xac44);

    expect(readAscii(bytes, 38, 4)).toBe('SSND');
    expect(view.getUint32(42, false)).toBe(8 + 50 * 2 * 2);
    // big-endian sample: Math.round(0.5 * 0x7fff) = 0x4000
    expect(bytes[54]).toBe(0x40);
    expect(bytes[55]).toBe(0x00);
  });
});

describe('normalizeBuffer', () => {
  it('scales peak amplitude to −1 dBFS', () => {
    const buffer = fakeBuffer(1, 10, 44100, 0.25);
    normalizeBuffer(buffer);
    const peak = buffer.getChannelData(0)[0];
    expect(peak).toBeCloseTo(Math.pow(10, -1 / 20), 5);
  });

  it('leaves silent buffers untouched', () => {
    const buffer = fakeBuffer(1, 10, 44100, 0);
    normalizeBuffer(buffer);
    expect(buffer.getChannelData(0)[0]).toBe(0);
  });
});

describe('renderWindowBeats', () => {
  const project = {
    tempo: 120,
    tracks: [],
    regions: [
      { id: 'r1', trackId: 't1', name: 'A', startBar: 2, lengthBars: 4 },
    ],
  } as unknown as SymphonyProject;

  it('spans the whole project by default', () => {
    const win = renderWindowBeats(project, { sampleRate: 44100, range: 'project', includeTail: true });
    expect(win.startBeat).toBe(0);
    expect(win.endBeat).toBe(32); // 8-bar minimum floor
  });

  it('honours the cycle region when requested', () => {
    const cycled = { ...project, useCycleRegion: true, cycleStartBar: 1, cycleEndBar: 3 };
    const win = renderWindowBeats(cycled, { sampleRate: 44100, range: 'cycle', includeTail: true });
    expect(win.startBeat).toBe(4);
    expect(win.endBeat).toBe(12);
  });
});

describe('estimateFileSizeBytes', () => {
  it('estimates PCM size from sample rate and depth', () => {
    const settings = { ...defaultExportSettings('x'), format: 'wav' as const, bitDepth: 16 as const, sampleRate: 44100 };
    expect(estimateFileSizeBytes(settings, 10)).toBe(10 * 44100 * 2 * 2);
  });

  it('estimates MP3 size from bitrate', () => {
    const settings = { ...defaultExportSettings('x'), format: 'mp3' as const, mp3BitrateKbps: 320 as const };
    expect(estimateFileSizeBytes(settings, 10)).toBe((320 * 1000 / 8) * 10);
  });
});

describe('stemTracks', () => {
  const track = (id: string, patch: Record<string, unknown> = {}) =>
    ({ id, name: id, muted: false, solo: false, ...patch }) as unknown as SymphonyProject['tracks'][number];

  it('returns every unmuted track when nothing is soloed', () => {
    const project = {
      tracks: [track('a'), track('b'), track('c', { muted: true })],
    } as unknown as SymphonyProject;
    expect(stemTracks(project).map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('restricts to soloed tracks when any solo is active', () => {
    const project = {
      tracks: [track('a'), track('b', { solo: true }), track('c', { solo: true, muted: true })],
    } as unknown as SymphonyProject;
    expect(stemTracks(project).map((t) => t.id)).toEqual(['b']);
  });
});
