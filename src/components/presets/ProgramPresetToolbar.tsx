import { useState } from 'react';
import { Bookmark, ChevronDown, Loader2, Save } from 'lucide-react';
import { useProgramPresetsOptional } from '../../context/ProgramPresetContext';
import { cn } from '../../lib/utils';

export function ProgramPresetToolbar() {
  const presets = useProgramPresetsOptional();
  const [open, setOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState('');
  const [showSaveAs, setShowSaveAs] = useState(false);

  if (!presets) return null;

  const { activePreset, loading, saveActivePreset, saveAsNewPreset, clearActivePreset } = presets;

  const handleSaveAs = async () => {
    const name = saveAsName.trim();
    if (!name) return;
    await saveAsNewPreset(name);
    setSaveAsName('');
    setShowSaveAs(false);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex max-w-[180px] items-center gap-1.5 rounded border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider',
          activePreset
            ? 'border-mixer-red/30 bg-mixer-red/10 text-mixer-red'
            : 'border-white/15 text-mixer-muted hover:border-white/30',
        )}
        title="Program preset"
      >
        <Bookmark className="h-3 w-3 shrink-0" />
        <span className="truncate">{activePreset?.name ?? 'No preset'}</span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            aria-label="Close preset menu"
            onClick={() => {
              setOpen(false);
              setShowSaveAs(false);
            }}
          />
          <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-white/15 bg-mixer-panel p-2 shadow-xl">
            {activePreset ? (
              <>
                <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-mixer-muted">
                  Active program
                </p>
                <p className="truncate px-2 pb-2 text-sm font-semibold">{activePreset.name}</p>
                <button
                  type="button"
                  onClick={() => { void saveActivePreset(); }}
                  disabled={loading}
                  className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs hover:bg-white/5 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save changes to preset
                </button>
              </>
            ) : (
              <p className="px-2 py-2 text-xs text-mixer-muted">No active preset selected.</p>
            )}

            {!showSaveAs ? (
              <button
                type="button"
                onClick={() => setShowSaveAs(true)}
                className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs hover:bg-white/5"
              >
                <Save className="h-3.5 w-3.5" />
                Save as new preset…
              </button>
            ) : (
              <div className="space-y-2 px-1 py-1">
                <input
                  type="text"
                  value={saveAsName}
                  onChange={(e) => setSaveAsName(e.target.value)}
                  placeholder="Preset name"
                  className="w-full rounded border border-white/15 bg-black/40 px-2 py-1.5 text-xs outline-none focus:border-mixer-red/50"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => { void handleSaveAs(); }}
                  disabled={loading || !saveAsName.trim()}
                  className="w-full rounded bg-mixer-red py-1.5 text-[10px] font-bold uppercase tracking-wider text-white disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                clearActivePreset();
                setOpen(false);
                window.location.href = '/hub';
              }}
              className="mt-1 flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs text-mixer-muted hover:bg-white/5"
            >
              Switch preset…
            </button>
          </div>
        </>
      )}
    </div>
  );
}
