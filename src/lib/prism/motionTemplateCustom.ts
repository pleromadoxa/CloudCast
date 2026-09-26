import {
  MOTION_TEMPLATES,
  normalizeAccent,
  normalizeMotionOverrides,
  registerMotionTemplateExtras,
  type MotionCategory,
  type MotionTemplateDefinition,
} from './motionGraphics';
import {
  LOWER_THIRD_ENTRANCES,
  LOWER_THIRD_SHAPES,
  MOTION_CAMERAS,
  MOTION_ORNAMENTS,
  type LowerThirdVisual,
  type MotionTemplateVisual,
} from './motionTemplateBank';
import {
  DEFAULT_BRAND_KIT,
  normalizeBrandKit,
  type PrismBrandKit,
} from './brandKit';

/**
 * Operator-authored custom motion templates.
 *
 * A custom template is a named snapshot of a built-in template ("base") with
 * edited copy, colours, logo placement and — optionally — structural visual
 * tweaks (plate geometry family, entrance move, ornament, camera). The bank is
 * persisted to localStorage, capped at 40 entries, and merged into the
 * template catalog so custom cuts play anywhere a built-in can.
 */

export interface CustomMotionTemplate {
  id: string;
  name: string;
  /** Built-in template this one derives from (scene engine + base visuals). */
  baseId: string;
  /** Full catalog definition — plays exactly like a built-in template. */
  definition: MotionTemplateDefinition;
  /** Visual preset tweaks layered over the base template's preset. */
  visual: Partial<LowerThirdVisual | MotionTemplateVisual>;
  /** Per-template brand tweaks layered over the operator brand kit. */
  brand?: Partial<PrismBrandKit>;
  updatedAt: string;
}

export const CUSTOM_TEMPLATE_STORAGE_KEY = 'cloudcast:prism-motion-custom:v1';
export const MAX_CUSTOM_TEMPLATES = 40;

const CUSTOM_NAME_MAX = 42;
const DURATION_MIN = 2;
const DURATION_MAX = 30;

/** Minimal storage surface so the bank can be persisted / tested anywhere. */
export type CustomTemplateStorage = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): CustomTemplateStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function newCustomTemplateId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `custom_${uuid ? uuid.slice(0, 8) : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`}`;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function optionalText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().slice(0, max);
  return trimmed || undefined;
}

function optionalHex(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const normalized = normalizeAccent(value, '');
  return normalized || undefined;
}

function baseTemplateFor(baseId: unknown): MotionTemplateDefinition | null {
  return MOTION_TEMPLATES.find((t) => t.id === baseId) ?? null;
}

function isLowerThirdBase(base: MotionTemplateDefinition): boolean {
  return base.category === 'lower_third';
}

/* -------------------------------------------------- visual preset sanitiser */

const VISION_NUMBER_KEYS = ['width', 'height', 'x', 'y', 'subKern'] as const;
const VISION_HEX_KEYS = ['plate', 'ink', 'trim'] as const;
const VISION_BOOL_KEYS = ['flash', 'mark', 'rule', 'particleBurst', 'shafts'] as const;

/** Keeps only known, well-typed visual keys so stored data can't poison a scene. */
export function normalizeCustomVisual(
  raw: unknown,
  base: MotionTemplateDefinition,
): Partial<LowerThirdVisual | MotionTemplateVisual> {
  const record = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (isLowerThirdBase(base)) {
    if (typeof record.shape === 'string' && (LOWER_THIRD_SHAPES as readonly string[]).includes(record.shape)) {
      out.shape = record.shape;
    }
    if (typeof record.entrance === 'string' && (LOWER_THIRD_ENTRANCES as readonly string[]).includes(record.entrance)) {
      out.entrance = record.entrance;
    }
    for (const key of VISION_NUMBER_KEYS) {
      const num = Number(record[key]);
      if (Number.isFinite(num)) out[key] = num;
    }
    for (const key of VISION_HEX_KEYS) {
      const hex = optionalHex(record[key]);
      if (hex) out[key] = hex;
    }
    const chip = optionalText(record.chip, 12);
    if (chip !== undefined) out.chip = chip;
  } else {
    if (typeof record.ornament === 'string' && (MOTION_ORNAMENTS as readonly string[]).includes(record.ornament)) {
      out.ornament = record.ornament;
    }
    if (typeof record.camera === 'string' && (MOTION_CAMERAS as readonly string[]).includes(record.camera)) {
      out.camera = record.camera;
    }
    for (const key of VISION_BOOL_KEYS) {
      if (record[key] === true || record[key] === false) out[key] = record[key];
    }
    const chip = optionalText(record.chip, 8);
    if (chip !== undefined) out.chip = chip;
  }
  return out as Partial<LowerThirdVisual | MotionTemplateVisual>;
}

/* ------------------------------------------------------ definition builder */

function buildCustomDefinition(
  base: MotionTemplateDefinition,
  id: string,
  name: string,
  patch: Partial<MotionTemplateDefinition> | null | undefined,
): MotionTemplateDefinition {
  const p = (patch ?? {}) as Record<string, unknown>;
  const overrides = normalizeMotionOverrides(p);
  return {
    id,
    name,
    category: base.category as MotionCategory,
    duration: clampNumber(p.duration, DURATION_MIN, DURATION_MAX, base.duration),
    blurb: optionalText(p.blurb, 180) ?? `Custom ${base.name.toLowerCase()} — tuned in the Prism template editor.`,
    headline: overrides.headline ?? base.headline,
    subline: overrides.subline ?? base.subline,
    accent: normalizeAccent(typeof p.accent === 'string' ? p.accent : null, base.accent),
    loopable: p.loopable === true || (p.loopable === undefined && base.loopable),
    fullFrame: base.fullFrame,
    defaultBackground:
      typeof p.defaultBackground === 'string' && p.defaultBackground.trim()
        ? p.defaultBackground.trim()
        : base.defaultBackground,
    kicker: overrides.kicker,
    footer: overrides.footer,
    secondaryAccent: overrides.secondaryAccent,
    plate: overrides.plate,
    ink: overrides.ink,
    trim: overrides.trim,
    backgroundImage: overrides.backgroundImage,
    showLogo: overrides.showLogo,
    logoScale: overrides.logoScale,
    logoPosition: overrides.logoPosition,
    baseId: base.id,
  };
}

export interface CreateCustomTemplateInput {
  name: string;
  baseId: string;
  definition?: Partial<MotionTemplateDefinition>;
  visual?: Partial<LowerThirdVisual | MotionTemplateVisual>;
  brand?: Partial<PrismBrandKit>;
  id?: string;
  updatedAt?: string;
}

/** Builds a new custom template from a built-in base (throws on unknown base). */
export function createCustomTemplate(input: CreateCustomTemplateInput): CustomMotionTemplate {
  const base = baseTemplateFor(input.baseId);
  if (!base) throw new Error(`Unknown base template: ${String(input.baseId)}`);
  const id = input.id ?? newCustomTemplateId();
  return {
    id,
    name: (optionalText(input.name, CUSTOM_NAME_MAX) ?? base.name).trim(),
    baseId: base.id,
    definition: buildCustomDefinition(base, id, input.name, input.definition),
    visual: normalizeCustomVisual(input.visual, base),
    brand: input.brand ? normalizeBrandKit({ ...DEFAULT_BRAND_KIT, ...input.brand }) : undefined,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };
}

/** Sanitises a stored record — returns null when the base is gone or data is bad. */
export function normalizeCustomTemplate(raw: unknown): CustomMotionTemplate | null {
  const record = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const id = optionalText(record.id, 64);
  const base = baseTemplateFor(record.baseId);
  if (!id || !base) return null;
  const name = optionalText(record.name, CUSTOM_NAME_MAX) ?? base.name;
  const defRecord = (typeof record.definition === 'object' && record.definition !== null ? record.definition : {}) as Record<string, unknown>;
  const brandRecord = (typeof record.brand === 'object' && record.brand !== null ? record.brand : null) as Record<string, unknown> | null;
  return {
    id,
    name,
    baseId: base.id,
    definition: buildCustomDefinition(base, id, name, defRecord),
    visual: normalizeCustomVisual(record.visual, base),
    brand: brandRecord ? normalizeBrandKit({ ...DEFAULT_BRAND_KIT, ...brandRecord }) : undefined,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date().toISOString(),
  };
}

/* ------------------------------------------------------------ persistence */

let cache: CustomMotionTemplate[] | null = null;
let draft: CustomMotionTemplate | null = null;

function syncRegistry(): void {
  const extras = (cache ?? []).map((t) => t.definition);
  if (draft) extras.push(draft.definition);
  registerMotionTemplateExtras(extras);
}

export function loadCustomTemplates(storage: CustomTemplateStorage | null = defaultStorage()): CustomMotionTemplate[] {
  if (cache) return cache;
  let list: CustomMotionTemplate[] = [];
  try {
    const raw = storage?.getItem(CUSTOM_TEMPLATE_STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        list = parsed
          .map((entry) => normalizeCustomTemplate(entry))
          .filter((entry): entry is CustomMotionTemplate => entry !== null)
          .slice(0, MAX_CUSTOM_TEMPLATES);
      }
    }
  } catch {
    list = [];
  }
  cache = list;
  return cache;
}

export function saveCustomTemplates(
  list: CustomMotionTemplate[],
  storage: CustomTemplateStorage | null = defaultStorage(),
): CustomMotionTemplate[] {
  const capped = list.slice(0, MAX_CUSTOM_TEMPLATES);
  cache = capped;
  syncRegistry();
  try {
    storage?.setItem(CUSTOM_TEMPLATE_STORAGE_KEY, JSON.stringify(capped));
  } catch {
    // Quota / private mode — the bank still works for this session.
  }
  return capped;
}

/** Drops the in-memory bank so the next read re-loads from storage (tests). */
export function resetCustomTemplateCache(): void {
  cache = null;
  draft = null;
  syncRegistry();
}

/* --------------------------------------------------------------- CRUD ops */

/** Appends (replacing any same-id entry) and enforces the 40-template cap. */
export function addCustomTemplate(
  list: CustomMotionTemplate[],
  template: CustomMotionTemplate,
): CustomMotionTemplate[] {
  const without = list.filter((t) => t.id !== template.id);
  return [...without, template].slice(-MAX_CUSTOM_TEMPLATES);
}

export type CustomTemplatePatch = Partial<Pick<CustomMotionTemplate, 'name' | 'definition' | 'visual' | 'brand'>>;

export function patchCustomTemplate(
  list: CustomMotionTemplate[],
  id: string,
  patch: CustomTemplatePatch,
): CustomMotionTemplate[] {
  return list.map((t) => {
    if (t.id !== id) return t;
    const base = baseTemplateFor(t.baseId);
    const name = optionalText(patch.name, CUSTOM_NAME_MAX) ?? t.name;
    return {
      ...t,
      name,
      definition: patch.definition
        ? { ...t.definition, ...patch.definition, id: t.id, name, baseId: t.baseId }
        : { ...t.definition, name },
      visual: patch.visual ? normalizeCustomVisual({ ...t.visual, ...patch.visual }, base ?? t.definition) : t.visual,
      brand: patch.brand ? normalizeBrandKit({ ...(t.brand ?? DEFAULT_BRAND_KIT), ...patch.brand }) : t.brand,
      updatedAt: new Date().toISOString(),
    };
  });
}

export function renameCustomTemplate(list: CustomMotionTemplate[], id: string, name: string): CustomMotionTemplate[] {
  return patchCustomTemplate(list, id, { name });
}

/** Returns a detached copy appended to the bank (`name` defaults to "… copy"). */
export function duplicateCustomTemplate(
  list: CustomMotionTemplate[],
  id: string,
  name?: string,
): { list: CustomMotionTemplate[]; copy: CustomMotionTemplate } | null {
  const source = list.find((t) => t.id === id);
  if (!source) return null;
  const copy = createCustomTemplate({
    name: name ?? `${source.name} copy`,
    baseId: source.baseId,
    definition: { ...source.definition },
    visual: { ...source.visual },
    brand: source.brand ? { ...source.brand } : undefined,
    id: newCustomTemplateId(),
  });
  return { list: addCustomTemplate(list, copy), copy };
}

export function removeCustomTemplate(list: CustomMotionTemplate[], id: string): CustomMotionTemplate[] {
  return list.filter((t) => t.id !== id);
}

export function findCustomTemplate(
  list: CustomMotionTemplate[],
  id: string | null | undefined,
): CustomMotionTemplate | null {
  if (!id) return null;
  return list.find((t) => t.id === id) ?? null;
}

/* ------------------------------------------------------- catalog merging */

/** Built-ins plus the operator's saved custom templates, in catalog order. */
export function listAllMotionTemplates(): MotionTemplateDefinition[] {
  return [...MOTION_TEMPLATES, ...loadCustomTemplates().map((t) => t.definition)];
}

/* -------------------------------------------------- live draft (the editor) */

/**
 * Registers the in-progress editor draft so its live preview resolves like a
 * saved template (scene engine, visuals, duration) without touching storage.
 */
export function setCustomTemplateDraft(next: CustomMotionTemplate | null): void {
  draft = next;
  syncRegistry();
}

export function getCustomTemplateDraft(): CustomMotionTemplate | null {
  return draft;
}

/** Draft-aware lookup used by the renderer to resolve custom visuals. */
export function getCustomMotionTemplate(id: string | null | undefined): CustomMotionTemplate | null {
  if (!id) return null;
  if (draft && draft.id === id) return draft;
  return findCustomTemplate(loadCustomTemplates(), id);
}

// Register whatever is already stored so `getMotionTemplate` resolves custom
// ids from the very first render after a reload.
loadCustomTemplates();
syncRegistry();
