import { beforeEach, describe, expect, it } from 'vitest';
import { getMotionTemplate, MOTION_TEMPLATES, normalizeAccent } from './motionGraphics';
import type { LowerThirdVisual } from './motionTemplateBank';
import {
  CUSTOM_TEMPLATE_STORAGE_KEY,
  MAX_CUSTOM_TEMPLATES,
  addCustomTemplate,
  createCustomTemplate,
  duplicateCustomTemplate,
  findCustomTemplate,
  getCustomMotionTemplate,
  listAllMotionTemplates,
  loadCustomTemplates,
  normalizeCustomTemplate,
  normalizeCustomVisual,
  patchCustomTemplate,
  removeCustomTemplate,
  renameCustomTemplate,
  resetCustomTemplateCache,
  saveCustomTemplates,
  setCustomTemplateDraft,
  type CustomMotionTemplate,
  type CustomTemplateStorage,
} from './motionTemplateCustom';

function stubStorage(seed?: Record<string, string>): CustomTemplateStorage & { data: Map<string, string> } {
  const data = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

const LT_BASE = 'lt_prism_glass';
const MT_BASE = 'mt_sovereign_rise';

beforeEach(() => {
  resetCustomTemplateCache();
});

describe('custom motion templates', () => {
  it('builds a custom template from a built-in base with editable defaults', () => {
    const base = MOTION_TEMPLATES.find((t) => t.id === LT_BASE)!;
    const tpl = createCustomTemplate({
      name: 'N24 Evening Lower',
      baseId: LT_BASE,
      definition: {
        headline: 'AMA KWARTENG',
        kicker: 'LIVE',
        footer: 'PRESENTED BY N24',
        plate: '#102030',
        logoScale: 1.5,
      },
    });

    expect(tpl.baseId).toBe(LT_BASE);
    expect(tpl.definition.id).toBe(tpl.id);
    expect(tpl.definition.baseId).toBe(LT_BASE);
    expect(tpl.definition.category).toBe(base.category);
    expect(tpl.definition.fullFrame).toBe(base.fullFrame);
    expect(tpl.definition.headline).toBe('AMA KWARTENG');
    expect(tpl.definition.subline).toBe(base.subline);
    expect(tpl.definition.kicker).toBe('LIVE');
    expect(tpl.definition.footer).toBe('PRESENTED BY N24');
    expect(tpl.definition.plate).toBe('#102030');
    expect(tpl.definition.logoScale).toBe(1.5);
    expect(normalizeAccent(tpl.definition.accent)).toBe(tpl.definition.accent);
    expect(tpl.updatedAt).toBeTruthy();
  });

  it('rejects unknown bases and sanitises stored records', () => {
    expect(() => createCustomTemplate({ name: 'x', baseId: 'missing_base' })).toThrow();
    expect(normalizeCustomTemplate({ id: 'a', baseId: 'missing_base' })).toBeNull();
    expect(normalizeCustomTemplate({ baseId: LT_BASE })).toBeNull();
    expect(normalizeCustomTemplate(null)).toBeNull();

    const clean = normalizeCustomTemplate({
      id: 'custom_1',
      name: '  Good Cut  ',
      baseId: LT_BASE,
      definition: { headline: 'HEAD', accent: 'zzz', duration: 999 },
      visual: { shape: 'bogus', width: 'wide', entrance: 'slide' },
    });
    expect(clean).not.toBeNull();
    expect(clean!.name).toBe('Good Cut');
    expect(clean!.definition.accent).toBe(MOTION_TEMPLATES.find((t) => t.id === LT_BASE)!.accent);
    expect(clean!.definition.duration).toBe(30); // clamped to the max
    expect(clean!.visual).toEqual({ entrance: 'slide' });
  });

  it('keeps only known visual keys per base family', () => {
    const base = MOTION_TEMPLATES.find((t) => t.id === LT_BASE)!;
    const ltVisual = normalizeCustomVisual({ shape: 'shard', entrance: 'drop', chip: 'LIVE', ornament: 'rings', flash: true }, base);
    expect(ltVisual).toEqual({ shape: 'shard', entrance: 'drop', chip: 'LIVE' });

    const mtBase = MOTION_TEMPLATES.find((t) => t.id === MT_BASE)!;
    const mtVisual = normalizeCustomVisual({ ornament: 'globe', camera: 'orbit', flash: true, shape: 'slab', width: 5 }, mtBase);
    expect(mtVisual).toEqual({ ornament: 'globe', camera: 'orbit', flash: true });
  });

  it('round-trips the bank through storage with a 40-template cap', () => {
    const storage = stubStorage();
    let list: CustomMotionTemplate[] = [];
    for (let i = 0; i < MAX_CUSTOM_TEMPLATES + 5; i++) {
      list = addCustomTemplate(list, createCustomTemplate({ name: `Cut ${i}`, baseId: LT_BASE }));
    }
    expect(list).toHaveLength(MAX_CUSTOM_TEMPLATES);
    // The cap keeps the newest entries.
    expect(list[list.length - 1].name).toBe(`Cut ${MAX_CUSTOM_TEMPLATES + 4}`);

    saveCustomTemplates(list, storage);
    expect(storage.data.get(CUSTOM_TEMPLATE_STORAGE_KEY)).toContain('Cut');

    resetCustomTemplateCache();
    const loaded = loadCustomTemplates(storage);
    expect(loaded).toHaveLength(MAX_CUSTOM_TEMPLATES);
    expect(loaded[loaded.length - 1].definition.id).toBe(list[list.length - 1].definition.id);
  });

  it('supports rename, duplicate and delete', () => {
    const tpl = createCustomTemplate({ name: 'Morning Cut', baseId: LT_BASE });
    let list = addCustomTemplate([], tpl);

    list = renameCustomTemplate(list, tpl.id, 'Breakfast Cut');
    expect(findCustomTemplate(list, tpl.id)?.name).toBe('Breakfast Cut');
    // Renames ride along into the catalog definition.
    expect(list[0].definition.name).toBe('Breakfast Cut');

    const dup = duplicateCustomTemplate(list, tpl.id);
    expect(dup).not.toBeNull();
    expect(dup!.copy.id).not.toBe(tpl.id);
    expect(dup!.copy.name).toBe('Breakfast Cut copy');
    expect(dup!.list).toHaveLength(2);

    list = removeCustomTemplate(dup!.list, dup!.copy.id);
    expect(list).toHaveLength(1);
    expect(duplicateCustomTemplate(list, 'missing')).toBeNull();
  });

  it('merges custom templates into the catalog and the resolver', () => {
    const storage = stubStorage();
    const tpl = createCustomTemplate({ name: 'Custom Opener', baseId: MT_BASE, definition: { headline: 'SPECIAL' } });
    saveCustomTemplates([tpl], storage);

    const all = listAllMotionTemplates();
    expect(all.length).toBe(MOTION_TEMPLATES.length + 1);
    expect(all[all.length - 1].id).toBe(tpl.id);
    expect(getMotionTemplate(tpl.id).headline).toBe('SPECIAL');
    expect(getCustomMotionTemplate(tpl.id)?.id).toBe(tpl.id);

    // Dropping the bank unregisters the custom entry again.
    resetCustomTemplateCache();
    expect(listAllMotionTemplates().length).toBe(MOTION_TEMPLATES.length);
    expect(getMotionTemplate(tpl.id).id).not.toBe(tpl.id);
  });

  it('exposes an in-progress editor draft like a saved template', () => {
    const draft = createCustomTemplate({ id: 'custom_draft_test', name: 'Draft', baseId: LT_BASE, definition: { kicker: 'DRAFTING' } });
    setCustomTemplateDraft(draft);

    expect(getMotionTemplate('custom_draft_test').kicker).toBe('DRAFTING');
    expect(getCustomMotionTemplate('custom_draft_test')?.name).toBe('Draft');
    expect(findCustomTemplate(loadCustomTemplates(), 'custom_draft_test')).toBeNull(); // never persisted

    setCustomTemplateDraft(null);
    expect(getCustomMotionTemplate('custom_draft_test')).toBeNull();
  });

  it('patches fields and re-stamps the update time', () => {
    const tpl = createCustomTemplate({ name: 'Cut', baseId: LT_BASE, definition: { kicker: 'ONE' } });
    const list = patchCustomTemplate([tpl], tpl.id, {
      definition: { ...tpl.definition, kicker: 'TWO', footer: 'SPONSOR' },
      visual: { entrance: 'wipe' } as Partial<LowerThirdVisual>,
    });
    expect(list[0].definition.kicker).toBe('TWO');
    expect(list[0].definition.footer).toBe('SPONSOR');
    expect(list[0].visual).toEqual({ entrance: 'wipe' });
    expect(list[0].updatedAt >= tpl.updatedAt).toBe(true);
  });
});
