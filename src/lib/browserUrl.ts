export type BrowserUrlKind = 'youtube' | 'generic' | 'empty' | 'invalid';

export interface ResolvedBrowserUrl {
  kind: BrowserUrlKind;
  /** Canonical page URL (watch URL for YouTube). */
  activeUrl: string;
  /** URL loaded in the iframe (embed for YouTube). */
  embedUrl: string;
  /** YouTube video id when kind === 'youtube'. */
  youtubeId?: string;
  error?: string;
}

const YT_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

function ensureProtocol(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function extractYoutubeId(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (host === 'youtu.be' || host === 'www.youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return id || null;
  }
  if (!YT_HOSTS.has(host)) return null;

  if (url.pathname.startsWith('/embed/')) {
    return url.pathname.split('/')[2] || null;
  }
  if (url.pathname.startsWith('/shorts/')) {
    return url.pathname.split('/')[2] || null;
  }
  if (url.pathname.startsWith('/live/')) {
    return url.pathname.split('/')[2] || null;
  }
  const v = url.searchParams.get('v');
  if (v) return v;
  return null;
}

function isYoutubeHost(host: string): boolean {
  return YT_HOSTS.has(host.toLowerCase());
}

/** Build a YouTube embed URL with JS API enabled for mute control. */
export function youtubeEmbedUrl(videoId: string, opts?: { muted?: boolean }): string {
  const params = new URLSearchParams({
    enablejsapi: '1',
    origin: typeof window !== 'undefined' ? window.location.origin : '',
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    autoplay: '1',
  });
  if (opts?.muted) params.set('mute', '1');
  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
}

/**
 * Normalize an operator-entered address into an iframe-ready URL.
 * YouTube watch / short / share links become embeds with the IFrame API enabled.
 */
export function resolveBrowserUrl(raw: string, opts?: { muted?: boolean }): ResolvedBrowserUrl {
  const withProto = ensureProtocol(raw);
  if (!withProto) {
    return { kind: 'empty', activeUrl: '', embedUrl: '' };
  }

  let url: URL;
  try {
    url = new URL(withProto);
  } catch {
    return {
      kind: 'invalid',
      activeUrl: '',
      embedUrl: '',
      error: 'Enter a valid URL (e.g. https://example.com or a YouTube link).',
    };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return {
      kind: 'invalid',
      activeUrl: '',
      embedUrl: '',
      error: 'Only http and https URLs are supported.',
    };
  }

  if (isYoutubeHost(url.hostname)) {
    const id = extractYoutubeId(url);
    if (!id) {
      return {
        kind: 'invalid',
        activeUrl: '',
        embedUrl: '',
        error: 'Could not find a YouTube video id in that link.',
      };
    }
    const activeUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
    return {
      kind: 'youtube',
      activeUrl,
      embedUrl: youtubeEmbedUrl(id, { muted: opts?.muted }),
      youtubeId: id,
    };
  }

  return {
    kind: 'generic',
    activeUrl: url.toString(),
    embedUrl: url.toString(),
  };
}
