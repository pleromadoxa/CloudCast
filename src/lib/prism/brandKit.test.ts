import { describe, expect, it } from 'vitest';
import {
  BRAND_KIT_STORAGE_KEY,
  BRAND_LOGO_POSITIONS,
  DEFAULT_BRAND_KIT,
  LOGO_SCALE_MAX,
  LOGO_SCALE_MIN,
  brandLogoSlot,
  loadBrandKit,
  mergeBrandKit,
  normalizeBrandKit,
  normalizeLogoSource,
  saveBrandKit,
  type BrandKitStorage,
} from './brandKit';

function stubStorage(seed?: Record<string, string>): BrandKitStorage & { data: Map<string, string> } {
  const data = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

describe('brandKit', () => {
  it('falls back to the default kit for empty or malformed input', () => {
    expect(normalizeBrandKit(undefined)).toEqual(DEFAULT_BRAND_KIT);
    expect(normalizeBrandKit(null)).toEqual(DEFAULT_BRAND_KIT);
    expect(normalizeBrandKit('nope')).toEqual(DEFAULT_BRAND_KIT);
    expect(normalizeBrandKit({})).toEqual(DEFAULT_BRAND_KIT);
  });

  it('clamps numbers, validates positions and sanitises the wordmark', () => {
    const kit = normalizeBrandKit({
      logoScale: 99,
      logoOpacity: -3,
      logoPosition: 'bogus',
      wordmark: `  REGAL PRISM  `,
      hideProceduralMark: 1,
      secondaryAccent: 'abc',
    });
    expect(kit.logoScale).toBe(LOGO_SCALE_MAX);
    expect(kit.logoOpacity).toBe(0);
    expect(kit.logoPosition).toBe(DEFAULT_BRAND_KIT.logoPosition);
    expect(kit.wordmark).toBe('REGAL PRISM');
    expect(kit.hideProceduralMark).toBe(false);
    expect(kit.secondaryAccent).toBe('#aabbcc');
  });

  it('keeps every declared logo position valid', () => {
    for (const position of BRAND_LOGO_POSITIONS) {
      expect(normalizeBrandKit({ logoPosition: position }).logoPosition).toBe(position);
    }
    expect(LOGO_SCALE_MIN).toBeLessThan(LOGO_SCALE_MAX);
  });

  it('accepts only image-capable logo sources', () => {
    expect(normalizeLogoSource('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
    expect(normalizeLogoSource('https://cdn.example.com/logo.svg')).toBe('https://cdn.example.com/logo.svg');
    expect(normalizeLogoSource('blob:https://app/uuid')).toBe('blob:https://app/uuid');
    expect(normalizeLogoSource('javascript:alert(1)')).toBeNull();
    expect(normalizeLogoSource('ftp://x/y.png')).toBeNull();
    expect(normalizeLogoSource('')).toBeNull();
    expect(normalizeLogoSource(42)).toBeNull();
    expect(normalizeBrandKit({ logoDataUrl: 'javascript:alert(1)' }).logoDataUrl).toBeNull();
  });

  it('merges partial edits onto a base kit', () => {
    const kit = mergeBrandKit(DEFAULT_BRAND_KIT, { logoDataUrl: 'data:image/svg+xml,<svg/>', logoScale: 2, wordmark: 'N24' });
    expect(kit.logoDataUrl).toBe('data:image/svg+xml,<svg/>');
    expect(kit.logoScale).toBe(2);
    expect(kit.wordmark).toBe('N24');
    expect(kit.secondaryAccent).toBe(DEFAULT_BRAND_KIT.secondaryAccent);
  });

  it('round-trips through storage and survives corrupted payloads', () => {
    const storage = stubStorage();
    const saved = saveBrandKit(mergeBrandKit(DEFAULT_BRAND_KIT, { logoDataUrl: 'data:image/png;base64,BBBB', logoPosition: 'top-right' }), storage);
    expect(storage.data.get(BRAND_KIT_STORAGE_KEY)).toContain('data:image/png;base64,BBBB');

    const loaded = loadBrandKit(storage);
    expect(loaded).toEqual(saved);
    expect(loaded.logoPosition).toBe('top-right');

    const corrupt = stubStorage({ [BRAND_KIT_STORAGE_KEY]: '{not json' });
    expect(loadBrandKit(corrupt)).toEqual(DEFAULT_BRAND_KIT);
    expect(loadBrandKit(stubStorage())).toEqual(DEFAULT_BRAND_KIT);
    expect(loadBrandKit(null)).toEqual(DEFAULT_BRAND_KIT);
  });

  it('maps logo positions onto scene-space slots', () => {
    expect(brandLogoSlot('mark-slot', 4, 2)).toEqual([0, 0, 1]);
    expect(brandLogoSlot('center')).toEqual([0, 0, 1]);
    expect(brandLogoSlot('top-left', 4, 2, 0.5)).toEqual([-4, 2, 0.5]);
    expect(brandLogoSlot('top-right', 4, 2)).toEqual([4, 2, 1]);
    expect(brandLogoSlot('bottom-left', 4, 2)).toEqual([-4, -2, 1]);
    expect(brandLogoSlot('bottom-right', 4, 2)).toEqual([4, -2, 1]);
  });
});
