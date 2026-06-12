/** Re-record clip at a target playback rate for slow-mo export. */
export async function exportClipAtPlaybackRate(
  blob: Blob,
  mimeType: string,
  playbackRate: number,
): Promise<Blob> {
  if (playbackRate === 1) return blob;

  const url = URL.createObjectURL(blob);
  const video = document.createElement('video');
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.playbackRate = playbackRate;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Could not load clip for export'));
  });

  const stream = (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.()
    ?? (video as HTMLVideoElement & { mozCaptureStream?: () => MediaStream }).mozCaptureStream?.();
  if (!stream) {
    URL.revokeObjectURL(url);
    throw new Error('Browser does not support clip re-export');
  }

  const outMime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
    ? 'video/webm;codecs=vp9,opus'
    : mimeType;

  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, { mimeType: outMime, videoBitsPerSecond: 3_500_000 });

  await new Promise<void>((resolve, reject) => {
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => resolve();
    recorder.onerror = () => reject(new Error('Export recorder failed'));
    recorder.start(100);
    void video.play().catch(reject);
    video.onended = () => {
      if (recorder.state !== 'inactive') recorder.stop();
    };
    // Safety cap — real duration / playbackRate
    const maxMs = ((video.duration || 10) / Math.max(playbackRate, 0.1) + 2) * 1000;
    window.setTimeout(() => {
      if (recorder.state !== 'inactive') recorder.stop();
    }, maxMs);
  });

  URL.revokeObjectURL(url);
  video.remove();
  return new Blob(chunks, { type: outMime });
}
