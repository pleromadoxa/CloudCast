import { hasUsableAudio, hasUsableVideo } from './streamAudioHub';

export function hasLiveVideoStream(stream: MediaStream | null | undefined): boolean {
  if (!stream) return false;
  return stream.getVideoTracks().some((track) => track.readyState === 'live');
}

export function hasLiveAudioStream(stream: MediaStream | null | undefined): boolean {
  if (!stream) return false;
  return stream.getAudioTracks().some((track) => track.readyState === 'live');
}

/**
 * Regal Cloud Pro+: prefer WHEP (paid cloud ingest), fall back to mesh P2P immediately when cloud is unavailable.
 */
export function resolveHybridVideoStream(
  mesh: MediaStream | null | undefined,
  whep: MediaStream | null | undefined,
): MediaStream | null {
  if (hasLiveVideoStream(whep)) return whep ?? null;
  if (hasUsableVideo(whep)) return whep ?? null;
  if (hasLiveVideoStream(mesh)) return mesh ?? null;
  if (hasUsableVideo(mesh)) return mesh ?? null;
  return whep ?? mesh ?? null;
}

/** Low-latency mesh audio first; WHEP audio when mesh is unavailable (seamless across mixers). */
export function resolveHybridAudioStream(
  mesh: MediaStream | null | undefined,
  whep: MediaStream | null | undefined,
): MediaStream | null {
  if (hasLiveAudioStream(mesh)) return mesh ?? null;
  if (hasUsableAudio(mesh)) return mesh ?? null;
  if (hasLiveAudioStream(whep)) return whep ?? null;
  if (hasUsableAudio(whep)) return whep ?? null;
  return mesh ?? whep ?? null;
}

export function hybridVideoActive(
  mesh: MediaStream | null | undefined,
  whep: MediaStream | null | undefined,
): boolean {
  return hasLiveVideoStream(mesh) || hasLiveVideoStream(whep) || hasUsableVideo(mesh) || hasUsableVideo(whep);
}

export function hybridAudioActive(
  mesh: MediaStream | null | undefined,
  whep: MediaStream | null | undefined,
): boolean {
  return hasLiveAudioStream(mesh) || hasLiveAudioStream(whep) || hasUsableAudio(mesh) || hasUsableAudio(whep);
}

/** Which ingress path is carrying picture for UI diagnostics. */
export function activeHybridVideoSource(
  mesh: MediaStream | null | undefined,
  whep: MediaStream | null | undefined,
): 'whep' | 'mesh' | 'none' {
  const stream = resolveHybridVideoStream(mesh, whep);
  if (!stream) return 'none';
  if (whep && stream === whep) return 'whep';
  if (mesh && stream === mesh) return 'mesh';
  if (hasLiveVideoStream(whep) || hasUsableVideo(whep)) return 'whep';
  if (hasLiveVideoStream(mesh) || hasUsableVideo(mesh)) return 'mesh';
  return 'none';
}
