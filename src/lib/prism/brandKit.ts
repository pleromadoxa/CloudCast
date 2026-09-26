/**
 * Regal Prism brand kit — the operator-replaceable brand identity for the
 * 3D motion-graphics package.
 *
 * A brand kit carries the station logo (any PNG / SVG / JPG source), how the
 * logo sits in the frame, the wordmark line, and the secondary accent used for
 * trims and sub-lines. It is persisted to localStorage so every template picks
 * it up, and can be overridden per template.
 *
 * This module is deliberately dependency-free so `motionGraphics` can import
 * from it without creating a cycle.
 */

const HEX_RE = /^#[0-9a-f]{6}$/i;

/** Accepts `#abc` / `abc` / `abc123` and normalises to a `#rrggbb` hex. */
function normalizeHex(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const raw = value.trim().replace(/^#?/, '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const hex = `#${full}`;
  return HEX_RE.test(hex) ? hex.toLowerCase() : fallback;
}

/** Where the brand logo sits inside the composition. */
export type BrandLogoPosition =
  | 'mark-slot'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center';

export interface PrismBrandKit {
  /** Uploaded logo source — data URL (PNG / SVG / JPG) or remote URL. */
  logoDataUrl: string | null;
  /** Logo size multiplier (0.25 – 4). */
  logoScale: number;
  /** Logo plane opacity (0 – 1). */
  logoOpacity: number;
  /** Logo slot in the frame. */
  logoPosition: BrandLogoPosition;
  /** Optional wordmark line rendered with the mark. */
  wordmark?: string;
  /** Suppress the procedural gold-beam prism mark even as a fallback. */
  hideProceduralMark: boolean;
  /** Secondary accent for trims, rules and sub-lines (hex). */
  secondaryAccent: string;
}

export const DEFAULT_BRAND_KIT: PrismBrandKit = {
  logoDataUrl: null,
  logoScale: 1,
  logoOpacity: 1,
  logoPosition: 'mark-slot',
  wordmark: '',
  hideProceduralMark: false,
  secondaryAccent: '#cfd8e3',
};

export const BRAND_LOGO_POSITIONS: readonly BrandLogoPosition[] = [
  'mark-slot',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'center',
];

export const BRAND_POSITION_LABEL: Record<BrandLogoPosition, string> = {
  'mark-slot': 'Mark slot',
  'top-left': 'Top left',
  'top-right': 'Top right',
  'bottom-left': 'Bottom left',
  'bottom-right': 'Bottom right',
  center: 'Centre',
};

export const BRAND_KIT_STORAGE_KEY = 'cloudcast:prism-brand:v1';

export const LOGO_SCALE_MIN = 0.25;
export const LOGO_SCALE_MAX = 4;

/** Minimal storage surface so the kit can be persisted / tested anywhere. */
export type BrandKitStorage = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): BrandKitStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Private-mode browsers throw on access — the kit just stays in memory.
    return null;
  }
}

/** Accepts data URLs, http(s) and blob sources — rejects everything else. */
export function normalizeLogoSource(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;
  if (/^(data:image\/|https?:\/\/|blob:)/i.test(raw)) return raw;
  return null;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function isLogoPosition(value: unknown): value is BrandLogoPosition {
  return typeof value === 'string' && (BRAND_LOGO_POSITIONS as readonly string[]).includes(value);
}

/** Sanitises any stored / imported shape into a complete, safe brand kit. */
export function normalizeBrandKit(raw: unknown): PrismBrandKit {
  const record = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const wordmark = typeof record.wordmark === 'string' ? record.wordmark.trim().slice(0, 48) : '';
  return {
    logoDataUrl: normalizeLogoSource(record.logoDataUrl),
    logoScale: clampNumber(record.logoScale, LOGO_SCALE_MIN, LOGO_SCALE_MAX, DEFAULT_BRAND_KIT.logoScale),
    logoOpacity: clampNumber(record.logoOpacity, 0, 1, DEFAULT_BRAND_KIT.logoOpacity),
    logoPosition: isLogoPosition(record.logoPosition) ? record.logoPosition : DEFAULT_BRAND_KIT.logoPosition,
    wordmark,
    hideProceduralMark: record.hideProceduralMark === true,
    secondaryAccent: normalizeHex(
      typeof record.secondaryAccent === 'string' ? record.secondaryAccent : null,
      DEFAULT_BRAND_KIT.secondaryAccent,
    ),
  };
}

/** Applies a partial edit (editor draft, per-template brand override) safely. */
export function mergeBrandKit(base: PrismBrandKit, patch: Partial<PrismBrandKit> | null | undefined): PrismBrandKit {
  return normalizeBrandKit({ ...base, ...(patch ?? {}) });
}

export function loadBrandKit(storage: BrandKitStorage | null = defaultStorage()): PrismBrandKit {
  if (!storage) return { ...DEFAULT_BRAND_KIT };
  try {
    const raw = storage.getItem(BRAND_KIT_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_BRAND_KIT };
    return normalizeBrandKit(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_BRAND_KIT };
  }
}

export function saveBrandKit(kit: PrismBrandKit, storage: BrandKitStorage | null = defaultStorage()): PrismBrandKit {
  const normalized = normalizeBrandKit(kit);
  try {
    storage?.setItem(BRAND_KIT_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Quota / private mode — the kit still applies for the current session.
  }
  return normalized;
}

/**
 * Scene-space slot for a logo inside a frame of half-extents `hx` × `hy`
 * (plate half-size for lower thirds, camera frame half-size for full-frame
 * templates). `mark-slot` resolves to the origin of that frame.
 */
export function brandLogoSlot(
  position: BrandLogoPosition,
  hx = 3.9,
  hy = 2.2,
  z = 1,
): [number, number, number] {
  switch (position) {
    case 'top-left':
      return [-hx, hy, z];
    case 'top-right':
      return [hx, hy, z];
    case 'bottom-left':
      return [-hx, -hy, z];
    case 'bottom-right':
      return [hx, -hy, z];
    case 'center':
      return [0, 0, z];
    case 'mark-slot':
    default:
      return [0, 0, z];
  }
}

/* ------------------------------------------------------------- file intake */

/** Reads a local image file into a data URL (FileReader fallback path). */
export function readImageFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') resolve(result);
      else reject(new Error('Could not read the image file.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the image file.'));
    reader.readAsDataURL(file);
  });
}

const LOGO_MAX_EDGE = 512;

/**
 * Down-scales a raster logo so the data URL stays small enough for
 * localStorage (SVGs are kept as-is — they are compact and stay crisp).
 */
export async function compactLogoDataUrl(dataUrl: string, maxEdge = LOGO_MAX_EDGE): Promise<string> {
  if (!dataUrl.startsWith('data:image/') || dataUrl.startsWith('data:image/svg')) return dataUrl;
  if (typeof document === 'undefined') return dataUrl;
  try {
    const img = await loadImageElement(dataUrl);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h || (w <= maxEdge && h <= maxEdge)) return dataUrl;
    const ratio = Math.min(maxEdge / w, maxEdge / h);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * ratio));
    canvas.height = Math.max(1, Math.round(h * ratio));
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(dataUrl.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png', 0.92);
  } catch {
    return dataUrl;
  }
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode the image.'));
    img.src = src;
  });
}

export interface LogoImportResult {
  /** Data URL ready for the brand kit + localStorage. */
  dataUrl: string;
  /** True when the source file was also saved to the Regal Cloud workspace. */
  savedToWorkspace: boolean;
}

/**
 * Operator logo intake: prefers the shared Prism media importer (which also
 * files the artwork into the workspace library) and falls back to a plain
 * FileReader data URL. Always resolves to a compact, persistent data URL.
 */
export async function importLogoFile(file: File): Promise<LogoImportResult> {
  let dataUrl: string | null = null;
  let savedToWorkspace = false;
  try {
    const { importMediaFileToWorkspace } = await import('../mediaUpload');
    const { item, savedToWorkspace: saved } = await importMediaFileToWorkspace(file);
    if (item.kind === 'image' && typeof item.playUrl === 'string' && item.playUrl.startsWith('data:')) {
      dataUrl = item.playUrl;
      savedToWorkspace = saved;
    }
  } catch {
    // SVGs and exotic formats fall through to the FileReader path below.
  }
  if (!dataUrl) {
    dataUrl = await readImageFileAsDataUrl(file);
    savedToWorkspace = false;
  }
  return { dataUrl: await compactLogoDataUrl(dataUrl), savedToWorkspace };
}
