/**
 * 3D motion graphics template catalog for Regal Prism.
 *
 * Templates are cinematic, GPU-rendered graphics (react-three-fiber scenes)
 * that play over the virtual stage and composite into the program output —
 * logo outros, show openers, stings and 3D lower thirds, the kind of
 * end-card a film studio cuts to after the credits.
 */

import { MOTION_TEMPLATE_BANK_ALL } from './motionTemplateBank';
import { BRAND_LOGO_POSITIONS, normalizeLogoSource, type BrandLogoPosition, type PrismBrandKit } from './brandKit';

export type MotionCategory = 'outro' | 'opener' | 'bumper' | 'sting' | 'lower_third';

export interface MotionTemplateDefinition {
  id: string;
  name: string;
  category: MotionCategory;
  /** Playback length in seconds at 1x speed. */
  duration: number;
  /** One-line pitch shown on the template card. */
  blurb: string;
  /** Default on-screen headline (show / studio name). */
  headline: string;
  /** Default sub-line (tagline, credit, role). */
  subline: string;
  /** Default accent colour (hex). */
  accent: string;
  /** Safe to loop back-to-back (idles on the end frame otherwise). */
  loopable: boolean;
  /**
   * Full-frame takeover — the template paints its own backdrop.
   * Half-frame templates (lower thirds) render on a transparent canvas and
   * are composited over the live set.
   */
  fullFrame: boolean;
  /**
   * Backdrop the template opens with (a rendered video/photo background or a
   * procedural WebGPU field). Falls back to `none` (the plain void).
   */
  defaultBackground?: string;

  /* ---- operator-editable template fields (all optional, all defaulted) ---- */

  /** Eyebrow / kicker line above the headline. */
  kicker?: string;
  /** Footer / sponsor line under the lockup. */
  footer?: string;
  /** Lower-third plate colour override (hex). */
  plate?: string;
  /** Lower-third headline ink colour override (hex). */
  ink?: string;
  /** Lower-third trim colour override (hex). */
  trim?: string;
  /** Secondary accent for sub-lines, rules and chips (hex). */
  secondaryAccent?: string;
  /** Optional custom background image (data URL / URL) painted behind the scene. */
  backgroundImage?: string;
  /** Force the brand logo block on (`true`) or off (`false`). */
  showLogo?: boolean;
  /** Brand logo scale multiplier. */
  logoScale?: number;
  /** Brand logo slot in the frame. */
  logoPosition?: BrandLogoPosition;
  /**
   * For custom (operator-saved) templates: the built-in template this one is
   * derived from — used to resolve the scene engine and base visual preset.
   */
  baseId?: string;
}

/**
 * Operator edits layered over a template — copy, colours, logo placement and
 * the optional custom background. Every key falls back to the template's own
 * default when unset, so saved scenes and custom templates stay valid.
 */
export type MotionTemplateOverrides = Partial<
  Pick<
    MotionTemplateDefinition,
    | 'headline'
    | 'subline'
    | 'kicker'
    | 'footer'
    | 'accent'
    | 'secondaryAccent'
    | 'plate'
    | 'ink'
    | 'trim'
    | 'backgroundImage'
    | 'showLogo'
    | 'logoScale'
    | 'logoPosition'
  >
>;

export const MOTION_CATEGORY_LABEL: Record<MotionCategory, string> = {
  outro: 'Outro / Logo',
  opener: 'Show Opener',
  bumper: 'Bumper',
  sting: 'Transition Sting',
  lower_third: 'Lower Third',
};

/** Accent presets — tuned for broadcast-grade looks. */
export const MOTION_ACCENTS: { id: string; name: string; value: string }[] = [
  { id: 'gold', name: 'Regal Gold', value: '#f5c451' },
  { id: 'chrome', name: 'Chrome', value: '#cfd8e3' },
  { id: 'aurora', name: 'Aurora Blue', value: '#38bdf8' },
  { id: 'ember', name: 'Ember', value: '#fb7185' },
  { id: 'emerald', name: 'Emerald', value: '#34d399' },
  { id: 'violet', name: 'Violet', value: '#a78bfa' },
];

const MOTION_BASE_TEMPLATES: MotionTemplateDefinition[] = [
  {
    id: 'sovereign_outro',
    name: 'Sovereign Outro',
    category: 'outro',
    duration: 9,
    blurb:
      'Film-studio end card — gold shards fly together into the prism mark, a light sweep crosses the wordmark, tagline locks up.',
    headline: 'REGAL PRISM',
    subline: 'VIRTUAL PRODUCTION STUDIO',
    accent: '#f5c451',
    loopable: true,
    fullFrame: true,
    defaultBackground: 'deep_field',
  },
  {
    id: 'aurora_opener',
    name: 'Aurora Opener',
    category: 'opener',
    duration: 8,
    blurb: 'Camera pushes through orbiting metal rings as the show title snaps into focus.',
    headline: 'THE DAILY BRIEF',
    subline: 'LIVE · IN COLOR',
    accent: '#38bdf8',
    loopable: true,
    fullFrame: true,
    defaultBackground: 'aurora',
  },
  {
    id: 'stardust_bumper',
    name: 'Stardust Bumper',
    category: 'bumper',
    duration: 7,
    blurb: 'A galaxy of particles collapses to a single point, detonates, and the title materialises.',
    headline: 'COMING UP NEXT',
    subline: 'STAY TUNED',
    accent: '#a78bfa',
    loopable: true,
    fullFrame: true,
    defaultBackground: 'nebula',
  },
  {
    id: 'neon_tunnel',
    name: 'Neon Tunnel',
    category: 'bumper',
    duration: 8,
    blurb: 'Flythrough of a neon grid corridor — a retro-future title barrelling out of the depth.',
    headline: 'PRISM NIGHT',
    subline: 'EPISODE 12',
    accent: '#34d399',
    loopable: true,
    fullFrame: true,
  },
  {
    id: 'golden_sting',
    name: 'Golden Sting',
    category: 'sting',
    duration: 3.5,
    blurb: 'Sub-four-second impact sting for cuts, wipes and break bumps.',
    headline: 'BE RIGHT BACK',
    subline: 'SHORT BREAK',
    accent: '#f5c451',
    loopable: true,
    fullFrame: true,
  },
  {
    id: 'chrome_lower_third',
    name: 'Chrome Lower Third',
    category: 'lower_third',
    duration: 6,
    blurb:
      'Extruded metal bar slides across the lower frame with a specular sweep — name and title reveal behind it.',
    headline: 'DR. AMARA OKONKWO',
    subline: 'Climate Correspondent · Accra',
    accent: '#f5c451',
    loopable: false,
    fullFrame: false,
  },
  {
    id: 'orbit_reveal',
    name: 'Orbit Reveal',
    category: 'opener',
    duration: 10,
    blurb:
      'Real Earth-from-orbit footage rolls behind the planet rim while a sunrise flare ignites and the chrome title rises into place.',
    headline: 'ORBITAL REPORT',
    subline: 'LIVE FROM LOW EARTH ORBIT',
    accent: '#f5c451',
    loopable: true,
    fullFrame: true,
    defaultBackground: 'earth_orbit',
  },
  {
    id: 'world_report',
    name: 'World Report',
    category: 'opener',
    duration: 9,
    blurb:
      'A photoreal 3D globe textured with NASA world imagery spins up behind arcing flight paths and city pins before the title lands.',
    headline: 'WORLD REPORT',
    subline: 'THE GLOBAL DESK',
    accent: '#38bdf8',
    loopable: true,
    fullFrame: true,
    defaultBackground: 'data_grid',
  },
  {
    id: 'galaxy_drift',
    name: 'Galaxy Drift',
    category: 'outro',
    duration: 8,
    blurb:
      'A real spiral galaxy drifts under a slow camera orbit while the wordmark condenses out of the star field and sweeps to a hold.',
    headline: 'REGAL PRISM',
    subline: 'PICTURES IN MOTION',
    accent: '#a78bfa',
    loopable: true,
    fullFrame: true,
    defaultBackground: 'galaxy_andromeda',
  },
];

/**
 * The full catalog: the nine signature templates plus the extended bank
 * (20 more 3D lower thirds + 20 more motion templates). Custom templates saved
 * by the operator are registered separately (see `registerMotionTemplateExtras`)
 * so the built-in bank stays immutable and testable.
 */
export const MOTION_TEMPLATES: MotionTemplateDefinition[] = [
  ...MOTION_BASE_TEMPLATES,
  ...MOTION_TEMPLATE_BANK_ALL,
];

export const DEFAULT_MOTION_TEMPLATE_ID = MOTION_TEMPLATES[0].id;

/** Operator-saved custom templates (registered from `motionTemplateCustom`). */
let extraMotionTemplates: MotionTemplateDefinition[] = [];

/** Replaces the registered custom-template list (called on every save/load). */
export function registerMotionTemplateExtras(templates: MotionTemplateDefinition[]): void {
  extraMotionTemplates = templates;
}

/** Built-ins first, then the operator's custom templates. */
export function listMotionTemplates(): MotionTemplateDefinition[] {
  return extraMotionTemplates.length > 0 ? [...MOTION_TEMPLATES, ...extraMotionTemplates] : MOTION_TEMPLATES;
}

export function getMotionTemplate(id: string | null | undefined): MotionTemplateDefinition {
  return (
    MOTION_TEMPLATES.find((t) => t.id === id) ??
    extraMotionTemplates.find((t) => t.id === id) ??
    MOTION_TEMPLATES[0]
  );
}

export interface PrismMotionState {
  templateId: string;
  headline: string;
  subline: string;
  /** Accent hex driving materials, particles and glow. */
  accent: string;
  /** 0.5x – 2x playback rate. */
  speed: number;
  /** Restart automatically when the timeline completes. */
  loop: boolean;
  /** Overlay mounted over the stage viewport. */
  active: boolean;
  /** Composite the overlay into the program / mixer / RTMP output. */
  onProgram: boolean;
  /** Bumped to restart playback from t = 0. */
  playToken: number;
  /** Backdrop id from the motion background catalog — `none` keeps the void. */
  backgroundId: string;
  /** Backdrop brightness (0–1.4; 0 blacks it out). */
  bgIntensity: number;
  /** Backdrop motion rate (0–2×). */
  bgSpeed: number;
  /** Backdrop colour saturation (0–2; 1 is the source grade). */
  bgSaturation: number;
  /** Renderer exposure (0.5–1.6). */
  exposure: number;
  /** Bloom multiplier against the template's own grade (0–1.6). */
  bloom: number;
  /** Extra film grain laid over the render (0–0.2). */
  grain: number;
  /** Extra chromatic aberration in pixels (0–2.5). */
  chroma: number;
  /** Vignette multiplier (0–1.6). */
  vignette: number;
  /** Particle density multiplier (0–1.5). */
  particleScale: number;
  /** Cinematic 2.39:1 bars across the frame. */
  letterbox: boolean;
  /**
   * Operator brand kit — uploaded logo, wordmark and secondary accent.
   * Optional so previously saved scenes stay valid; falls back to the
   * localStorage brand kit at render time.
   */
  brand?: PrismBrandKit;
  /** Editable template overrides (kicker/footer/plate colours/logo placement…). */
  overrides?: MotionTemplateOverrides;
}

export const DEFAULT_MOTION_STATE: PrismMotionState = {
  templateId: DEFAULT_MOTION_TEMPLATE_ID,
  headline: MOTION_TEMPLATES[0].headline,
  subline: MOTION_TEMPLATES[0].subline,
  accent: MOTION_TEMPLATES[0].accent,
  speed: 1,
  loop: false,
  active: false,
  onProgram: false,
  playToken: 0,
  backgroundId: 'none',
  bgIntensity: 1,
  bgSpeed: 1,
  bgSaturation: 1,
  exposure: 1,
  bloom: 1,
  grain: 0,
  chroma: 0,
  vignette: 1,
  particleScale: 1,
  letterbox: false,
};

/** Inclusive bounds for every numeric look / backdrop control. */
export const MOTION_SPEED_MIN = 0.5;
export const MOTION_SPEED_MAX = 2;

export const MOTION_RANGE = {
  speed: [MOTION_SPEED_MIN, MOTION_SPEED_MAX],
  bgIntensity: [0, 1.4],
  bgSpeed: [0, 2],
  bgSaturation: [0, 2],
  exposure: [0.5, 1.6],
  bloom: [0, 1.6],
  grain: [0, 0.2],
  chroma: [0, 2.5],
  vignette: [0, 1.6],
  particleScale: [0, 1.5],
} as const satisfies Record<string, readonly [number, number]>;

export type MotionRangeKey = keyof typeof MOTION_RANGE;

/**
 * Clamps a control into its range, snapping to `step` (when given) so sliders,
 * URL params and imported state all land on the same values. Non-finite input
 * falls back to `fallback` (which is itself clamped).
 */
export function clampMotionRange(key: MotionRangeKey, value: unknown, fallback = 1, step = 0): number {
  const [min, max] = MOTION_RANGE[key];
  const num = typeof value === 'number' ? value : Number(value);
  const safe = Number.isFinite(num) ? num : Math.min(max, Math.max(min, fallback));
  const clamped = Math.min(max, Math.max(min, safe));
  return step > 0 ? Math.round(clamped / step) * step : clamped;
}

export function clampMotionSpeed(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MOTION_SPEED_MAX, Math.max(MOTION_SPEED_MIN, Math.round(value * 20) / 20));
}

const HEX_RE = /^#[0-9a-f]{6}$/i;

/** Accepts `#abc` / `abc` / `abc123` and normalises to a `#rrggbb` hex. */
export function normalizeAccent(value: string | null | undefined, fallback = '#f5c451'): string {
  if (!value) return fallback;
  const raw = value.trim().replace(/^#?/, '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const hex = `#${full}`;
  return HEX_RE.test(hex) ? hex.toLowerCase() : fallback;
}

/** Total seconds a template plays for at the current speed. */
export function motionDurationSeconds(template: MotionTemplateDefinition, speed: number): number {
  return template.duration / clampMotionSpeed(speed);
}

/** `m:ss.s` readout for progress displays. */
export function formatMotionTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const tenths = Math.floor((safe % 1) * 10);
  return `${mins}:${String(secs).padStart(2, '0')}.${tenths}`;
}

/** Blend an accent hex towards white (amount > 0) or black (amount < 0). */
export function shiftAccent(hex: string, amount: number): string {
  const base = normalizeAccent(hex);
  const n = parseInt(base.slice(1), 16);
  const chan = (shift: number) => {
    const v = (n >> shift) & 0xff;
    const next = amount >= 0 ? v + (255 - v) * amount : v * (1 + amount);
    return Math.max(0, Math.min(255, Math.round(next)));
  };
  const r = chan(16);
  const g = chan(8);
  const b = chan(0);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/* ------------------------------------------------------- template overrides */

const LOGO_SCALE_OVERRIDE_MIN = 0.25;
const LOGO_SCALE_OVERRIDE_MAX = 4;

function sanitizeOptionalHex(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? normalizeAccent(value, '') || undefined : undefined;
}

function sanitizeOptionalText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().slice(0, max);
  return trimmed || undefined;
}

/** Sanitises stored / imported overrides — drops anything malformed. */
export function normalizeMotionOverrides(raw: unknown): MotionTemplateOverrides {
  const record = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const out: MotionTemplateOverrides = {};
  const headline = sanitizeOptionalText(record.headline, 48);
  if (headline !== undefined) out.headline = headline;
  const subline = sanitizeOptionalText(record.subline, 64);
  if (subline !== undefined) out.subline = subline;
  const kicker = sanitizeOptionalText(record.kicker, 32);
  if (kicker !== undefined) out.kicker = kicker;
  const footer = sanitizeOptionalText(record.footer, 64);
  if (footer !== undefined) out.footer = footer;
  for (const key of ['accent', 'secondaryAccent', 'plate', 'ink', 'trim'] as const) {
    const hex = sanitizeOptionalHex(record[key]);
    if (hex) out[key] = hex;
  }
  const backgroundImage = normalizeLogoSource(record.backgroundImage);
  if (backgroundImage) out.backgroundImage = backgroundImage;
  if (record.showLogo === true || record.showLogo === false) out.showLogo = record.showLogo;
  const logoScale = Number(record.logoScale);
  if (Number.isFinite(logoScale)) {
    out.logoScale = Math.min(LOGO_SCALE_OVERRIDE_MAX, Math.max(LOGO_SCALE_OVERRIDE_MIN, logoScale));
  }
  if (typeof record.logoPosition === 'string' && (BRAND_LOGO_POSITIONS as readonly string[]).includes(record.logoPosition)) {
    out.logoPosition = record.logoPosition as BrandLogoPosition;
  }
  return out;
}

/** Seeds live overrides from a template's editable defaults (template switch). */
export function overridesFromTemplate(template: MotionTemplateDefinition): MotionTemplateOverrides {
  const out: MotionTemplateOverrides = {};
  if (template.kicker) out.kicker = template.kicker;
  if (template.footer) out.footer = template.footer;
  if (template.secondaryAccent) out.secondaryAccent = template.secondaryAccent;
  if (template.plate) out.plate = template.plate;
  if (template.ink) out.ink = template.ink;
  if (template.trim) out.trim = template.trim;
  if (template.backgroundImage) out.backgroundImage = template.backgroundImage;
  if (template.showLogo !== undefined) out.showLogo = template.showLogo;
  if (template.logoScale !== undefined) out.logoScale = template.logoScale;
  if (template.logoPosition) out.logoPosition = template.logoPosition;
  return out;
}

/**
 * Resolves the editable fields for a render: explicit operator overrides win,
 * then the template's own defaults. Text fields resolve to `''` when unset so
 * scenes can skip empty lockups without extra null checks.
 */
export function mergeMotionOverrides(
  template: MotionTemplateDefinition,
  overrides?: MotionTemplateOverrides | null,
): Required<Pick<MotionTemplateOverrides, 'kicker' | 'footer'>> &
  Pick<MotionTemplateOverrides, 'secondaryAccent' | 'plate' | 'ink' | 'trim' | 'backgroundImage' | 'showLogo' | 'logoScale' | 'logoPosition'> {
  return {
    kicker: overrides?.kicker ?? template.kicker ?? '',
    footer: overrides?.footer ?? template.footer ?? '',
    secondaryAccent: overrides?.secondaryAccent ?? template.secondaryAccent,
    plate: overrides?.plate ?? template.plate,
    ink: overrides?.ink ?? template.ink,
    trim: overrides?.trim ?? template.trim,
    backgroundImage: overrides?.backgroundImage ?? template.backgroundImage,
    showLogo: overrides?.showLogo ?? template.showLogo,
    logoScale: overrides?.logoScale ?? template.logoScale,
    logoPosition: overrides?.logoPosition ?? template.logoPosition,
  };
}
