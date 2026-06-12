function pickRecorderMime(): string {
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) return 'video/webm;codecs=vp9,opus';
  if (MediaRecorder.isTypeSupported('video/webm')) return 'video/webm';
  return '';
}

export interface AngleCaptureResult {
  deviceId: string;
  label: string;
  blob: Blob;
  mimeType: string;
  durationSec: number;
}

/** Record a short burst from each live camera for multi-angle replay banks. */
export async function captureMultiAngleClips(
  devices: { deviceId: string; label: string }[],
  getStream: (deviceId: string) => MediaStream | null,
  durationSec = 3,
  maxAngles = 4,
): Promise<AngleCaptureResult[]> {
  const mime = pickRecorderMime();
  if (!mime) return [];

  const targets = devices.slice(0, maxAngles);
  const captures = await Promise.all(
    targets.map(async (device) => {
      const stream = getStream(device.deviceId);
      if (!stream?.getVideoTracks().some((t) => t.readyState === 'live')) return null;

      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3_000_000 });

      const blob = await new Promise<Blob | null>((resolve) => {
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        recorder.onstop = () => resolve(chunks.length ? new Blob(chunks, { type: mime }) : null);
        recorder.onerror = () => resolve(null);
        recorder.start(200);
        window.setTimeout(() => {
          if (recorder.state !== 'inactive') recorder.stop();
        }, durationSec * 1000);
      });

      if (!blob) return null;
      return {
        deviceId: device.deviceId,
        label: device.label,
        blob,
        mimeType: mime,
        durationSec,
      } satisfies AngleCaptureResult;
    }),
  );

  return captures.filter((c): c is AngleCaptureResult => c != null);
}

/** Extract marked segment duration from primary buffer marks or default burst length. */
export function multiAngleDuration(markIn: number | null, markOut: number | null, fallback = 3): number {
  if (markIn != null && markOut != null) {
    return Math.max(0.5, Math.min(Math.abs(markOut - markIn), 30));
  }
  return fallback;
}
