/** Merge program video with optional microphone / mixer audio for RTMP and recording. */

export function mergeProgramStream(
  videoStream: MediaStream | null,
  audioStream: MediaStream | null,
): MediaStream | null {
  if (!videoStream?.getVideoTracks().length) return null;
  const merged = new MediaStream();
  for (const track of videoStream.getVideoTracks()) merged.addTrack(track);
  if (audioStream) {
    for (const track of audioStream.getAudioTracks()) {
      if (track.readyState === 'live') merged.addTrack(track);
    }
  }
  return merged;
}

export function audioFromVideoElement(video: HTMLVideoElement | null): MediaStream | null {
  if (!video?.srcObject || !(video.srcObject instanceof MediaStream)) return null;
  const audioTracks = video.srcObject.getAudioTracks().filter((t) => t.readyState === 'live');
  if (!audioTracks.length) return null;
  const stream = new MediaStream();
  for (const track of audioTracks) stream.addTrack(track);
  return stream;
}

export function combineAudioSources(...sources: (MediaStream | null | undefined)[]): MediaStream | null {
  const out = new MediaStream();
  for (const source of sources) {
    if (!source) continue;
    for (const track of source.getAudioTracks()) {
      if (track.readyState === 'live' && !out.getAudioTracks().some((t) => t.id === track.id)) {
        out.addTrack(track);
      }
    }
  }
  return out.getAudioTracks().length ? out : null;
}
