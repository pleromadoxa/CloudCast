import type { DisplayBackground, DisplayCustomTemplate, DisplaySlide } from '../types/displayFeed';
import { createEmptySlide } from '../types/displayFeed';
import { DISPLAY_SLIDE_TEMPLATES as CORE_TEMPLATES } from './displaySlideTemplates';
import { EXTENDED_DISPLAY_TEMPLATES } from './displaySlideTemplatesCatalog';
import type { DisplaySlideTemplate } from './displaySlideTemplatesCatalog';

export type { DisplaySlideTemplate };
export { TEMPLATE_CATEGORIES, type TemplateCategory } from './displaySlideTemplatesCatalog';

/** All built-in templates (core + extended catalog). */
export const ALL_DISPLAY_TEMPLATES: DisplaySlideTemplate[] = [
  ...CORE_TEMPLATES,
  ...EXTENDED_DISPLAY_TEMPLATES,
];

export function getTemplateById(templateId: string): DisplaySlideTemplate | undefined {
  return ALL_DISPLAY_TEMPLATES.find((t) => t.id === templateId);
}

export function buildSlideFromTemplate(templateId: string): DisplaySlide | null {
  const template = getTemplateById(templateId);
  if (!template) return null;
  const partial = template.build();
  return createEmptySlide({
    ...partial,
    layout: partial.layout ?? template.layout,
    bannerHeight: partial.bannerHeight ?? template.bannerHeight,
    fields: partial.fields.map((f) => ({ ...f, id: crypto.randomUUID() })),
  });
}

export function buildSlideFromCustomTemplate(custom: DisplayCustomTemplate): DisplaySlide {
  return createEmptySlide({
    title: custom.name,
    type: custom.type,
    layout: custom.layout,
    bannerHeight: custom.bannerHeight,
    background: custom.background ?? { kind: 'preset', presetId: 'worship-deep-blue', overlayOpacity: 35 },
    foregroundImageUrl: custom.foregroundImageUrl,
    foregroundPosition: custom.foregroundPosition,
    foregroundSize: custom.foregroundSize,
    fields: custom.fields.map((f) => ({ ...f, id: crypto.randomUUID() })),
  });
}

export function customTemplateFromPreviewSlide(
  slide: DisplaySlide,
  name: string,
  description?: string,
): DisplayCustomTemplate {
  return {
    id: crypto.randomUUID(),
    name,
    description,
    category: slide.layout === 'banner-bottom' || slide.layout === 'lower-third' ? 'banner' : 'custom',
    type: slide.type,
    layout: slide.layout,
    bannerHeight: slide.bannerHeight,
    background: { ...slide.background },
    foregroundImageUrl: slide.foregroundImageUrl,
    foregroundPosition: slide.foregroundPosition,
    foregroundSize: slide.foregroundSize,
    fields: slide.fields.map(({ id: _id, ...rest }) => rest),
    createdAt: new Date().toISOString(),
  };
}

export function customTemplateFromPartial(
  partial: Omit<DisplayCustomTemplate, 'id' | 'createdAt'>,
): DisplayCustomTemplate {
  return {
    ...partial,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
}

import { CHROMA_KEY_GREEN } from './chromaKeyColor';

/** Chroma key green used when key mode is active. */
export const DISPLAY_KEY_COLOR = CHROMA_KEY_GREEN;

export function resolveKeyBackground(bg: DisplayBackground | undefined, keyMode: boolean): DisplayBackground | undefined {
  if (!keyMode || !bg) return bg;
  if (bg.kind === 'image') return bg;
  return { kind: 'color', color: DISPLAY_KEY_COLOR, overlayOpacity: 0 };
}
