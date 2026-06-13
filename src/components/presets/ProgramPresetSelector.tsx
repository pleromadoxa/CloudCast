import { useState } from 'react';
import {
  Church,
  Loader2,
  Plus,
  Radio,
  Trash2,
  Video,
  Volume2,
  Monitor,
  RefreshCw,
} from 'lucide-react';
import { useProgramPresets } from '../../context/ProgramPresetContext';
import { cn } from '../../lib/utils';

const PRESET_ICONS = [Church, Radio, Video, Monitor, Volume2] as const;

function presetIcon(index: number) {
  return PRESET_ICONS[index % PRESET_ICONS.length];
}

function formatUpdatedAt(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

interface ProgramPresetSelectorProps {
  /** Full-screen gate vs embedded section on the hub */
  variant?: 'gate' | 'embedded';
  onContinue?: () => void;
}

export function ProgramPresetSelector({ variant = 'gate', onContinue }: ProgramPresetSelectorProps) {
  const {
    presets,
    activePresetId,
    activePreset,
    loading,
    error,
    selectPreset,
    createPreset,
    removePreset,
    refreshPresets,
    dismissSelectionGate,
  } = useProgramPresets();

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const isGate = variant === 'gate';

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    await createPreset(name, newDescription.trim() || undefined);
  };

  const handleSelect = async (id: string) => {
    if (id === activePresetId) {
      onContinue?.();
      dismissSelectionGate();
      return;
    }
    await selectPreset(id);
  };

  const handleDelete = async (id: string) => {
    await removePreset(id);
    setDeleteConfirmId(null);
  };

  const shellClass = isGate
    ? 'fixed inset-0 z-50 flex items-center justify-center bg-mixer-bg/95 px-4 py-8 backdrop-blur-sm'
    : 'rounded-xl border border-white/10 bg-mixer-panel p-5';

  return (
    <div className={shellClass} role={isGate ? 'dialog' : undefined} aria-modal={isGate || undefined}>
      <div className={cn('w-full', isGate ? 'max-w-2xl' : '')}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.25em] text-mixer-muted">
              {isGate ? 'START BROADCASTING' : 'PROGRAM PRESETS'}
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
              {isGate ? 'Select or create a program preset' : 'Your program presets'}
            </h2>
            <p className="mt-2 text-sm text-mixer-muted">
              Save your Video Mixer, Audio Mixer, Regal Display, and sync settings together —
              reuse a church service, conference, or any recurring show.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { void refreshPresets(); }}
            disabled={loading}
            className="shrink-0 rounded border border-white/15 p-2 text-mixer-muted hover:border-white/30 hover:text-white disabled:opacity-50"
            title="Refresh presets"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {activePreset && !isGate && (
          <div className="mt-4 rounded-lg border border-mixer-red/30 bg-mixer-red/10 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-mixer-red">Active preset</p>
            <p className="mt-1 text-sm font-semibold">{activePreset.name}</p>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}

        <div className="mt-6 space-y-2">
          {presets.length === 0 && !loading && (
            <p className="rounded-lg border border-dashed border-white/15 px-4 py-6 text-center text-sm text-mixer-muted">
              No saved presets yet. Create your first program below.
            </p>
          )}

          {presets.map((preset, index) => {
            const Icon = presetIcon(index);
            const isActive = preset.id === activePresetId;
            const confirmingDelete = deleteConfirmId === preset.id;

            return (
              <div
                key={preset.id}
                className={cn(
                  'flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors',
                  isActive
                    ? 'border-mixer-red/40 bg-mixer-red/10'
                    : 'border-white/10 bg-black/30 hover:border-white/20',
                )}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5">
                  <Icon className="h-5 w-5 text-mixer-muted" />
                </div>
                <button
                  type="button"
                  onClick={() => { void handleSelect(preset.id); }}
                  disabled={loading}
                  className="min-w-0 flex-1 text-left disabled:opacity-50"
                >
                  <p className="truncate font-semibold">{preset.name}</p>
                  {preset.description && (
                    <p className="truncate text-xs text-mixer-muted">{preset.description}</p>
                  )}
                  <p className="mt-0.5 text-[10px] uppercase tracking-wider text-mixer-muted">
                    Updated {formatUpdatedAt(preset.updatedAt)}
                  </p>
                </button>
                {confirmingDelete ? (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => { void handleDelete(preset.id); }}
                      disabled={loading}
                      className="rounded bg-red-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-red-500 disabled:opacity-50"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(null)}
                      className="rounded border border-white/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(preset.id)}
                    disabled={loading}
                    className="shrink-0 rounded p-2 text-mixer-muted hover:bg-white/5 hover:text-red-400 disabled:opacity-50"
                    title="Delete preset"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-lg border border-white/10 bg-black/30 p-4">
          {!creating ? (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 py-3 text-sm font-bold tracking-wider text-mixer-muted hover:border-mixer-red/40 hover:text-white"
            >
              <Plus className="h-4 w-4" />
              CREATE NEW PROGRAM PRESET
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-mixer-muted">New program</p>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Sunday Service, Conference Day 1"
                className="w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-mixer-red/50"
                autoFocus
              />
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional description"
                className="w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-mixer-red/50"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { void handleCreate(); }}
                  disabled={loading || !newName.trim()}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded bg-mixer-red px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-mixer-red/90 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Create &amp; load
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false);
                    setNewName('');
                    setNewDescription('');
                  }}
                  className="rounded border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-wider"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {isGate && presets.length > 0 && (
          <p className="mt-4 text-center text-[11px] text-mixer-muted">
            Presets sync to your account and include Video Mixer, Audio Mixer, Regal Display, and CloudCast sync settings.
          </p>
        )}

        {loading && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-mixer-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading preset…
          </div>
        )}
      </div>
    </div>
  );
}
