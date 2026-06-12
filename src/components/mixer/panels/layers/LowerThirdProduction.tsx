import { useState } from 'react';
import { Pencil, Plus, Radio, Trash2 } from 'lucide-react';
import type { LayerSettings } from '../../../../types/mixer';
import type { SavedLowerThirdPreset } from '../../../../types/overlays';
import { deleteSavedLowerThirdPreset } from '../../../../lib/savedPresetsStorage';
import { LowerThirdOverlay } from '../../../overlays/LowerThirdOverlay';
import { LowerThirdBuilder } from './LowerThirdBuilder';
import { cn } from '../../../../lib/utils';

interface GraphicsActions {
  patchLayers: (p: Partial<LayerSettings>) => void;
  applySavedPreset: (preset: SavedLowerThirdPreset, goLive: boolean) => void;
  toggleLowerThirdLive: (live: boolean) => void;
}

interface LowerThirdProductionProps {
  layers: LayerSettings;
  pgmLayers: LayerSettings;
  presets: SavedLowerThirdPreset[];
  onPresetsChange: (presets: SavedLowerThirdPreset[]) => void;
  graphics: GraphicsActions;
}

export function LowerThirdProduction({
  layers,
  pgmLayers,
  presets,
  onPresetsChange,
  graphics,
}: LowerThirdProductionProps) {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<SavedLowerThirdPreset | null>(null);

  const activePresetId = layers.lowerThirdPresetId;
  const livePresetId = pgmLayers.showLowerThird ? pgmLayers.lowerThirdPresetId : null;

  const openNew = () => {
    setEditingPreset(null);
    setBuilderOpen(true);
  };

  const openEdit = (preset: SavedLowerThirdPreset) => {
    setEditingPreset(preset);
    setBuilderOpen(true);
  };

  const closeBuilder = () => {
    setBuilderOpen(false);
    setEditingPreset(null);
    if (activePresetId) {
      const preset = presets.find((p) => p.id === activePresetId);
      if (preset) graphics.applySavedPreset(preset, false);
    } else {
      graphics.patchLayers({ showLowerThird: false });
    }
  };

  const handleDelete = (id: string) => {
    const next = deleteSavedLowerThirdPreset(id);
    onPresetsChange(next);
    if (activePresetId === id) {
      graphics.patchLayers({ lowerThirdPresetId: null, showLowerThird: false });
    }
    if (livePresetId === id) {
      graphics.toggleLowerThirdLive(false);
    }
  };

  if (builderOpen) {
    return (
      <LowerThirdBuilder
        graphics={graphics}
        editingPreset={editingPreset}
        onClose={closeBuilder}
        onSaved={onPresetsChange}
      />
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        <span className="text-[8px] font-bold uppercase text-mixer-muted">Saved</span>
        <button type="button" onClick={openNew} className="mixer-btn ml-auto flex items-center gap-0.5 px-2 py-0.5 text-[8px] font-bold">
          <Plus className="h-3 w-3" /> New
        </button>
      </div>

      {presets.length === 0 ? (
        <button type="button" onClick={openNew} className="mixer-btn w-full py-2 text-[9px]">
          + Create lower third
        </button>
      ) : (
        <div className="flex max-h-28 flex-col gap-0.5 overflow-y-auto">
          {presets.map((preset) => {
            const isSelected = activePresetId === preset.id;
            const isLive = livePresetId === preset.id;
            return (
              <div
                key={preset.id}
                className={cn(
                  'flex items-center gap-1 rounded border px-1 py-0.5',
                  isLive ? 'border-mixer-red bg-mixer-red/10' : isSelected ? 'border-mixer-green/50 bg-mixer-green/5' : 'border-mixer-border bg-black/30',
                )}
              >
                <div className="relative h-7 w-14 shrink-0 overflow-hidden rounded bg-zinc-900">
                  <LowerThirdOverlay
                    template={preset.templateId}
                    customization={preset.customization}
                    headline={preset.headline}
                    subline={preset.subline}
                    preview
                    className="scale-[0.42] origin-bottom-left"
                  />
                </div>
                <button type="button" onClick={() => graphics.applySavedPreset(preset, false)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[9px] font-bold leading-tight">{preset.name}</p>
                  <p className="truncate text-[7px] text-mixer-muted">{preset.headline}</p>
                </button>
                {isLive && <span className="shrink-0 text-[7px] font-bold text-mixer-red">AIR</span>}
                <button type="button" onClick={() => graphics.applySavedPreset(preset, true)} title="Live" className={cn('mixer-btn px-1 py-0.5', isLive && 'mixer-btn-live')}>
                  <Radio className="h-3 w-3" />
                </button>
                <button type="button" onClick={() => graphics.toggleLowerThirdLive(false)} disabled={!isLive} className="mixer-btn px-1 py-0.5 text-[7px] disabled:opacity-30">OFF</button>
                <button type="button" onClick={() => openEdit(preset)} className="text-mixer-muted hover:text-white"><Pencil className="h-3 w-3" /></button>
                <button type="button" onClick={() => handleDelete(preset.id)} className="text-mixer-red"><Trash2 className="h-3 w-3" /></button>
              </div>
            );
          })}
        </div>
      )}

      {activePresetId && (
        <div className="flex gap-1 border-t border-mixer-border pt-1">
          <input
            className="min-w-0 flex-1 rounded border border-mixer-border bg-mixer-surface px-1.5 py-0.5 text-[9px]"
            placeholder="Headline"
            value={layers.lowerThirdText}
            onChange={(e) => graphics.patchLayers({ lowerThirdText: e.target.value })}
          />
          <input
            className="min-w-0 flex-1 rounded border border-mixer-border bg-mixer-surface px-1.5 py-0.5 text-[9px]"
            placeholder="Subline"
            value={layers.lowerThirdSubtext}
            onChange={(e) => graphics.patchLayers({ lowerThirdSubtext: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
