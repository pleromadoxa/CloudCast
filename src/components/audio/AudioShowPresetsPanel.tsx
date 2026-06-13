import { useCallback, useEffect, useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
import {
  deleteAudioShowPreset,
  fetchAudioShowPresets,
  saveAudioShowPreset,
  type AudioShowPreset,
} from '../../lib/audioShowPresets';
import type { PersistedAudioMixerData } from '../../lib/audioConsolePersistence';
import { cn } from '../../lib/utils';

interface AudioShowPresetsPanelProps {
  canSave: boolean;
  readOnly: boolean;
  sessionId: string | null | undefined;
  buildConfig: () => PersistedAudioMixerData;
  onLoadConfig: (config: PersistedAudioMixerData) => void;
  onSaved?: (name: string) => void;
  onLoaded?: (name: string) => void;
  className?: string;
}

export function AudioShowPresetsPanel({
  canSave,
  readOnly,
  sessionId,
  buildConfig,
  onLoadConfig,
  onSaved,
  onLoaded,
  className,
}: AudioShowPresetsPanelProps) {
  const [presets, setPresets] = useState<AudioShowPreset[]>([]);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!canSave) {
      setPresets([]);
      return;
    }
    try {
      setPresets(await fetchAudioShowPresets(sessionId));
    } catch {
      /* offline */
    }
  }, [canSave, sessionId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      setStatus('Enter a show file name.');
      return;
    }
    try {
      await saveAudioShowPreset({
        sessionId,
        name: name.trim(),
        config: buildConfig(),
      });
      onSaved?.(name.trim());
      setName('');
      setStatus('Show file saved to Regal Cloud.');
      await refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not save show file.');
    }
  }, [name, sessionId, buildConfig, onSaved, refresh]);

  const handleLoad = useCallback(
    (preset: AudioShowPreset) => {
      onLoadConfig(preset.config);
      onLoaded?.(preset.name);
      setStatus(`Loaded "${preset.name}".`);
    },
    [onLoadConfig, onLoaded],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteAudioShowPreset(id);
        await refresh();
        setStatus('Show file deleted.');
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'Delete failed.');
      }
    },
    [refresh],
  );

  if (!canSave) return null;

  return (
    <section className={cn('studiolive-enterprise-panel', className)}>
      <p className="studiolive-enterprise-panel__title">Cloud show files</p>
      <div className="flex flex-wrap gap-1">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Show file name"
          className="min-w-0 flex-1 rounded border border-white/10 bg-black px-2 py-1 text-[10px] outline-none focus:border-sky-500/40"
        />
        <button type="button" disabled={readOnly} className="studiolive-enterprise-panel__btn" onClick={() => { void handleSave(); }}>
          <Save className="h-3 w-3" /> SAVE
        </button>
      </div>
      {presets.length > 0 && (
        <ul className="mt-2 max-h-24 space-y-1 overflow-y-auto text-[10px]">
          {presets.map((preset) => (
            <li key={preset.id} className="flex items-center justify-between gap-2 text-sky-200/90">
              <button type="button" className="truncate text-left hover:text-white" onClick={() => handleLoad(preset)}>
                {preset.name}
              </button>
              <button type="button" disabled={readOnly} className="text-mixer-red" onClick={() => { void handleDelete(preset.id); }}>
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {status && <p className="studiolive-enterprise-panel__hint">{status}</p>}
    </section>
  );
}
