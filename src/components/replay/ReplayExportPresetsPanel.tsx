import { useCallback, useEffect, useState } from 'react';
import { Plus, Save, Star, Trash2 } from 'lucide-react';
import {
  deleteReplayExportPreset,
  fetchReplayExportPresets,
  resolveDefaultPreset,
  saveReplayExportPreset,
  type ReplayExportPreset,
} from '../../lib/replayExportPresets';
import { cn } from '../../lib/utils';

interface ReplayExportPresetsPanelProps {
  playbackRate: number;
  frameAccurate: boolean;
  autoCloudSync: boolean;
  onApply: (preset: ReplayExportPreset) => void;
  canEdit: boolean;
  className?: string;
}

export function ReplayExportPresetsPanel({
  playbackRate,
  frameAccurate,
  autoCloudSync,
  onApply,
  canEdit,
  className,
}: ReplayExportPresetsPanelProps) {
  const [presets, setPresets] = useState<ReplayExportPreset[]>([]);
  const [draftName, setDraftName] = useState('');

  const refresh = useCallback(async () => {
    const rows = await fetchReplayExportPresets();
    setPresets(rows);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSaveCurrent = useCallback(async () => {
    const name = draftName.trim() || `Preset ${presets.length + 1}`;
    const saved = await saveReplayExportPreset({
      id: crypto.randomUUID(),
      name,
      playbackRate,
      frameAccurate,
      autoCloudSync,
      isDefault: presets.length === 0,
    });
    setDraftName('');
    await refresh();
    onApply(saved);
  }, [draftName, presets.length, playbackRate, frameAccurate, autoCloudSync, onApply, refresh]);

  const handleSetDefault = useCallback(
    async (preset: ReplayExportPreset) => {
      await saveReplayExportPreset({ ...preset, isDefault: true });
      await refresh();
      onApply({ ...preset, isDefault: true });
    },
    [onApply, refresh],
  );

  const handleDelete = useCallback(
    async (preset: ReplayExportPreset) => {
      await deleteReplayExportPreset(preset.id);
      await refresh();
    },
    [refresh],
  );

  const defaultPreset = resolveDefaultPreset(presets);

  return (
    <section className={cn('border-t border-white/5 px-3 py-2', className)}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-mixer-muted">Export presets</p>
        {defaultPreset && (
          <button type="button" className="replay-btn text-[9px]" onClick={() => onApply(defaultPreset)}>
            <Star className="h-3 w-3" /> Apply default
          </button>
        )}
      </div>

      <div className="mb-2 flex flex-wrap gap-1">
        {presets.map((preset) => (
          <div key={preset.id} className="flex items-center gap-1 rounded border border-white/10 bg-black/40 px-1.5 py-0.5">
            <button type="button" className="text-[10px] text-emerald-200 hover:text-white" onClick={() => onApply(preset)}>
              {preset.name}
              {preset.isDefault ? ' ★' : ''}
              <span className="ml-1 text-mixer-muted">
                {preset.playbackRate}x{preset.frameAccurate ? ' · frame' : ''}
              </span>
            </button>
            {canEdit && (
              <>
                <button type="button" title="Set default" className="text-mixer-muted hover:text-emerald-300" onClick={() => { void handleSetDefault(preset); }}>
                  <Star className="h-3 w-3" />
                </button>
                <button type="button" title="Delete preset" className="text-mixer-muted hover:text-mixer-red" onClick={() => { void handleDelete(preset); }}>
                  <Trash2 className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-1">
          <input
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="Preset name"
            className="min-w-[100px] flex-1 rounded border border-white/10 bg-black px-2 py-1 text-[10px] outline-none focus:border-emerald-500/40"
          />
          <button type="button" className="replay-btn text-[9px]" onClick={() => { void handleSaveCurrent(); }}>
            <Save className="h-3 w-3" /> Save current
          </button>
          <button
            type="button"
            className="replay-btn text-[9px]"
            onClick={() => {
              void handleSaveCurrent();
            }}
            title="Quick save with auto name"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      )}
    </section>
  );
}
