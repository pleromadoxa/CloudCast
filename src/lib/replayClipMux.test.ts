import { describe, expect, it } from 'vitest';
import {
  bufferStartMs,
  computeBufferSeconds,
  extractMarkedClip,
  mergeChunksToBlob,
  pruneChunksBefore,
  selectChunksForWindow,
} from './replayClipMux';

describe('replayClipMux', () => {
  const chunks = [
    { blob: new Blob(['a']), atMs: 1000 },
    { blob: new Blob(['b']), atMs: 1250 },
    { blob: new Blob(['c']), atMs: 1500 },
    { blob: new Blob(['d']), atMs: 2000 },
  ];

  it('selects chunks inside mark window with padding', () => {
    const selected = selectChunksForWindow(chunks, 1000, 0.2, 0.6);
    expect(selected.map((c) => c.atMs)).toEqual([1000, 1250, 1500]);
  });

  it('extracts marked clip with duration', () => {
    const clip = extractMarkedClip({
      chunks,
      bufferStartMs: 1000,
      markInSec: 0,
      markOutSec: 1,
      nowMs: 2000,
      mimeType: 'video/webm',
    });
    expect(clip).not.toBeNull();
    expect(clip!.durationSec).toBe(1);
    expect(clip!.blob.size).toBeGreaterThan(0);
  });

  it('prunes chunks older than max buffer', () => {
    const pruned = pruneChunksBefore(chunks, 1, 3000);
    expect(pruned).toHaveLength(1);
    expect(pruned[0]!.atMs).toBe(2000);
  });

  it('computes buffer seconds from oldest chunk', () => {
    expect(computeBufferSeconds(chunks, 10, 2500)).toBe(1.5);
    expect(bufferStartMs(chunks, 999)).toBe(1000);
  });

  it('returns null for empty merge', () => {
    expect(mergeChunksToBlob([], 'video/webm')).toBeNull();
  });
});
