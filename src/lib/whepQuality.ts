import type { StreamQuality } from '../types/device';

/** Append quality hint for Regal Cloud WHEP endpoints (server may ignore unknown params). */
export function whepUrlWithQuality(baseUrl: string, quality: StreamQuality): string {
  if (!baseUrl || quality === 'auto') return baseUrl;
  try {
    const url = new URL(baseUrl);
    url.searchParams.set('quality', quality);
    return url.toString();
  } catch {
    const sep = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${sep}quality=${quality}`;
  }
}
