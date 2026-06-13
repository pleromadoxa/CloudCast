import { secondsToTimecode } from './replayTimecode';
import { downloadBlobLocally } from './replayClipService';

export interface EdlClipSource {
  label: string;
  durationSec: number;
  inSec?: number;
  outSec?: number;
  timecodeIn?: string | null;
  timecodeOut?: string | null;
  frameRate?: number | null;
  reelName?: string;
}

function padEdlField(value: string, length: number): string {
  if (value.length >= length) return value.slice(0, length);
  return value.padEnd(length, ' ');
}

function smpteForEdl(seconds: number, fps = 30): string {
  const tc = secondsToTimecode(Math.max(0, seconds), fps);
  const pad2 = (n: number) => String(n).padStart(2, '0');
  return `${pad2(tc.hours)}:${pad2(tc.minutes)}:${pad2(tc.seconds)}:${pad2(tc.frames)}`;
}

function resolveRecordRange(clip: EdlClipSource): { srcIn: string; srcOut: string; recIn: string; recOut: string } {
  const fps = clip.frameRate ?? 30;
  const inSec = clip.inSec ?? 0;
  const outSec = clip.outSec ?? clip.durationSec;
  const duration = Math.max(0.04, outSec - inSec);

  const srcIn = clip.timecodeIn ?? smpteForEdl(inSec, fps);
  const srcOut = clip.timecodeOut ?? smpteForEdl(outSec, fps);
  const recIn = smpteForEdl(0, fps);
  const recOut = smpteForEdl(duration, fps);

  return { srcIn, srcOut, recIn, recOut };
}

/** Build a simple CMX3600-style EDL for post-production handoff. */
export function buildCmx3600Edl(clips: EdlClipSource[], title = 'CloudCast Replay'): string {
  const lines: string[] = [`TITLE: ${title}`, 'FCM: NON-DROP FRAME', ''];

  clips.forEach((clip, index) => {
    const eventNum = String(index + 1).padStart(3, '0');
    const reel = padEdlField((clip.reelName ?? clip.label).replace(/\s+/g, '_').slice(0, 8), 8);
    const { srcIn, srcOut, recIn, recOut } = resolveRecordRange(clip);

    lines.push(
      `${eventNum}  ${reel} V     C        ${srcIn} ${srcOut} ${recIn} ${recOut}`,
      `* FROM CLIP: ${clip.label}`,
    );
    if (clip.timecodeIn || clip.timecodeOut) {
      lines.push(`* SRC TC: ${clip.timecodeIn ?? '—'} → ${clip.timecodeOut ?? '—'}`);
    }
    lines.push('');
  });

  return lines.join('\n');
}

export function downloadEdlFile(content: string, fileName: string): void {
  downloadBlobLocally(new Blob([content], { type: 'text/plain;charset=utf-8' }), fileName);
}

export function clipsToEdlSources(
  clips: Array<{
    label: string | null;
    fileName?: string;
    durationSec: number | null;
    inSec?: number | null;
    outSec?: number | null;
    timecodeIn?: string | null;
    timecodeOut?: string | null;
    frameRate?: number | null;
  }>,
): EdlClipSource[] {
  return clips.map((clip) => ({
    label: clip.label ?? clip.fileName ?? 'Replay clip',
    durationSec: clip.durationSec ?? 0,
    inSec: clip.inSec ?? undefined,
    outSec: clip.outSec ?? undefined,
    timecodeIn: clip.timecodeIn,
    timecodeOut: clip.timecodeOut,
    frameRate: clip.frameRate,
    reelName: clip.fileName,
  }));
}
