import type { IpStreamKind } from '../types/ipCamera';

export function detectIpStreamKind(url: string): IpStreamKind {
  const u = url.trim().toLowerCase();
  if (!u) return 'unsupported';
  if (u.startsWith('rtsp://') || u.startsWith('rtsps://')) return 'unsupported';
  if (u.includes('/whep') || u.endsWith('/whep') || u.includes('webrtc/play')) return 'whep';
  if (u.includes('.m3u8') || u.includes('format=m3u8')) return 'hls';
  if (u.includes('mjpeg') || u.includes('.mjpg') || u.includes('/video.cgi')) return 'mjpeg';
  return 'native';
}

export function validateIpCameraUrl(url: string): { ok: boolean; message: string; kind: IpStreamKind } {
  const trimmed = url.trim();
  if (!trimmed) return { ok: false, message: 'Enter a stream URL.', kind: 'unsupported' };

  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return {
        ok: false,
        message: 'Use http(s) WHEP, HLS (.m3u8), MJPEG, or MP4/WebM URLs. RTSP requires a relay.',
        kind: 'unsupported',
      };
    }
  } catch {
    return { ok: false, message: 'Invalid URL format.', kind: 'unsupported' };
  }

  const kind = detectIpStreamKind(trimmed);
  if (kind === 'unsupported') {
    return {
      ok: false,
      message: 'RTSP is not supported in the browser. Use an HLS, WHEP, or MJPEG URL from your camera or relay.',
      kind,
    };
  }

  return { ok: true, message: `Detected ${kind.toUpperCase()} stream.`, kind };
}
