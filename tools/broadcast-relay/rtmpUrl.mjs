export function parseRtmpUrl(raw) {
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
  const app = pathPart.replace(/\/+$/, '') || 'live';
  const scheme = tls ? 'rtmps' : 'rtmp';

  return { host, port, app, tls, tcUrl: `${scheme}://${hostPart}/${app}` };
}

export function buildPublishUrl(streamUrl, streamKey) {
  const parsed = parseRtmpUrl(streamUrl);
  const key = streamKey.trim();
  const base = parsed.tcUrl.replace(/\/+$/, '');
  return `${base}/${key}`;
}
