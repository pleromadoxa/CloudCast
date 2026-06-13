import { snapMarkRange } from './replayTimecode';

export interface TimestampedChunk {
  blob: Blob;
  atMs: number;
}

export function bufferStartMs(chunks: TimestampedChunk[], fallbackMs: number): number {
  if (chunks.length === 0) return fallbackMs;
  return chunks[0]!.atMs;
}

export function selectChunksForWindow(
  chunks: TimestampedChunk[],
  bufferStartMs: number,
  fromSec: number,
  toSec: number,
  paddingMs = 300,
): TimestampedChunk[] {
  const fromMs = bufferStartMs + fromSec * 1000;
  const toMs = bufferStartMs + toSec * 1000;
  return chunks.filter((c) => c.atMs >= fromMs - paddingMs && c.atMs <= toMs + paddingMs);
}

export function mergeChunksToBlob(chunks: TimestampedChunk[], mimeType: string): Blob | null {
  if (chunks.length === 0) return null;
  return new Blob(
    chunks.map((c) => c.blob),
    { type: mimeType || 'video/webm' },
  );
}

export function extractMarkedClip(params: {
  chunks: TimestampedChunk[];
  bufferStartMs: number;
  markInSec: number | null;
  markOutSec: number | null;
  nowMs: number;
  mimeType: string;
  minDurationSec?: number;
  fps?: number;
  snapFrames?: boolean;
}): { blob: Blob; mimeType: string; durationSec: number; inSec: number; outSec: number } | null {
  const { chunks, bufferStartMs: startMs, markInSec, markOutSec, nowMs, mimeType } = params;
  const minDurationSec = params.minDurationSec ?? 0.05;
  const fps = params.fps ?? 30;

  if (chunks.length === 0) return null;

  let inSec = markInSec ?? 0;
  let outSec = markOutSec ?? (nowMs - startMs) / 1000;

  if (params.snapFrames !== false) {
    const snapped = snapMarkRange(inSec, outSec, fps);
    inSec = snapped.inSec;
    outSec = snapped.outSec;
  }

  const fromSec = Math.min(inSec, outSec);
  const toSec = Math.max(inSec, outSec);
  const durationSec = toSec - fromSec;

  if (durationSec < minDurationSec) return null;

  const selected = selectChunksForWindow(chunks, startMs, fromSec, toSec);
  const blob = mergeChunksToBlob(selected, mimeType);
  if (!blob || blob.size === 0) return null;

  return { blob, mimeType: mimeType || 'video/webm', durationSec, inSec: fromSec, outSec: toSec };
}

export function computeBufferSeconds(chunks: TimestampedChunk[], maxSeconds: number, nowMs: number): number {
  if (chunks.length === 0) return 0;
  const oldest = chunks[0]!.atMs;
  return Math.min(maxSeconds, (nowMs - oldest) / 1000);
}

export function pruneChunksBefore(chunks: TimestampedChunk[], maxSeconds: number, nowMs: number): TimestampedChunk[] {
  const cutoff = nowMs - maxSeconds * 1000;
  return chunks.filter((c) => c.atMs >= cutoff);
}
