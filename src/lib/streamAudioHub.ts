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
  options?: { requireAudio?: boolean },
): boolean {
  if (!stream) return false;
  const requireAudio = options?.requireAudio ?? false;
  const hasAudio = hasUsableAudio(stream);
  if (requireAudio) return hasAudio;
  return hasUsableVideo(stream) || hasAudio;
}

/** Changes when tracks are added/removed or change state — use to re-wire mixer channels. */
export function streamWireKey(stream: MediaStream): string {
  const tracks = stream
    .getAudioTracks()
    .map((t) => `${t.id}:${t.readyState}:${t.enabled ? 1 : 0}`)
    .join('|');
  return `${stream.id}#${tracks || 'none'}`;
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
