import { pickRecorderMimeType } from './broadcast/pgmCaptureStream';
import { snapMarkRange } from './replayTimecode';

function waitForMetadata(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 1) {
      resolve();
      return;
    }
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Could not load clip for precise export'));
  });
}

function waitSeek(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    video.onseeked = () => resolve();
  });
}

/**
 * Re-encode a clip segment frame-by-frame for tighter in/out than chunk concatenation.
 * Falls back to the original blob when canvas capture is unavailable.
 */
export async function exportPreciseClipSegment(
  blob: Blob,
  inSec: number,
  outSec: number,
  fps = 30,
): Promise<Blob> {
  const snapped = snapMarkRange(inSec, outSec, fps);
  const mime = pickRecorderMimeType();
  if (!mime || typeof document === 'undefined') return blob;

  const url = URL.createObjectURL(blob);
  const video = document.createElement('video');
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  try {
    await waitForMetadata(video);
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return blob;

    const stream = canvas.captureStream(fps);
    const audioTracks = (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.()?.getAudioTracks() ?? [];
    for (const track of audioTracks) {
      if (track.readyState === 'live') stream.addTrack(track.clone());
    }

    const recorder = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: 4_000_000,
    });
    const chunks: Blob[] = [];

    await new Promise<void>((resolve, reject) => {
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => resolve();
      recorder.onerror = () => reject(new Error('Precise export recorder failed'));

      recorder.start(Math.max(40, Math.floor(1000 / fps)));

      const startFrame = Math.floor(snapped.inSec * fps);
      const endFrame = Math.ceil(snapped.outSec * fps);
      let frame = startFrame;

      const paintNext = async () => {
        if (frame > endFrame) {
          if (recorder.state !== 'inactive') recorder.stop();
          return;
        }
        video.currentTime = Math.min(video.duration || snapped.outSec, frame / fps);
        await waitSeek(video);
        ctx.drawImage(video, 0, 0, width, height);
        frame += 1;
        window.setTimeout(() => {
          void paintNext();
        }, Math.max(0, Math.floor(1000 / fps) - 2));
      };

      void paintNext();
    });

    if (chunks.length === 0) return blob;
    return new Blob(chunks, { type: mime });
  } catch {
    return blob;
  } finally {
    URL.revokeObjectURL(url);
    video.remove();
  }
}

export function isPreciseExportSupported(): boolean {
  return (
    typeof document !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    Boolean(pickRecorderMimeType()) &&
    typeof MediaRecorder !== 'undefined'
  );
}
