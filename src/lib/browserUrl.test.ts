import { describe, expect, it } from 'vitest';
import { resolveBrowserUrl, youtubeEmbedUrl } from './browserUrl';

describe('browserUrl', () => {
  it('resolves bare domains with https', () => {
    const result = resolveBrowserUrl('example.com/path');
    expect(result.kind).toBe('generic');
    expect(result.activeUrl).toBe('https://example.com/path');
    expect(result.embedUrl).toBe('https://example.com/path');
  });

  it('converts YouTube watch links to embeds', () => {
    const result = resolveBrowserUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(result.kind).toBe('youtube');
    expect(result.youtubeId).toBe('dQw4w9WgXcQ');
    expect(result.embedUrl).toContain('youtube.com/embed/dQw4w9WgXcQ');
    expect(result.embedUrl).toContain('enablejsapi=1');
  });

  it('handles youtu.be short links', () => {
    const result = resolveBrowserUrl('https://youtu.be/dQw4w9WgXcQ');
    expect(result.kind).toBe('youtube');
    expect(result.youtubeId).toBe('dQw4w9WgXcQ');
  });

  it('handles YouTube shorts', () => {
    const result = resolveBrowserUrl('https://www.youtube.com/shorts/abc123XYZ_-');
    expect(result.kind).toBe('youtube');
    expect(result.youtubeId).toBe('abc123XYZ_-');
  });

  it('rejects invalid URLs', () => {
    const result = resolveBrowserUrl('not a url %%');
    expect(result.kind).toBe('invalid');
    expect(result.error).toBeTruthy();
  });

  it('builds muted youtube embeds', () => {
    const url = youtubeEmbedUrl('dQw4w9WgXcQ', { muted: true });
    expect(url).toContain('mute=1');
  });
});
