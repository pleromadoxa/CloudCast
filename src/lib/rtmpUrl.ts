export interface ParsedRtmpUrl {
  host: string;
  port: number;
  app: string;
  tls: boolean;
  tcUrl: string;
}

export function parseRtmpUrl(raw: string): ParsedRtmpUrl {
  const trimmed = raw.trim();
  if (!/^rtmps?:\/\//i.test(trimmed)) {
    throw new Error('Stream URL must start with rtmp:// or rtmps://');
  }

  const tls = /^rtmps:\/\//i.test(trimmed);
  const withoutScheme = trimmed.replace(/^rtmps?:\/\//i, '');
  const slashIdx = withoutScheme.indexOf('/');
  const hostPart = slashIdx >= 0 ? withoutScheme.slice(0, slashIdx) : withoutScheme;
  const pathPart = slashIdx >= 0 ? withoutScheme.slice(slashIdx + 1) : '';

  const [host, portStr] = hostPart.split(':');
  if (!host) throw new Error('Stream URL is missing a host name.');

  const port = portStr ? Number(portStr) : tls ? 443 : 1935;
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error('Stream URL has an invalid port.');
  }

  const app = pathPart.replace(/\/+$/, '') || 'live';
  const scheme = tls ? 'rtmps' : 'rtmp';
  const tcUrl = `${scheme}://${hostPart}/${app}`;

  return { host, port, app, tls, tcUrl };
}

export function isValidStreamConfig(streamUrl: string, streamKey: string): string | null {
  if (!streamUrl.trim()) return 'Stream URL / host is required.';
  if (!streamKey.trim()) return 'Stream key is required.';
  if (streamKey.trim().length < 4) return 'Stream key looks too short.';
  try {
    parseRtmpUrl(streamUrl);
  } catch (e) {
    return e instanceof Error ? e.message : 'Invalid stream URL.';
  }
  return null;
}
