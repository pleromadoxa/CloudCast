import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, RotateCcw, Save, X } from 'lucide-react';
import type { LayerSettings } from '../../../../types/mixer';
import type {
  LowerThirdCategory,
  LowerThirdCustomization,
  LowerThirdTemplateId,
  SavedLowerThirdPreset,
} from '../../../../types/overlays';
import {
  LOWER_THIRD_SEGMENTS,
  LOWER_THIRD_TEMPLATES,
  getLowerThirdTemplate,
  resolveLowerThirdCustomization,
} from '../../../../lib/lowerThirdTemplates';
import { upsertSavedLowerThirdPreset } from '../../../../lib/savedPresetsStorage';
import { LowerThirdOverlay } from '../../../overlays/LowerThirdOverlay';
import { LOWER_THIRD_X } from '../../../../lib/overlayPlacement';
import { cn } from '../../../../lib/utils';

type BuilderStep = 'segment' | 'template' | 'customize';

interface GraphicsActions {
  patchLayers: (p: Partial<LayerSettings>) => void;
}

interface LowerThirdBuilderProps {
  graphics: GraphicsActions;
  editingPreset?: SavedLowerThirdPreset | null;
  onClose: () => void;
  onSaved: (presets: SavedLowerThirdPreset[]) => void;
}

function CompactColor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const isHex = /^#[0-9a-f]{6}$/i.test(value);
  return (
    <label className="flex items-center gap-1 text-[8px] text-mixer-muted" title={value}>
      <span className="w-8 shrink-0 truncate">{label}</span>
      <input
        type="color"
        value={isHex ? value : '#000000'}
        onChange={(e) => onChange(e.target.value)}
        className="h-5 w-6 shrink-0 cursor-pointer rounded border border-mixer-border"
      />
    </label>
  );
}

function BuilderPreview({
  templateId,
  customization,
  headline,
  subline,
  compact,
}: {
  templateId: LowerThirdTemplateId;
  customization: LowerThirdCustomization;
  headline: string;
  subline: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded border border-mixer-border bg-gradient-to-br from-zinc-800 to-zinc-950',
        compact ? 'h-14' : 'h-20',
      )}
    >
      <span className="absolute left-1.5 top-1 z-10 text-[7px] font-bold uppercase text-mixer-green">Preview</span>
      <LowerThirdOverlay
        template={templateId}
        customization={customization}
        headline={headline}
        subline={subline}
        preview
      />
    </div>
  );
}

export function LowerThirdBuilder({ graphics, editingPreset, onClose, onSaved }: LowerThirdBuilderProps) {
  const startCategory = editingPreset
    ? getLowerThirdTemplate(editingPreset.templateId).category
    : null;

  const [step, setStep] = useState<BuilderStep>(editingPreset ? 'customize' : 'segment');
  const [category, setCategory] = useState<LowerThirdCategory | null>(startCategory);
  const [templateId, setTemplateId] = useState<LowerThirdTemplateId>(
    editingPreset?.templateId ?? 'broadcast-red',
  );
  const [customization, setCustomization] = useState<LowerThirdCustomization>(
    editingPreset?.customization ?? resolveLowerThirdCustomization('broadcast-red'),
  );
  const [name, setName] = useState(editingPreset?.name ?? '');
  const [headline, setHeadline] = useState(editingPreset?.headline ?? 'Your Headline');
  const [subline, setSubline] = useState(editingPreset?.subline ?? 'Subtitle line');

  const syncPreview = useCallback(
    (draft: {
      templateId: LowerThirdTemplateId;
      customization: LowerThirdCustomization;
      headline: string;
      subline: string;
    }) => {
      graphics.patchLayers({
        lowerThirdTemplate: draft.templateId,
        lowerThirdCustomization: draft.customization,
        lowerThirdText: draft.headline,
        lowerThirdSubtext: draft.subline,
        showLowerThird: true,
      });
    },
    [graphics],
  );

  useEffect(() => {
    if (step !== 'segment') {
      syncPreview({ templateId, customization, headline, subline });
    }
  }, [step, templateId, customization, headline, subline, syncPreview]);

  const segmentTemplates = category
    ? LOWER_THIRD_TEMPLATES.filter((t) => t.category === category)
    : [];

  const pickSegment = (seg: LowerThirdCategory) => {
    setCategory(seg);
    setStep('template');
  };

  const selectTemplate = (id: LowerThirdTemplateId) => {
    const t = getLowerThirdTemplate(id);
    const custom = resolveLowerThirdCustomization(id);
    setTemplateId(id);
    setCustomization(custom);
    if (!name.trim()) setName(t.label);
    syncPreview({ templateId: id, customization: custom, headline, subline });
  };

  const pickTemplate = (id: LowerThirdTemplateId) => {
    selectTemplate(id);
    setStep('customize');
  };

  const patchCustomization = (partial: Partial<LowerThirdCustomization>) => {
    setCustomization((prev) => ({ ...prev, ...partial }));
  };

  const handleSave = () => {
    const preset: SavedLowerThirdPreset = {
      id: editingPreset?.id ?? crypto.randomUUID(),
      name: name.trim() || getLowerThirdTemplate(templateId).label,
      templateId,
      customization,
      headline,
      subline,
      updatedAt: Date.now(),
    };
    const presets = upsertSavedLowerThirdPreset(preset);
    graphics.patchLayers({
      lowerThirdTemplate: preset.templateId,
      lowerThirdCustomization: preset.customization,
      lowerThirdText: preset.headline,
      lowerThirdSubtext: preset.subline,
      lowerThirdPresetId: preset.id,
      showLowerThird: true,
    });
    onSaved(presets);
    onClose();
  };

  const stepLabel =
    step === 'segment' ? '1/3' : step === 'template' ? '2/3' : '3/3';

  return (
    <div className="flex flex-col gap-1.5 rounded border border-mixer-red/40 bg-black/50 p-1.5">
      <div className="flex items-center gap-1">
        {step !== 'segment' && !editingPreset && (
          <button
            type="button"
            onClick={() => setStep(step === 'customize' ? 'template' : 'segment')}
            className="mixer-btn shrink-0 px-1 py-0.5"
          >
            <ArrowLeft className="h-3 w-3" />
          </button>
        )}
        <span className="shrink-0 text-[8px] font-bold uppercase text-mixer-red">Builder {stepLabel}</span>
        {step !== 'segment' && (
          <span className="min-w-0 flex-1 truncate text-[8px] text-mixer-muted">
            {getLowerThirdTemplate(templateId).label}
          </span>
        )}
        <button type="button" onClick={onClose} className="shrink-0 text-mixer-muted hover:text-white">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {step !== 'segment' && (
        <BuilderPreview
          templateId={templateId}
          customization={customization}
          headline={headline}
          subline={subline}
          compact
        />
      )}

      {step === 'segment' && (
        <>
          <p className="text-[8px] text-mixer-muted">Pick a segment:</p>
          <div className="flex flex-wrap gap-0.5">
            {LOWER_THIRD_SEGMENTS.map((seg) => (
              <button
                key={seg.id}
                type="button"
                onClick={() => pickSegment(seg.id)}
                className="mixer-btn min-w-0 flex-1 px-2 py-1.5 text-[9px] font-bold"
                title={seg.description}
              >
                {seg.label}
              </button>
            ))}
          </div>
        </>
      )}

      {step === 'template' && category && (
        <>
          <div className="flex items-center gap-1">
            <span className="shrink-0 text-[8px] text-mixer-muted">
              {LOWER_THIRD_SEGMENTS.find((s) => s.id === category)?.label}:
            </span>
            <button
              type="button"
              disabled={!templateId}
              onClick={() => setStep('customize')}
              className="mixer-btn ml-auto flex items-center gap-0.5 px-2 py-0.5 text-[8px] font-bold disabled:opacity-40"
            >
              Customize <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="grid max-h-32 grid-cols-4 gap-0.5 overflow-y-auto">
            {segmentTemplates.map((t) => {
              const selected = templateId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => selectTemplate(t.id)}
                  onDoubleClick={() => pickTemplate(t.id)}
                  className={cn(
                    'overflow-hidden rounded border text-left',
                    selected ? 'border-mixer-red ring-1 ring-mixer-red' : 'border-mixer-border hover:border-mixer-red/60',
                  )}
                  title={`${t.label} — double-click to customize`}
                >
                  <div className="h-8 bg-zinc-900 p-0.5">
                    <LowerThirdOverlay template={t.id} headline="Title" subline="Sub" preview className="scale-[0.38] origin-bottom-left" />
                  </div>
                  <p className="truncate px-0.5 py-0.5 text-[7px] font-bold">{t.label}</p>
                </button>
              );
            })}
          </div>
          <p className="text-[7px] text-mixer-muted">Click to preview on PST · double-click or Customize to edit</p>
        </>
      )}

      {step === 'customize' && (
        <>
          <div className="flex gap-1">
            <input
              className="min-w-0 flex-1 rounded border border-mixer-border bg-mixer-surface px-1.5 py-0.5 text-[9px] font-semibold"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="min-w-0 flex-[2] rounded border border-mixer-border bg-mixer-surface px-1.5 py-0.5 text-[9px]"
              placeholder="Headline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
            />
            <input
              className="min-w-0 flex-[2] rounded border border-mixer-border bg-mixer-surface px-1.5 py-0.5 text-[9px]"
              placeholder="Subline"
              value={subline}
              onChange={(e) => setSubline(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded border border-mixer-border bg-mixer-surface/40 px-1.5 py-1">
            <CompactColor label="Accent" value={customization.accentColor} onChange={(v) => patchCustomization({ accentColor: v })} />
            <CompactColor label="BG" value={customization.backgroundColor} onChange={(v) => patchCustomization({ backgroundColor: v })} />
            <CompactColor label="Title" value={customization.textColor} onChange={(v) => patchCustomization({ textColor: v })} />
            <CompactColor label="Sub" value={customization.subtextColor} onChange={(v) => patchCustomization({ subtextColor: v })} />
            <span className="text-mixer-border">|</span>
            {(['sm', 'md', 'lg'] as const).map((s) => (
              <button key={s} type="button" onClick={() => patchCustomization({ fontSize: s })} className={cn('mixer-btn px-1.5 py-0.5 text-[7px] uppercase', customization.fontSize === s && 'mixer-btn-active')}>{s}</button>
            ))}
            <span className="text-mixer-border">|</span>
            {(['bottom-left', 'bottom-center', 'bottom-right'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => patchCustomization({ position: p, xPercent: LOWER_THIRD_X[p] })}
                className={cn('mixer-btn px-1 py-0.5 text-[7px]', customization.position === p && 'mixer-btn-active')}
              >
                {p.split('-')[1]?.[0] ?? p}
              </button>
            ))}
            <span className="text-mixer-border">|</span>
            <label className="flex items-center gap-1 text-[8px]">
              <input type="checkbox" checked={customization.uppercase} onChange={(e) => patchCustomization({ uppercase: e.target.checked })} />
              AA
            </label>
            <label className="flex items-center gap-1 text-[8px]">
              <input type="checkbox" checked={customization.showLiveBadge} onChange={(e) => patchCustomization({ showLiveBadge: e.target.checked })} />
              LIVE
            </label>
            <label className="flex min-w-[80px] flex-1 items-center gap-1 text-[7px] text-mixer-muted">
              {customization.opacity}%
              <input type="range" min={40} max={100} value={customization.opacity} onChange={(e) => patchCustomization({ opacity: Number(e.target.value) })} className="min-w-0 flex-1 accent-mixer-green" />
            </label>
            <button
              type="button"
              onClick={() => patchCustomization(resolveLowerThirdCustomization(templateId))}
              className="mixer-btn shrink-0 px-1 py-0.5"
              title="Reset style"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </div>

          <button type="button" onClick={handleSave} className="mixer-btn flex w-full items-center justify-center gap-1 py-1.5 text-[9px] font-bold">
            <Save className="h-3 w-3" /> Save &amp; Close
          </button>
        </>
      )}
    </div>
  );
}
