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
  Check,
  Sparkles,
} from 'lucide-react';
import { useProgramPresets } from '../../context/ProgramPresetContext';
import { cn } from '../../lib/utils';

const PRESET_ICONS = [Church, Radio, Video, Monitor, Volume2] as const;

const PRESET_THEMES = [
  {
    gradient: 'from-rose-600/30 via-rose-950/15 to-black/20',
    icon: 'text-rose-300',
    border: 'border-rose-500/25',
    glow: 'shadow-rose-500/10',
    iconBg: 'bg-rose-500/15 border-rose-400/20',
  },
  {
    gradient: 'from-violet-600/30 via-violet-950/15 to-black/20',
    icon: 'text-violet-300',
    border: 'border-violet-500/25',
    glow: 'shadow-violet-500/10',
    iconBg: 'bg-violet-500/15 border-violet-400/20',
  },
  {
    gradient: 'from-sky-600/30 via-sky-950/15 to-black/20',
    icon: 'text-sky-300',
    border: 'border-sky-500/25',
    glow: 'shadow-sky-500/10',
    iconBg: 'bg-sky-500/15 border-sky-400/20',
  },
  {
    gradient: 'from-amber-600/30 via-amber-950/15 to-black/20',
    icon: 'text-amber-300',
    border: 'border-amber-500/25',
    glow: 'shadow-amber-500/10',
    iconBg: 'bg-amber-500/15 border-amber-400/20',
  },
  {
    gradient: 'from-emerald-600/30 via-emerald-950/15 to-black/20',
    icon: 'text-emerald-300',
    border: 'border-emerald-500/25',
    glow: 'shadow-emerald-500/10',
    iconBg: 'bg-emerald-500/15 border-emerald-400/20',
  },
  {
    gradient: 'from-fuchsia-600/30 via-fuchsia-950/15 to-black/20',
    icon: 'text-fuchsia-300',
    border: 'border-fuchsia-500/25',
    glow: 'shadow-fuchsia-500/10',
    iconBg: 'bg-fuchsia-500/15 border-fuchsia-400/20',
  },
  {
    gradient: 'from-cyan-600/30 via-cyan-950/15 to-black/20',
    icon: 'text-cyan-300',
    border: 'border-cyan-500/25',
    glow: 'shadow-cyan-500/10',
    iconBg: 'bg-cyan-500/15 border-cyan-400/20',
  },
  {
    gradient: 'from-orange-600/30 via-orange-950/15 to-black/20',
    icon: 'text-orange-300',
    border: 'border-orange-500/25',
    glow: 'shadow-orange-500/10',
    iconBg: 'bg-orange-500/15 border-orange-400/20',
  },
  {
    gradient: 'from-indigo-600/30 via-indigo-950/15 to-black/20',
    icon: 'text-indigo-300',
    border: 'border-indigo-500/25',
    glow: 'shadow-indigo-500/10',
    iconBg: 'bg-indigo-500/15 border-indigo-400/20',
  },
  {
    gradient: 'from-lime-600/30 via-lime-950/15 to-black/20',
    icon: 'text-lime-300',
    border: 'border-lime-500/25',
    glow: 'shadow-lime-500/10',
    iconBg: 'bg-lime-500/15 border-lime-400/20',
  },
  {
    gradient: 'from-pink-600/30 via-pink-950/15 to-black/20',
    icon: 'text-pink-300',
    border: 'border-pink-500/25',
    glow: 'shadow-pink-500/10',
    iconBg: 'bg-pink-500/15 border-pink-400/20',
  },
  {
    gradient: 'from-teal-600/30 via-teal-950/15 to-black/20',
    icon: 'text-teal-300',
    border: 'border-teal-500/25',
    glow: 'shadow-teal-500/10',
    iconBg: 'bg-teal-500/15 border-teal-400/20',
  },
] as const;

function presetThemeIndex(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash % PRESET_THEMES.length;
}

function presetIcon(id: string) {
  return PRESET_ICONS[presetThemeIndex(id) % PRESET_ICONS.length];
}

function presetTheme(id: string) {
  return PRESET_THEMES[presetThemeIndex(id)];
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
    setCreating(false);
    setNewName('');
    setNewDescription('');
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
      <div className={cn('w-full', isGate ? 'max-w-5xl' : '')}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.25em] text-mixer-muted">
              {isGate ? 'START BROADCASTING' : 'PROGRAM PRESETS'}
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
              {isGate ? 'Select or create a program preset' : 'Your program presets'}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-mixer-muted">
              Save your Video Mixer, Audio Mixer, Regal Display, and sync settings together —
              reuse a church service, conference, or any recurring show.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { void refreshPresets(); }}
            disabled={loading}
            className="shrink-0 rounded-lg border border-white/15 p-2 text-mixer-muted transition-colors hover:border-white/30 hover:text-white disabled:opacity-50"
            title="Refresh presets"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {activePreset && !isGate && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-mixer-red/30 bg-mixer-red/10 px-3 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mixer-red opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-mixer-red" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-mixer-red">Active</span>
            <span className="text-xs font-semibold text-white/90">{activePreset.name}</span>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}

        <div className="relative mt-6 -mx-1">
          <div
            className={cn(
              'pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l to-transparent',
              isGate ? 'from-mixer-bg' : 'from-mixer-panel',
            )}
          />

          <div
            className={cn(
              'flex gap-4 overflow-x-auto px-3 py-2',
              'snap-x snap-mandatory scroll-smooth',
              '[scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent]',
            )}
          >
            {presets.length === 0 && !loading && !creating && (
              <div className="flex min-h-[200px] w-full min-w-full snap-center items-center justify-center rounded-xl border border-dashed border-white/15 bg-black/20 px-6">
                <div className="text-center">
                  <Sparkles className="mx-auto h-8 w-8 text-mixer-muted/60" />
                  <p className="mt-3 text-sm text-mixer-muted">No saved presets yet.</p>
                  <p className="mt-1 text-xs text-mixer-muted/70">Create your first program to get started.</p>
                </div>
              </div>
            )}

            {presets.map((preset) => {
              const Icon = presetIcon(preset.id);
              const theme = presetTheme(preset.id);
              const isActive = preset.id === activePresetId;
              const confirmingDelete = deleteConfirmId === preset.id;

              return (
                <article
                  key={preset.id}
                  className={cn(
                    'group relative flex w-[240px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border transition-all duration-300',
                    isActive
                      ? 'border-mixer-red/50 bg-gradient-to-b from-mixer-red/15 to-black/40 shadow-[0_0_24px_rgba(225,29,72,0.15)]'
                      : cn(
                          theme.border,
                          'bg-black/30 hover:-translate-y-1 hover:shadow-lg',
                          theme.glow,
                        ),
                  )}
                >
                  <button
                    type="button"
                    onClick={() => { void handleSelect(preset.id); }}
                    disabled={loading || confirmingDelete}
                    className="flex flex-1 flex-col text-left disabled:opacity-50"
                  >
                    <div className={cn('relative flex h-24 items-center justify-center bg-gradient-to-br', theme.gradient)}>
                      <div
                        className={cn(
                          'flex h-12 w-12 items-center justify-center rounded-xl border backdrop-blur-sm transition-transform duration-300 group-hover:scale-110',
                          isActive ? 'border-mixer-red/30 bg-mixer-red/10' : theme.iconBg,
                        )}
                      >
                        <Icon className={cn('h-6 w-6', isActive ? 'text-mixer-red' : theme.icon)} />
                      </div>
                      {isActive && (
                        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-mixer-red/40 bg-mixer-red/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-mixer-red">
                          <Check className="h-3 w-3" />
                          Live
                        </span>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col p-4">
                      <p className="line-clamp-1 text-sm font-bold tracking-tight">{preset.name}</p>
                      {preset.description ? (
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-mixer-muted">
                          {preset.description}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs italic text-mixer-muted/50">No description</p>
                      )}
                      <p className="mt-auto pt-3 text-[10px] uppercase tracking-wider text-mixer-muted/70">
                        Updated {formatUpdatedAt(preset.updatedAt)}
                      </p>
                    </div>
                  </button>

                  {confirmingDelete ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/85 p-4 backdrop-blur-sm">
                      <p className="text-center text-xs font-semibold text-white">Delete this preset?</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { void handleDelete(preset.id); }}
                          disabled={loading}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-red-500 disabled:opacity-50"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="rounded-lg border border-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(preset.id);
                      }}
                      disabled={loading}
                      className="absolute right-2 top-2 rounded-lg bg-black/50 p-1.5 text-mixer-muted opacity-0 backdrop-blur-sm transition-all hover:bg-red-500/20 hover:text-red-400 group-hover:opacity-100 disabled:opacity-50"
                      title="Delete preset"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </article>
              );
            })}

            {!creating ? (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="group flex w-[240px] shrink-0 snap-start flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/20 bg-black/20 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-mixer-red/40 hover:bg-mixer-red/5"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-white/25 bg-white/5 transition-colors group-hover:border-mixer-red/40 group-hover:bg-mixer-red/10">
                  <Plus className="h-6 w-6 text-mixer-muted transition-colors group-hover:text-mixer-red" />
                </div>
                <span className="text-center text-xs font-bold uppercase tracking-wider text-mixer-muted transition-colors group-hover:text-white">
                  New program preset
                </span>
              </button>
            ) : (
              <div className="flex w-[280px] shrink-0 snap-start flex-col rounded-xl border border-mixer-red/30 bg-black/40 p-4 shadow-[0_0_24px_rgba(225,29,72,0.1)]">
                <p className="text-xs font-bold uppercase tracking-wider text-mixer-red">New program</p>
                <div className="mt-3 space-y-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Sunday Service"
                    className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-mixer-red/50"
                    autoFocus
                  />
                  <input
                    type="text"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Optional description"
                    className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-mixer-red/50"
                  />
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => { void handleCreate(); }}
                    disabled={loading || !newName.trim()}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-mixer-red px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-mixer-red/90 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false);
                      setNewName('');
                      setNewDescription('');
                    }}
                    className="rounded-lg border border-white/15 px-3 py-2 text-[10px] font-bold uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
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
