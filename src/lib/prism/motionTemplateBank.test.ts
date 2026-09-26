import { describe, expect, it } from 'vitest';
import {
  MOTION_TEMPLATES,
  getMotionTemplate,
  mergeMotionOverrides,
  normalizeAccent,
  normalizeMotionOverrides,
  overridesFromTemplate,
} from './motionGraphics';
import {
  LOWER_THIRD_ENTRANCES,
  LOWER_THIRD_SHAPES,
  LOWER_THIRD_TEMPLATES,
  LOWER_THIRD_VISUALS,
  MOTION_CAMERAS,
  MOTION_ORNAMENTS,
  MOTION_TEMPLATE_BANK,
  MOTION_TEMPLATE_BANK_ALL,
  MOTION_VISUALS,
} from './motionTemplateBank';

/**
 * The extended bank must stay wired end-to-end: every catalog entry has a
 * visual preset, every id is unique, and the engines can resolve each one.
 */
describe('motion template bank', () => {
  it('ships 20 more lower thirds and 20 more motion templates', () => {
    expect(LOWER_THIRD_TEMPLATES).toHaveLength(20);
    expect(MOTION_TEMPLATE_BANK).toHaveLength(20);
    expect(MOTION_TEMPLATE_BANK_ALL).toHaveLength(40);
  });

  it('registers the whole bank in the catalog', () => {
    expect(MOTION_TEMPLATES.length).toBeGreaterThanOrEqual(49);
    for (const tpl of MOTION_TEMPLATE_BANK_ALL) {
      expect(getMotionTemplate(tpl.id).id).toBe(tpl.id);
    }
  });

  it('keeps every id unique', () => {
    const ids = MOTION_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every lower third a shape + entrance preset', () => {
    for (const tpl of LOWER_THIRD_TEMPLATES) {
      const visual = LOWER_THIRD_VISUALS[tpl.id];
      expect(visual, tpl.id).toBeDefined();
      expect(tpl.category).toBe('lower_third');
      expect(tpl.fullFrame).toBe(false);
      expect(visual.width).toBeGreaterThan(1);
      expect(visual.height).toBeGreaterThan(0.2);
      expect(normalizeAccent(tpl.accent)).toBe(tpl.accent);
    }
  });

  it('gives every motion template an ornament + camera preset', () => {
    for (const tpl of MOTION_TEMPLATE_BANK) {
      const visual = MOTION_VISUALS[tpl.id];
      expect(visual, tpl.id).toBeDefined();
      expect(tpl.fullFrame).toBe(true);
      expect(['opener', 'bumper', 'sting', 'outro']).toContain(tpl.category);
      expect(tpl.duration).toBeGreaterThan(2);
    }
  });

  it('only references accent presets with valid hexes', () => {
    for (const tpl of MOTION_TEMPLATE_BANK_ALL) {
      expect(normalizeAccent(tpl.accent)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('keeps the visual vocabularies in sync with the shipped presets', () => {
    expect(LOWER_THIRD_SHAPES).toContain('slab');
    expect(LOWER_THIRD_ENTRANCES).toContain('slide');
    expect(MOTION_ORNAMENTS).toContain('mark');
    expect(MOTION_CAMERAS).toContain('push');
    for (const tpl of LOWER_THIRD_TEMPLATES) {
      const visual = LOWER_THIRD_VISUALS[tpl.id];
      expect(LOWER_THIRD_SHAPES).toContain(visual.shape);
      expect(LOWER_THIRD_ENTRANCES).toContain(visual.entrance);
    }
    for (const tpl of MOTION_TEMPLATE_BANK) {
      const visual = MOTION_VISUALS[tpl.id];
      expect(MOTION_ORNAMENTS).toContain(visual.ornament);
      expect(MOTION_CAMERAS).toContain(visual.camera);
    }
  });

  it('treats every editable template field as optional with safe defaults', () => {
    for (const tpl of MOTION_TEMPLATES) {
      // Built-ins ship without operator edits — resolution still yields a
      // complete, renderable override set.
      const resolved = mergeMotionOverrides(tpl, undefined);
      expect(resolved.kicker).toBe('');
      expect(resolved.footer).toBe('');
      expect(resolved.showLogo).toBeUndefined();
      expect(overridesFromTemplate(tpl)).toEqual({});
    }
  });

  it('lets operator overrides win over template defaults', () => {
    const tpl = getMotionTemplate('lt_prism_glass');
    const resolved = mergeMotionOverrides(tpl, {
      kicker: 'LIVE',
      footer: 'PRESENTED BY N24',
      plate: '#123456',
      showLogo: false,
      logoScale: 2,
      logoPosition: 'top-right',
    });
    expect(resolved.kicker).toBe('LIVE');
    expect(resolved.footer).toBe('PRESENTED BY N24');
    expect(resolved.plate).toBe('#123456');
    expect(resolved.showLogo).toBe(false);
    expect(resolved.logoScale).toBe(2);
    expect(resolved.logoPosition).toBe('top-right');

    const seeded = overridesFromTemplate({ ...tpl, kicker: 'EYEBROW', plate: '#222222', showLogo: true });
    expect(seeded).toEqual({ kicker: 'EYEBROW', plate: '#222222', showLogo: true });
    expect(mergeMotionOverrides({ ...tpl, kicker: 'EYEBROW' }, seeded).kicker).toBe('EYEBROW');
  });

  it('sanitises stored overrides and drops anything malformed', () => {
    expect(normalizeMotionOverrides(null)).toEqual({});
    expect(normalizeMotionOverrides('junk')).toEqual({});
    const clean = normalizeMotionOverrides({
      headline: '  AMA  ',
      kicker: '',
      accent: 'not-a-color',
      secondaryAccent: 'abc',
      backgroundImage: 'javascript:alert(1)',
      showLogo: 'yes',
      logoScale: 99,
      logoPosition: 'nowhere',
    });
    expect(clean).toEqual({ headline: 'AMA', secondaryAccent: '#aabbcc', logoScale: 4 });
  });
});
