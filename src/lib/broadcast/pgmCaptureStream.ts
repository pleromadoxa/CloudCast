import {
  hasPgmOutputReady,
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
  // VP8 is preferred over VP9 for live relaying: VP9 in a chunked MediaRecorder/WebM
  // pipe is fragile and produces "zero_bit out of range" decode errors in FFmpeg when
  // the network jitters. VP8 streams piece together far more reliably under bad networks.
  const candidates = [
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm;codecs=vp9,opus',
    'video/webm',
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return null;
}

/** Target video bitrate (bps) chosen from the network estimate, clamped to a safe range. */
export const BROADCAST_MAX_BITRATE = 2_500_000;
export const BROADCAST_MIN_BITRATE = 500_000;

export function pickInitialVideoBitrate(): number {
  if (typeof navigator === 'undefined') return BROADCAST_MAX_BITRATE;
  const conn = (navigator as Navigator & {
    connection?: { effectiveType?: string; downlink?: number };
  }).connection;
  if (!conn) return BROADCAST_MAX_BITRATE;

  const effective = conn.effectiveType;
  if (effective === 'slow-2g' || effective === '2g') return BROADCAST_MIN_BITRATE;
  if (effective === '3g') return 1_200_000;

  if (typeof conn.downlink === 'number' && conn.downlink > 0) {
    // downlink is a Mbps estimate; budget ~50% to leave headroom for the upload path.
    const budget = Math.round(conn.downlink * 1_000_000 * 0.5);
    return Math.min(BROADCAST_MAX_BITRATE, Math.max(BROADCAST_MIN_BITRATE, budget));
  }
  return BROADCAST_MAX_BITRATE;
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
  if (outputContainer && hasPgmOutputReady(outputContainer)) {
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
