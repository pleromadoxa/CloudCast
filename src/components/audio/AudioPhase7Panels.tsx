import { useCallback, useEffect, useState } from 'react';
import { Download, Package, Plus, Save, Star, Trash2 } from 'lucide-react';
import type { AudioInputSource } from '../../types/audio';
import type { Device } from '../../types/device';
import type { AudioConsoleState } from '../../hooks/useAudioConsoleState';
import type { ConsoleSceneSnapshot, SceneId } from '../../lib/audioConsolePersistence';
import { fetchAudioAuditLog } from '../../lib/audioAuditService';
import type { AudioSceneRundownItem } from '../../lib/audioSceneRundown';
import {
  buildComplianceBundle,
  downloadComplianceBundleJson,
  summarizeComplianceBundle,
} from '../../lib/audioComplianceBundle';
import {
  deleteAudioComplianceExportPreset,
  fetchAudioComplianceExportPresets,
  resolveDefaultComplianceExportPreset,
  saveAudioComplianceExportPreset,
  type AudioComplianceExportPreset,
} from '../../lib/audioComplianceExportPresets';
import { cn } from '../../lib/utils';

export function AudioComplianceBundlePanel({
  canUse,
  sessionId,
  operatorLabel,
  devices,
  state,
  getAudioSourceForDevice,
  linkedUsb,
  storedScenes,
  rundownDraft,
  rundownName,
  preset,
  onExport,
  className,
}: {
  canUse: boolean;
  sessionId?: string | null;
  operatorLabel?: string | null;
  devices: Device[];
  state: AudioConsoleState;
  getAudioSourceForDevice: (deviceId: string) => AudioInputSource;
  linkedUsb: Record<string, string | null>;
  storedScenes: Partial<Record<SceneId, ConsoleSceneSnapshot>>;
  rundownDraft: AudioSceneRundownItem[];
  rundownName: string;
  preset: AudioComplianceExportPreset;
  onExport?: () => void;
  className?: string;
}) {
  const [status, setStatus] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    try {
      const auditRows = await fetchAudioAuditLog(100);
      const filtered = sessionId
        ? auditRows.filter((row) => !row.sessionId || row.sessionId === sessionId)
        : auditRows;
      const bundle = buildComplianceBundle(preset, {
        sessionId,
        operatorLabel,
        auditRows: filtered,
        devices,
        state,
        getAudioSourceForDevice,
        linkedUsb,
        storedScenes,
        rundownDraft,
        rundownName,
      });
      downloadComplianceBundleJson(bundle, 'cloudcast-audio-compliance-bundle.json');
      setStatus(`Exported bundle — ${summarizeComplianceBundle(bundle)}`);
      onExport?.();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Export failed.');
    }
  }, [
    preset,
    sessionId,
    operatorLabel,
    devices,
    state,
    getAudioSourceForDevice,
    linkedUsb,
    storedScenes,
    rundownDraft,
    rundownName,
    onExport,
  ]);

  if (!canUse) return null;

  return (
    <section className={cn('studiolive-enterprise-panel', className)}>
      <p className="studiolive-enterprise-panel__title flex items-center gap-1">
        <Package className="h-3 w-3" /> Compliance handoff
      </p>
      <p className="studiolive-enterprise-panel__hint">
        One-click JSON bundle using preset &quot;{preset.name}&quot; — audit, channels, scenes
        {preset.includeRundown ? ', rundown' : ''}.
      </p>
      <div className="studiolive-enterprise-panel__actions">
        <button type="button" className="studiolive-enterprise-panel__btn" onClick={() => { void handleExport(); }}>
          <Download className="h-3 w-3" /> EXPORT BUNDLE
        </button>
      </div>
      {status && <p className="studiolive-enterprise-panel__hint">{status}</p>}
    </section>
  );
}

export function AudioComplianceExportPresetsPanel({
  canUse,
  readOnly,
  onApply,
  className,
}: {
  canUse: boolean;
  readOnly: boolean;
  onApply: (preset: AudioComplianceExportPreset) => void;
  className?: string;
}) {
  const [presets, setPresets] = useState<AudioComplianceExportPreset[]>([]);
  const [draftName, setDraftName] = useState('');
  const [includeAudit, setIncludeAudit] = useState(true);
  const [includeChannels, setIncludeChannels] = useState(true);
  const [includeScenes, setIncludeScenes] = useState(true);
  const [includeRundown, setIncludeRundown] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const rows = await fetchAudioComplianceExportPresets();
    setPresets(rows);
    const active = resolveDefaultComplianceExportPreset(rows);
    onApply(active);
    setIncludeAudit(active.includeAudit);
    setIncludeChannels(active.includeChannels);
    setIncludeScenes(active.includeScenes);
    setIncludeRundown(active.includeRundown);
  }, [onApply]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSave = useCallback(async () => {
    const name = draftName.trim() || `Preset ${presets.length + 1}`;
    try {
      await saveAudioComplianceExportPreset({
        id: crypto.randomUUID(),
        name,
        includeAudit,
        includeChannels,
        includeScenes,
        includeRundown,
        isDefault: presets.length === 0,
      });
      setDraftName('');
      setStatus(`Saved "${name}".`);
      await refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Save failed.');
    }
  }, [draftName, includeAudit, includeChannels, includeScenes, includeRundown, presets.length, refresh]);

  const handleApplyPreset = useCallback(
    (preset: AudioComplianceExportPreset) => {
      onApply(preset);
      setIncludeAudit(preset.includeAudit);
      setIncludeChannels(preset.includeChannels);
      setIncludeScenes(preset.includeScenes);
      setIncludeRundown(preset.includeRundown);
      setStatus(`Active preset: ${preset.name}`);
    },
    [onApply],
  );

  const handleSetDefault = useCallback(
    async (preset: AudioComplianceExportPreset) => {
      try {
        await saveAudioComplianceExportPreset({ ...preset, isDefault: true });
        await refresh();
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'Could not set default.');
      }
    },
    [refresh],
  );

  const handleDelete = useCallback(
    async (preset: AudioComplianceExportPreset) => {
      try {
        await deleteAudioComplianceExportPreset(preset.id);
        await refresh();
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'Delete failed.');
      }
    },
    [refresh],
  );

  if (!canUse) return null;

  return (
    <section className={cn('studiolive-enterprise-panel', className)}>
      <p className="studiolive-enterprise-panel__title flex items-center gap-1">
        <Save className="h-3 w-3" /> Export presets
      </p>
      <p className="studiolive-enterprise-panel__hint">Save which sections to include in compliance bundle exports.</p>
      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-sky-200/90">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={includeAudit} onChange={(e) => setIncludeAudit(e.target.checked)} /> Audit
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={includeChannels} onChange={(e) => setIncludeChannels(e.target.checked)} /> Channels
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={includeScenes} onChange={(e) => setIncludeScenes(e.target.checked)} /> Scenes
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={includeRundown} onChange={(e) => setIncludeRundown(e.target.checked)} /> Rundown
        </label>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <input
          type="text"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          placeholder="Preset name"
          className="min-w-0 flex-1 rounded border border-white/10 bg-black px-2 py-1 text-[10px] outline-none"
        />
        <button type="button" disabled={readOnly} className="studiolive-enterprise-panel__btn" onClick={() => { void handleSave(); }}>
          <Plus className="h-3 w-3" /> SAVE
        </button>
      </div>
      {presets.length > 0 && (
        <ul className="mt-2 max-h-20 space-y-1 overflow-y-auto text-[10px]">
          {presets.map((preset) => (
            <li key={preset.id} className="flex items-center justify-between gap-2 text-sky-200/90">
              <button type="button" className="truncate text-left hover:text-white" onClick={() => handleApplyPreset(preset)}>
                {preset.isDefault && <Star className="mr-1 inline h-3 w-3 text-amber-300" />}
                {preset.name}
              </button>
              <span className="flex shrink-0 gap-1">
                {!preset.isDefault && (
                  <button type="button" disabled={readOnly} className="studiolive-enterprise-panel__btn" onClick={() => { void handleSetDefault(preset); }}>
                    DEFAULT
                  </button>
                )}
                {!preset.id.startsWith('local-') && (
                  <button type="button" disabled={readOnly} className="text-mixer-red" onClick={() => { void handleDelete(preset); }}>
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {status && <p className="studiolive-enterprise-panel__hint">{status}</p>}
    </section>
  );
}
