import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Copy, Image as ImageIcon, Layers, RotateCcw, Save, Trash2, Upload, X } from 'lucide-react';
import {
  MOTION_ACCENTS,
  MOTION_CATEGORY_LABEL,
  getMotionTemplate,
  normalizeAccent,
  type MotionCategory,
  type MotionTemplateDefinition,
  type MotionTemplateOverrides,
  type PrismMotionState,
} from '../../lib/prism/motionGraphics';
import {
  BRAND_LOGO_POSITIONS,
  BRAND_POSITION_LABEL,
  DEFAULT_BRAND_KIT,
  importLogoFile,
  loadBrandKit,
  mergeBrandKit,
  saveBrandKit,
  compactLogoDataUrl,
  readImageFileAsDataUrl,
  type BrandLogoPosition,
  type PrismBrandKit,
} from '../../lib/prism/brandKit';
import {
  addCustomTemplate,
  createCustomTemplate,
  duplicateCustomTemplate,
  loadCustomTemplates,
  removeCustomTemplate,
  saveCustomTemplates,
  setCustomTemplateDraft,
  type CustomMotionTemplate,
} from '../../lib/prism/motionTemplateCustom';
import {
  LOWER_THIRD_ENTRANCES,
  LOWER_THIRD_SHAPES,
  MOTION_CAMERAS,
  MOTION_ORNAMENTS,
  type LowerThirdVisual,
  type MotionTemplateVisual,
} from '../../lib/prism/motionTemplateBank';
import { MotionGraphicsStage } from './motion/MotionGraphicsStage';
import { panelInputClass } from './PanelChrome';
import { cn } from '../../lib/utils';

/**
 * Prism template editor — the broadcast graphics controller for the 3D
 * motion package. Operators pick a base template, rewrite every text field,
 * rebrand the plate colours, drop in their own logo, then save the result as
 * a named custom template that plays anywhere a built-in can.
 */

interface DraftState {
  /** Set once this draft is (or was) saved as a custom template. */
  customId: string | null;
  baseId: string;
  name: string;
  duration: number;
  headline: string;
  subline: string;
  kicker: string;
  footer: string;
  accent: string;
  secondaryAccent: string;
  plate: string;
  ink: string;
  trim: string;
  /** Tri-state logo switch — undefined = auto (show when a logo is set). */
  showLogo: boolean | undefined;
  logoScale: number;
  logoPosition: BrandLogoPosition;
  backgroundImage: string;
  /** Structural preset tweaks (shape/entrance/ornament/camera/chip). */
  visual: Record<string, string | number | boolean>;
  brand: PrismBrandKit;
}

export interface MotionTemplateEditorProps {
  /** Template selected in the panel when the editor opened. */
  templateId: string;
  motion: PrismMotionState;
  /** Pushes the finished draft onto the live stage / program state. */
  onApply: (patch: Partial<PrismMotionState>) => void;
  onClose: () => void;
}

function draftFromTemplate(tpl: MotionTemplateDefinition, brand: PrismBrandKit): DraftState {
  return {
    customId: null,
    baseId: tpl.baseId ?? tpl.id,
    name: tpl.name,
    duration: tpl.duration,
    headline: tpl.headline,
    subline: tpl.subline,
    kicker: tpl.kicker ?? '',
    footer: tpl.footer ?? '',
    accent: tpl.accent,
    secondaryAccent: tpl.secondaryAccent ?? DEFAULT_BRAND_KIT.secondaryAccent,
    plate: tpl.plate ?? '',
    ink: tpl.ink ?? '',
    trim: tpl.trim ?? '',
    showLogo: tpl.showLogo,
    logoScale: tpl.logoScale ?? 1,
    logoPosition: tpl.logoPosition ?? 'mark-slot',
    backgroundImage: tpl.backgroundImage ?? '',
    visual: {},
    brand,
  };
}

function draftFromCustom(t: CustomMotionTemplate, brand: PrismBrandKit): DraftState {
  return {
    customId: t.id,
    baseId: t.baseId,
    name: t.name,
    duration: t.definition.duration,
    headline: t.definition.headline,
    subline: t.definition.subline,
    kicker: t.definition.kicker ?? '',
    footer: t.definition.footer ?? '',
    accent: t.definition.accent,
    secondaryAccent: t.definition.secondaryAccent ?? DEFAULT_BRAND_KIT.secondaryAccent,
    plate: t.definition.plate ?? '',
    ink: t.definition.ink ?? '',
    trim: t.definition.trim ?? '',
    showLogo: t.definition.showLogo,
    logoScale: t.definition.logoScale ?? 1,
    logoPosition: t.definition.logoPosition ?? 'mark-slot',
    backgroundImage: t.definition.backgroundImage ?? '',
    visual: { ...(t.visual as Record<string, string | number | boolean>) },
    brand: mergeBrandKit(brand, t.brand),
  };
}

/** Compact labelled row used across the editor sections. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[9px] font-bold tracking-[0.18em] text-mixer-muted">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="border-b border-white/10 pb-1.5 text-[10px] font-bold tracking-[0.22em] text-amber-400/90">
      {children}
    </p>
  );
}

function SwatchInput({ label, value, fallback, onChange }: { label: string; value: string; fallback: string; onChange: (hex: string) => void }) {
  const shown = value || fallback;
  return (
    <div>
      <span className="text-[9px] font-bold tracking-[0.18em] text-mixer-muted">{label}</span>
      <div className="mt-1 flex items-center gap-1.5">
        <input
          type="color"
          value={normalizeAccent(shown, fallback)}
          onChange={(e) => onChange(normalizeAccent(e.target.value, fallback))}
          className="h-7 w-9 cursor-pointer rounded border border-white/20 bg-black p-0.5"
        />
        <input
          type="text"
          value={value}
          placeholder={fallback}
          onChange={(e) => onChange(e.target.value.trim())}
          className={cn(panelInputClass, 'h-7 flex-1 px-1.5 py-0 text-[10px]')}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            title={`Reset ${label.toLowerCase()}`}
            className="h-7 rounded border border-white/15 px-1.5 text-[9px] text-mixer-muted hover:border-white/40 hover:text-white"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

export function MotionTemplateEditor({ templateId, motion, onApply, onClose }: MotionTemplateEditorProps) {
  const [draft, setDraft] = useState<DraftState>(() => {
    const brand = mergeBrandKit(loadBrandKit(), motion.brand);
    const custom = loadCustomTemplates().find((t) => t.id === templateId);
    return custom ? draftFromCustom(custom, brand) : draftFromTemplate(getMotionTemplate(templateId), brand);
  });
  const [bank, setBank] = useState<CustomMotionTemplate[]>(() => loadCustomTemplates());
  const [status, setStatus] = useState('');
  const [logoBusy, setLogoBusy] = useState(false);
  const [previewToken, setPreviewToken] = useState(1);
  const nameRef = useRef<HTMLInputElement>(null);

  const baseTemplate = getMotionTemplate(draft.baseId);
  const isLowerThird = baseTemplate.category === 'lower_third';
  const patch = useCallback((next: Partial<DraftState>) => setDraft((d) => ({ ...d, ...next })), []);

  /* -------------------------------------------- live draft registration */

  const draftCustom = useMemo<CustomMotionTemplate>(
    () =>
      createCustomTemplate({
        id: draft.customId ?? `custom_draft_${draft.baseId}`,
        name: draft.name.trim() || 'Untitled cut',
        baseId: draft.baseId,
        definition: {
          duration: draft.duration,
          headline: draft.headline,
          subline: draft.subline,
          kicker: draft.kicker,
          footer: draft.footer,
          accent: draft.accent,
          secondaryAccent: draft.secondaryAccent,
          plate: draft.plate,
          ink: draft.ink,
          trim: draft.trim,
          backgroundImage: draft.backgroundImage,
          showLogo: draft.showLogo,
          logoScale: draft.logoScale,
          logoPosition: draft.logoPosition,
        },
        visual: draft.visual as Partial<LowerThirdVisual | MotionTemplateVisual>,
        brand: draft.brand,
      }),
    [draft],
  );

  // The draft registers itself in the template registry so the preview stage
  // resolves it exactly like a saved custom template.
  useEffect(() => {
    setCustomTemplateDraft(draftCustom);
  }, [draftCustom]);
  useEffect(() => () => setCustomTemplateDraft(null), []);

  // The brand kit is global — persist every edit immediately.
  useEffect(() => {
    saveBrandKit(draft.brand);
  }, [draft.brand]);

  const draftOverrides = useMemo<MotionTemplateOverrides>(
    () => ({
      kicker: draft.kicker.trim() || undefined,
      footer: draft.footer.trim() || undefined,
      accent: normalizeAccent(draft.accent, baseTemplate.accent),
      secondaryAccent: normalizeAccent(draft.secondaryAccent, DEFAULT_BRAND_KIT.secondaryAccent),
      ...(isLowerThird
        ? {
            ...(draft.plate ? { plate: normalizeAccent(draft.plate, '#101318') } : {}),
            ...(draft.ink ? { ink: normalizeAccent(draft.ink, '#f2f5fa') } : {}),
            ...(draft.trim ? { trim: normalizeAccent(draft.trim, '#f5c451') } : {}),
          }
        : {}),
      ...(draft.backgroundImage ? { backgroundImage: draft.backgroundImage } : {}),
      ...(draft.showLogo !== undefined ? { showLogo: draft.showLogo } : {}),
      logoScale: draft.logoScale,
      logoPosition: draft.logoPosition,
    }),
    [draft, baseTemplate.accent, isLowerThird],
  );

  const previewMotion = useMemo<PrismMotionState>(
    () => ({
      ...motion,
      templateId: draftCustom.definition.id,
      headline: draft.headline || draftCustom.definition.headline,
      subline: draft.subline || draftCustom.definition.subline,
      accent: normalizeAccent(draft.accent, baseTemplate.accent),
      overrides: draftOverrides,
      brand: draft.brand,
      active: true,
      onProgram: false,
      loop: false,
      playToken: previewToken,
    }),
    [motion, draftCustom, draft, draftOverrides, baseTemplate.accent, previewToken],
  );

  /* -------------------------------------------------------- file intake */

  const ingestLogo = useCallback(async (file: File) => {
    setLogoBusy(true);
    try {
      const { dataUrl, savedToWorkspace } = await importLogoFile(file);
      patch({ brand: { ...draft.brand, logoDataUrl: dataUrl } });
      setStatus(
        savedToWorkspace
          ? `Logo saved to the workspace library · ${file.name}`
          : `Logo loaded · ${file.name}`,
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Logo import failed.');
    } finally {
      setLogoBusy(false);
    }
  }, [draft.brand, patch]);

  const pickLogo = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp,image/svg+xml';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) void ingestLogo(file);
    };
    input.click();
  }, [ingestLogo]);

  const pickBackground = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      void (async () => {
        try {
          const dataUrl = await compactLogoDataUrl(await readImageFileAsDataUrl(file), 1280);
          patch({ backgroundImage: dataUrl });
          setStatus(`Background plate loaded · ${file.name}`);
        } catch (err) {
          setStatus(err instanceof Error ? err.message : 'Background import failed.');
        }
      })();
    };
    input.click();
  }, [patch]);

  // Drag & drop + clipboard paste for the logo (broadcast ops move fast).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'));
      if (file) {
        e.preventDefault();
        void ingestLogo(file);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [ingestLogo]);

  /* -------------------------------------------------- template bank CRUD */

  const chooseBase = (id: string) => {
    const tpl = getMotionTemplate(id);
    setDraft(draftFromTemplate(tpl, draft.brand));
    setPreviewToken((t) => t + 1);
    setStatus(`Base template · ${tpl.name}`);
  };

  const chooseCustom = (id: string) => {
    const custom = loadCustomTemplates().find((t) => t.id === id);
    if (!custom) return;
    setDraft(draftFromCustom(custom, draft.brand));
    setPreviewToken((t) => t + 1);
    setStatus(`Loaded “${custom.name}”`);
  };

  const saveDraft = (asNew: boolean) => {
    const name = draft.name.trim() || `${baseTemplate.name} cut`;
    const tpl = createCustomTemplate({
      ...(draft.customId && !asNew ? { id: draft.customId } : {}),
      name,
      baseId: draft.baseId,
      definition: {
        duration: draft.duration,
        headline: draft.headline,
        subline: draft.subline,
        kicker: draft.kicker,
        footer: draft.footer,
        accent: draft.accent,
        secondaryAccent: draft.secondaryAccent,
        plate: draft.plate,
        ink: draft.ink,
        trim: draft.trim,
        backgroundImage: draft.backgroundImage,
        showLogo: draft.showLogo,
        logoScale: draft.logoScale,
        logoPosition: draft.logoPosition,
      },
      visual: draft.visual as Partial<LowerThirdVisual | MotionTemplateVisual>,
      brand: draft.brand,
    });
    const next = addCustomTemplate(loadCustomTemplates(), tpl);
    saveCustomTemplates(next);
    setBank(next);
    patch({ customId: tpl.id, name: tpl.name });
    setStatus(`Saved “${tpl.name}” · ${next.length} custom template${next.length === 1 ? '' : 's'} in the bank`);
  };

  const duplicateDraft = () => {
    if (!draft.customId) {
      setStatus('Save the cut first, then duplicate it.');
      return;
    }
    const result = duplicateCustomTemplate(loadCustomTemplates(), draft.customId);
    if (!result) return;
    saveCustomTemplates(result.list);
    setBank(result.list);
    setDraft(draftFromCustom(result.copy, draft.brand));
    setStatus(`Duplicated as “${result.copy.name}”`);
  };

  const deleteDraft = () => {
    if (!draft.customId) return;
    const next = removeCustomTemplate(loadCustomTemplates(), draft.customId);
    saveCustomTemplates(next);
    setBank(next);
    setDraft(draftFromTemplate(getMotionTemplate(draft.baseId), draft.brand));
    setStatus('Custom template deleted.');
  };

  const applyToStage = () => {
    onApply({
      templateId: draftCustom.definition.id,
      headline: draft.headline,
      subline: draft.subline,
      accent: normalizeAccent(draft.accent, baseTemplate.accent),
      overrides: draftOverrides,
      brand: draft.brand,
      playToken: motion.playToken + 1,
    });
    setStatus('Loaded onto the stage — preview and program updated.');
  };

  /* --------------------------------------------------------------- view */

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = Array.from(e.dataTransfer.files ?? []).find((f) => f.type.startsWith('image/'));
        if (file) void ingestLogo(file);
      }}
    >
      <div className="flex h-[min(92vh,880px)] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-amber-500/30 bg-[#0a0c12] shadow-[0_24px_80px_rgba(0,0,0,0.7)]">
        {/* header */}
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-amber-500/10 to-transparent px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <Layers className="h-4 w-4 text-amber-400" />
            <div>
              <p className="text-[11px] font-bold tracking-[0.24em] text-white">TEMPLATE EDITOR</p>
              <p className="text-[9px] uppercase tracking-wider text-mixer-muted">
                {MOTION_CATEGORY_LABEL[baseTemplate.category as MotionCategory]} · {draft.duration}s ·{' '}
                {draft.customId ? 'CUSTOM CUT' : 'BASE TEMPLATE'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={applyToStage}
              className="rounded bg-amber-500 px-3 py-1.5 text-[10px] font-bold tracking-wider text-black transition-colors hover:bg-amber-400"
            >
              LOAD TO STAGE
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close editor"
              className="rounded border border-white/20 p-1.5 text-mixer-muted transition-colors hover:border-white/50 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* controls */}
          <aside className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-b border-white/10 p-4 lg:w-[400px] lg:border-b-0 lg:border-r">
            <div>
              <SectionTitle>TEMPLATE</SectionTitle>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Field label="BASE">
                  <select
                    value={draft.baseId}
                    onChange={(e) => chooseBase(e.target.value)}
                    className={cn(panelInputClass, 'h-8 px-1.5 py-0 text-[10px]')}
                  >
                    {Array.from(new Set([...loadCustomTemplates().map((t) => t.baseId), draft.baseId])).map((id) => {
                      const tpl = getMotionTemplate(id);
                      return (
                        <option key={id} value={id}>
                          {tpl.name}
                        </option>
                      );
                    })}
                  </select>
                </Field>
                <Field label="SAVED CUT">
                  <select
                    value={draft.customId ?? ''}
                    onChange={(e) => (e.target.value ? chooseCustom(e.target.value) : chooseBase(draft.baseId))}
                    className={cn(panelInputClass, 'h-8 px-1.5 py-0 text-[10px]')}
                  >
                    <option value="">— new from base —</option>
                    {bank.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Field label="CUT NAME">
                  <input
                    ref={nameRef}
                    type="text"
                    value={draft.name}
                    maxLength={42}
                    onChange={(e) => patch({ name: e.target.value })}
                    className={cn(panelInputClass, 'h-8 px-1.5 py-0 text-[10px]')}
                  />
                </Field>
                <Field label={`DURATION · ${draft.duration.toFixed(1)}s`}>
                  <input
                    type="range"
                    min={2}
                    max={30}
                    step={0.5}
                    value={draft.duration}
                    onChange={(e) => patch({ duration: Number(e.target.value) })}
                    className="mt-2 w-full accent-amber-500"
                  />
                </Field>
              </div>
            </div>

            <div>
              <SectionTitle>COPY</SectionTitle>
              <div className="mt-2 space-y-2">
                <Field label="HEADLINE">
                  <input type="text" value={draft.headline} maxLength={48} onChange={(e) => patch({ headline: e.target.value })} className={cn(panelInputClass, 'h-8 px-1.5 py-0 text-[10px]')} />
                </Field>
                <Field label="SUB-LINE">
                  <input type="text" value={draft.subline} maxLength={64} onChange={(e) => patch({ subline: e.target.value })} className={cn(panelInputClass, 'h-8 px-1.5 py-0 text-[10px]')} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="KICKER / EYEBROW">
                    <input type="text" value={draft.kicker} maxLength={32} placeholder="LIVE · TONIGHT" onChange={(e) => patch({ kicker: e.target.value })} className={cn(panelInputClass, 'h-8 px-1.5 py-0 text-[10px]')} />
                  </Field>
                  <Field label="FOOTER / SPONSOR">
                    <input type="text" value={draft.footer} maxLength={64} placeholder="PRESENTED BY…" onChange={(e) => patch({ footer: e.target.value })} className={cn(panelInputClass, 'h-8 px-1.5 py-0 text-[10px]')} />
                  </Field>
                </div>
              </div>
            </div>

            <div>
              <SectionTitle>BRAND · LOGO</SectionTitle>
              <div className="mt-2 flex items-start gap-3">
                <button
                  type="button"
                  onClick={pickLogo}
                  disabled={logoBusy}
                  className={cn(
                    'relative flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded border border-dashed transition-colors',
                    draft.brand.logoDataUrl ? 'border-amber-500/50 bg-black/40' : 'border-white/25 bg-black/30 hover:border-amber-500/50',
                  )}
                  title="Upload, drop or paste a PNG / SVG / JPG logo"
                >
                  {draft.brand.logoDataUrl ? (
                    <img src={draft.brand.logoDataUrl} alt="Brand logo" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <Upload className="h-4 w-4 text-mixer-muted" />
                  )}
                </button>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="text-[9px] leading-relaxed text-mixer-muted">
                    {logoBusy
                      ? 'Importing logo…'
                      : 'Click to upload — or drop / paste a PNG, SVG or JPG anywhere in this editor. Saved to the brand kit + workspace library.'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={pickLogo} className="rounded border border-white/15 px-2 py-1 text-[9px] font-bold tracking-wider text-mixer-muted hover:border-amber-500/50 hover:text-amber-300">
                      {draft.brand.logoDataUrl ? 'REPLACE LOGO' : 'UPLOAD LOGO'}
                    </button>
                    {draft.brand.logoDataUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          patch({ brand: { ...draft.brand, logoDataUrl: null } });
                          setStatus('Logo removed — the procedural prism mark returns.');
                        }}
                        className="rounded border border-white/15 px-2 py-1 text-[9px] font-bold tracking-wider text-mixer-muted hover:border-red-400/60 hover:text-red-300"
                      >
                        REMOVE
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <Field label={`LOGO SCALE · ${draft.logoScale.toFixed(2)}×`}>
                  <input type="range" min={0.25} max={4} step={0.05} value={draft.logoScale} onChange={(e) => patch({ logoScale: Number(e.target.value) })} className="mt-2 w-full accent-amber-500" />
                </Field>
                <Field label="LOGO POSITION">
                  <select
                    value={draft.logoPosition}
                    onChange={(e) => patch({ logoPosition: e.target.value as BrandLogoPosition })}
                    className={cn(panelInputClass, 'h-8 px-1.5 py-0 text-[10px]')}
                  >
                    {BRAND_LOGO_POSITIONS.map((pos) => (
                      <option key={pos} value={pos}>
                        {BRAND_POSITION_LABEL[pos]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <Field label="LOGO VISIBILITY">
                  <div className="flex gap-1">
                    {(['auto', 'on', 'off'] as const).map((mode) => {
                      const value = mode === 'auto' ? undefined : mode === 'on';
                      const active = draft.showLogo === value;
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => patch({ showLogo: value })}
                          className={cn(
                            'flex-1 rounded border px-2 py-1 text-[9px] font-bold tracking-wider transition-colors',
                            active ? 'border-amber-500/70 bg-amber-500/20 text-amber-300' : 'border-white/15 text-mixer-muted hover:border-white/40',
                          )}
                        >
                          {mode.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <Field label="WORDMARK">
                  <input type="text" value={draft.brand.wordmark ?? ''} maxLength={48} placeholder="REGAL PRISM" onChange={(e) => patch({ brand: { ...draft.brand, wordmark: e.target.value } })} className={cn(panelInputClass, 'h-8 px-1.5 py-0 text-[10px]')} />
                </Field>
              </div>

              <label className="mt-2 flex cursor-pointer items-center gap-2 text-[9px] font-bold tracking-wider text-mixer-muted">
                <input
                  type="checkbox"
                  checked={draft.brand.hideProceduralMark}
                  onChange={(e) => patch({ brand: { ...draft.brand, hideProceduralMark: e.target.checked } })}
                  className="accent-amber-500"
                />
                HIDE PROCEDURAL PRISM MARK (NO FALLBACK)
              </label>
            </div>

            <div>
              <SectionTitle>COLOURS</SectionTitle>
              <div className="mt-2">
                <span className="text-[9px] font-bold tracking-[0.18em] text-mixer-muted">ACCENT</span>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {MOTION_ACCENTS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      title={option.name}
                      onClick={() => patch({ accent: option.value })}
                      className={cn(
                        'h-6 w-6 rounded-full border transition-transform hover:scale-110',
                        draft.accent.toLowerCase() === option.value.toLowerCase() ? 'border-white ring-2 ring-amber-500/70' : 'border-white/25',
                      )}
                      style={{ background: option.value }}
                    />
                  ))}
                  <input
                    type="color"
                    value={normalizeAccent(draft.accent, baseTemplate.accent)}
                    onChange={(e) => patch({ accent: normalizeAccent(e.target.value, baseTemplate.accent) })}
                    title="Custom accent"
                    className="h-6 w-8 cursor-pointer rounded border border-white/20 bg-black p-0.5"
                  />
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <SwatchInput label="SECONDARY" value={draft.secondaryAccent} fallback={DEFAULT_BRAND_KIT.secondaryAccent} onChange={(secondaryAccent) => patch({ secondaryAccent })} />
                {isLowerThird ? (
                  <>
                    <SwatchInput label="PLATE" value={draft.plate} fallback="#101318" onChange={(plate) => patch({ plate })} />
                    <SwatchInput label="INK" value={draft.ink} fallback="#f2f5fa" onChange={(ink) => patch({ ink })} />
                    <SwatchInput label="TRIM" value={draft.trim} fallback={normalizeAccent(draft.accent, '#f5c451')} onChange={(trim) => patch({ trim })} />
                  </>
                ) : (
                  <SwatchInput label="BRAND SECONDARY" value={draft.brand.secondaryAccent} fallback={DEFAULT_BRAND_KIT.secondaryAccent} onChange={(v) => patch({ brand: { ...draft.brand, secondaryAccent: normalizeAccent(v, DEFAULT_BRAND_KIT.secondaryAccent) } })} />
                )}
              </div>
            </div>

            <div>
              <SectionTitle>{isLowerThird ? 'PLATE STYLE' : 'MOTION STYLE'}</SectionTitle>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {isLowerThird ? (
                  <>
                    <Field label="PLATE SHAPE">
                      <select
                        value={(draft.visual.shape as string) ?? ''}
                        onChange={(e) => patch({ visual: { ...draft.visual, ...(e.target.value ? { shape: e.target.value } : {}) } })}
                        className={cn(panelInputClass, 'h-8 px-1.5 py-0 text-[10px]')}
                      >
                        <option value="">— base shape —</option>
                        {LOWER_THIRD_SHAPES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="ENTRANCE">
                      <select
                        value={(draft.visual.entrance as string) ?? ''}
                        onChange={(e) => patch({ visual: { ...draft.visual, ...(e.target.value ? { entrance: e.target.value } : {}) } })}
                        className={cn(panelInputClass, 'h-8 px-1.5 py-0 text-[10px]')}
                      >
                        <option value="">— base entrance —</option>
                        {LOWER_THIRD_ENTRANCES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </>
                ) : (
                  <>
                    <Field label="ORNAMENT">
                      <select
                        value={(draft.visual.ornament as string) ?? ''}
                        onChange={(e) => patch({ visual: { ...draft.visual, ...(e.target.value ? { ornament: e.target.value } : {}) } })}
                        className={cn(panelInputClass, 'h-8 px-1.5 py-0 text-[10px]')}
                      >
                        <option value="">— base ornament —</option>
                        {MOTION_ORNAMENTS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="CAMERA">
                      <select
                        value={(draft.visual.camera as string) ?? ''}
                        onChange={(e) => patch({ visual: { ...draft.visual, ...(e.target.value ? { camera: e.target.value } : {}) } })}
                        className={cn(panelInputClass, 'h-8 px-1.5 py-0 text-[10px]')}
                      >
                        <option value="">— base move —</option>
                        {MOTION_CAMERAS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </>
                )}
                <Field label="CHIP LABEL">
                  <input
                    type="text"
                    value={(draft.visual.chip as string) ?? ''}
                    maxLength={12}
                    placeholder="LIVE"
                    onChange={(e) => patch({ visual: { ...draft.visual, ...(e.target.value ? { chip: e.target.value } : {}) } })}
                    className={cn(panelInputClass, 'h-8 px-1.5 py-0 text-[10px]')}
                  />
                </Field>
              </div>
            </div>

            <div>
              <SectionTitle>BACKGROUND PLATE</SectionTitle>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={pickBackground}
                  className={cn(
                    'flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded border border-dashed',
                    draft.backgroundImage ? 'border-amber-500/50 bg-black/40' : 'border-white/25 bg-black/30 hover:border-amber-500/50',
                  )}
                  title="Upload a custom background image"
                >
                  {draft.backgroundImage ? (
                    <img src={draft.backgroundImage} alt="Background plate" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-4 w-4 text-mixer-muted" />
                  )}
                </button>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={pickBackground} className="rounded border border-white/15 px-2 py-1 text-[9px] font-bold tracking-wider text-mixer-muted hover:border-amber-500/50 hover:text-amber-300">
                    {draft.backgroundImage ? 'REPLACE PLATE' : 'UPLOAD PLATE'}
                  </button>
                  {draft.backgroundImage && (
                    <button type="button" onClick={() => patch({ backgroundImage: '' })} className="rounded border border-white/15 px-2 py-1 text-[9px] font-bold tracking-wider text-mixer-muted hover:border-red-400/60 hover:text-red-300">
                      CLEAR
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <SectionTitle>CUSTOM BANK</SectionTitle>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <button type="button" onClick={() => saveDraft(false)} className="flex items-center justify-center gap-1.5 rounded bg-amber-500 px-2 py-2 text-[10px] font-bold tracking-wider text-black hover:bg-amber-400">
                  <Save className="h-3 w-3" /> SAVE
                </button>
                <button type="button" onClick={() => saveDraft(true)} className="flex items-center justify-center gap-1.5 rounded border border-white/20 px-2 py-2 text-[10px] font-bold tracking-wider text-mixer-muted hover:border-amber-500/50 hover:text-amber-300">
                  <Save className="h-3 w-3" /> SAVE AS NEW
                </button>
                <button type="button" onClick={duplicateDraft} className="flex items-center justify-center gap-1.5 rounded border border-white/20 px-2 py-2 text-[10px] font-bold tracking-wider text-mixer-muted hover:border-white/50 hover:text-white">
                  <Copy className="h-3 w-3" /> DUPLICATE
                </button>
                <button
                  type="button"
                  onClick={deleteDraft}
                  disabled={!draft.customId}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded border px-2 py-2 text-[10px] font-bold tracking-wider transition-colors',
                    draft.customId ? 'border-red-400/40 text-red-300 hover:border-red-400/70' : 'border-white/10 text-mixer-muted/40',
                  )}
                >
                  <Trash2 className="h-3 w-3" /> DELETE
                </button>
              </div>
              <p className="mt-2 text-[9px] leading-relaxed text-mixer-muted">
                {bank.length} of 40 custom templates saved to this browser. Custom cuts appear in the template
                library next to the built-ins and load into the preview page and program output.
              </p>
            </div>
          </aside>

          {/* live preview */}
          <section className="relative min-h-[320px] flex-1 bg-black">
            <MotionGraphicsStage motion={previewMotion} master={false} className="absolute inset-0" />
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent p-3">
              <p className="text-[9px] font-bold tracking-[0.22em] text-amber-400/90">LIVE PREVIEW · {draftCustom.name}</p>
              <button
                type="button"
                onClick={() => setPreviewToken((t) => t + 1)}
                className="pointer-events-auto flex items-center gap-1 rounded border border-white/20 bg-black/50 px-2 py-1 text-[9px] font-bold tracking-wider text-white/80 hover:border-amber-500/60"
              >
                <RotateCcw className="h-3 w-3" /> REPLAY
              </button>
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-6">
              <p className={cn('text-[9px] tracking-wider', status ? 'text-amber-300/90' : 'text-white/40')}>
                {status || 'Edit on the left — the preview renders every change live. Drop or paste a logo anywhere.'}
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
