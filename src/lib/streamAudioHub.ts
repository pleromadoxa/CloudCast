/** Share one MediaStreamAudioSourceNode per stream per AudioContext (Web Audio allows only one). */

type HubEntry = {
  source: MediaStreamAudioSourceNode;
  consumers: number;
};

const hubs = new WeakMap<AudioContext, Map<string, HubEntry>>();

function hubFor(ctx: AudioContext): Map<string, HubEntry> {
  let map = hubs.get(ctx);
  if (!map) {
    map = new Map();
    hubs.set(ctx, map);
  }
  return map;
}

export function hasUsableAudio(stream: MediaStream | null | undefined): boolean {
  if (!stream) return false;
  return stream.getAudioTracks().some((track) => track.readyState !== 'ended');
}

export function hasUsableVideo(stream: MediaStream | null | undefined): boolean {
  if (!stream) return false;
  return stream.getVideoTracks().some((track) => track.readyState !== 'ended');
}

/** True when a mesh/WHEP stream carries media the dashboard can mark live. */
export function streamHasActiveMedia(
  stream: MediaStream | null | undefined,
  options?: { requireAudio?: boolean; requireVideo?: boolean },
): boolean {
  if (!stream) return false;
  const hasAudio = hasUsableAudio(stream);
  const hasVideo = hasUsableVideo(stream);
  if (options?.requireAudio) return hasAudio;
  if (options?.requireVideo) return hasVideo;
  return hasVideo || hasAudio;
}

/** Regal Mesh: one peer connection should carry both camera picture and mic. */
export function meshStreamHasBothMedia(stream: MediaStream | null | undefined): boolean {
  return hasUsableVideo(stream) && hasUsableAudio(stream);
}

/** Merge remote tracks into a single per-device stream (replace ended tracks of the same kind). */
export function mergeTrackIntoStream(
  existing: MediaStream | null | undefined,
  track: MediaStreamTrack,
  fallback?: MediaStream | null,
): MediaStream {
  const base = existing ?? fallback ?? new MediaStream();
  for (const old of [...base.getTracks()]) {
    if (old.kind === track.kind && old.readyState === 'ended' && old.id !== track.id) {
      try {
        base.removeTrack(old);
      } catch {
        /* ignore */
      }
    }
  }
  if (!base.getTracks().some((t) => t.id === track.id)) {
    base.addTrack(track);
  }
  return base;
}

export function mergeTracksIntoStream(
  existing: MediaStream | null | undefined,
  tracks: MediaStreamTrack[],
  fallback?: MediaStream | null,
): MediaStream {
  let stream = existing ?? fallback ?? new MediaStream();
  for (const track of tracks) {
    stream = mergeTrackIntoStream(stream, track);
  }
  return stream;
}

/** Changes when tracks are added/removed or change state — use to re-wire mixer channels. */
export function streamWireKey(stream: MediaStream): string {
  const parts = stream
    .getTracks()
    .map((t) => `${t.kind}:${t.id}:${t.readyState}:${t.enabled ? 1 : 0}:${t.muted ? 1 : 0}`)
    .join('|');
  return `${stream.id}#${parts || 'none'}`;
}

export function acquireStreamSource(
  ctx: AudioContext,
  stream: MediaStream,
): MediaStreamAudioSourceNode | null {
  const key = stream.id;
  const hub = hubFor(ctx);
  const existing = hub.get(key);
  if (existing) {
    existing.consumers += 1;
    return existing.source;
  }

  try {
    const source = ctx.createMediaStreamSource(stream);
    hub.set(key, { source, consumers: 1 });
    return source;
  } catch (err) {
    console.warn('[CloudCast] MediaStreamSource unavailable:', err);
    return null;
  }
}

export function releaseStreamSource(ctx: AudioContext, stream: MediaStream): void {
  const key = stream.id;
  const hub = hubFor(ctx);
  const entry = hub.get(key);
  if (!entry) return;

  entry.consumers -= 1;
  if (entry.consumers <= 0) {
    try {
      entry.source.disconnect();
    } catch {
      /* ignore */
    }
    hub.delete(key);
  }
}
