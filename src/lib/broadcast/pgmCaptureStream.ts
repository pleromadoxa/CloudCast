import {
  hasPgmVideoSignal,
  PgmProgramCapture,
  type PgmProgramCaptureOptions,
} from './pgmProgramCapture';

/** Returns the live MediaStream attached to the PGM preview video element (video only). */
export function pgmCaptureStream(videoEl: HTMLVideoElement | null): MediaStream | null {
  if (!videoEl?.srcObject) return null;
  const stream = videoEl.srcObject as MediaStream;
  if (stream.getVideoTracks().length === 0) return null;
  return stream;
}

export function pickRecorderMimeType(): string | null {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return null;
}

export interface PgmBroadcastCapture {
  stream: MediaStream;
  stop: () => void;
  setFadeToBlackLevel: (level: number) => void;
}

/** Prefer full program view (PGM monitor composite); fall back to raw PGM video. */
export function createPgmBroadcastCapture(
  outputContainer: HTMLElement | null,
  videoEl: HTMLVideoElement | null,
  fadeToBlackLevel = 0,
  broadcastAudioStream?: MediaStream | null,
): PgmBroadcastCapture | null {
  if (outputContainer && hasPgmVideoSignal(outputContainer)) {
    const capture = new PgmProgramCapture();
    const stream = capture.start({
      container: outputContainer,
      audioVideo: videoEl,
      broadcastAudioStream,
      fadeToBlackLevel,
    } satisfies PgmProgramCaptureOptions);
    return {
      stream,
      stop: () => capture.stop(),
      setFadeToBlackLevel: (level) => capture.setFadeToBlackLevel(level),
    };
  }

  const raw = pgmCaptureStream(videoEl);
  if (!raw) return null;

  return {
    stream: raw,
    stop: () => {},
    setFadeToBlackLevel: () => {},
  };
}
