import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, Download, ListOrdered, RefreshCw, SlidersHorizontal } from 'lucide-react';
import type { AudioInputSource } from '../../types/audio';
import type { Device } from '../../types/device';
import type { AudioConsoleState } from '../../hooks/useAudioConsoleState';
import type { AudioLifecyclePrefs } from '../../lib/audioConsoleLifecycle';
import {
  buildChannelInventoryCsv,
  buildChannelInventoryJson,
  buildChannelInventoryRows,
  downloadChannelInventoryCsv,
  downloadChannelInventoryJson,
} from '../../lib/audioChannelInventory';
import type { AudioSceneRundownItem } from '../../lib/audioSceneRundown';
import {
  buildRundownRunSheetCsv,
  buildRundownRunSheetJson,
  buildRundownRunSheetText,
  downloadRundownRunSheetCsv,
  downloadRundownRunSheetJson,
  downloadRundownRunSheetText,
} from '../../lib/audioRundownRunSheet';
import { cn } from '../../lib/utils';

export function AudioConsoleLifecyclePanel({
  canUse,
  readOnly,
  prefs,
  onSavePrefs,
  onApplyPolicy,
  className,
}: {
  canUse: boolean;
  readOnly: boolean;
  prefs: AudioLifecyclePrefs | null;
  onSavePrefs: (prefs: AudioLifecyclePrefs) => Promise<void>;
  onApplyPolicy: () => Promise<{ prunedSnapshotCount: number; prunedBackupCount: number }>;
  className?: string;
}) {
  const [snapshotDays, setSnapshotDays] = useState(prefs?.pruneSnapshotDays?.toString() ?? '');
  const [backupDays, setBackupDays] = useState(prefs?.pruneBackupDays?.toString() ?? '');
  const [autoApplyOnOpen, setAutoApplyOnOpen] = useState(prefs?.autoApplyOnOpen ?? false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setAutoApplyOnOpen(prefs?.autoApplyOnOpen ?? false);
    setSnapshotDays(prefs?.pruneSnapshotDays?.toString() ?? '');
    setBackupDays(prefs?.pruneBackupDays?.toString() ?? '');
  }, [prefs?.autoApplyOnOpen, prefs?.pruneSnapshotDays, prefs?.pruneBackupDays]);

  const handleSave = useCallback(async () => {
    try {
      await onSavePrefs({
        pruneSnapshotDays: snapshotDays.trim() ? Number(snapshotDays) : null,
        pruneBackupDays: backupDays.trim() ? Number(backupDays) : null,
        autoApplyOnOpen,
        lastAppliedAt: prefs?.lastAppliedAt ?? null,
      });
      setStatus('Lifecycle policy saved.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not save lifecycle policy.');
    }
  }, [snapshotDays, backupDays, autoApplyOnOpen, prefs?.lastAppliedAt, onSavePrefs]);

  const handleApply = useCallback(async () => {
    try {
      const result = await onApplyPolicy();
      setStatus(
        result.prunedSnapshotCount > 0 || result.prunedBackupCount > 0
          ? `Pruned ${result.prunedSnapshotCount} snapshot(s) and ${result.prunedBackupCount} backup(s).`
          : 'No metadata matched the lifecycle policy.',
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not apply lifecycle policy.');
    }
  }, [onApplyPolicy]);

  if (!canUse) return null;

  return (
    <section className={cn('studiolive-enterprise-panel', className)}>
      <p className="studiolive-enterprise-panel__title flex items-center gap-1">
        <Archive className="h-3 w-3" /> Console lifecycle
      </p>
      <p className="studiolive-enterprise-panel__hint">
        Auto-prune old ops snapshots and cloud scene backups from Regal Cloud.
      </p>
      <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
        <input
          type="number"
          min={7}
          value={snapshotDays}
          onChange={(e) => setSnapshotDays(e.target.value)}
          placeholder="Prune snapshots (days)"
          className="w-36 rounded border border-white/10 bg-black px-2 py-1 outline-none"
        />
        <input
          type="number"
          min={7}
          value={backupDays}
          onChange={(e) => setBackupDays(e.target.value)}
          placeholder="Prune backups (days)"
          className="w-36 rounded border border-white/10 bg-black px-2 py-1 outline-none"
        />
        <button type="button" disabled={readOnly} className="studiolive-enterprise-panel__btn" onClick={() => { void handleSave(); }}>
          SAVE POLICY
        </button>
        <button type="button" disabled={readOnly} className="studiolive-enterprise-panel__btn" onClick={() => { void handleApply(); }}>
          <RefreshCw className="h-3 w-3" /> APPLY
        </button>
      </div>
      <label className="mt-2 flex items-center gap-2 text-[10px] text-sky-200/90">
        <input
          type="checkbox"
          checked={autoApplyOnOpen}
          disabled={readOnly}
          onChange={(e) => setAutoApplyOnOpen(e.target.checked)}
        />
        Auto-apply on console open (max once per 24h)
      </label>
      {prefs?.lastAppliedAt && (
        <p className="studiolive-enterprise-panel__hint">
          Last auto-apply {new Date(prefs.lastAppliedAt).toLocaleString()}
        </p>
      )}
      {status && <p className="studiolive-enterprise-panel__hint">{status}</p>}
    </section>
  );
}

export function AudioChannelInventoryPanel({
  canUse,
  devices,
  state,
  getAudioSourceForDevice,
  linkedUsb,
  sessionId,
  onExport,
  className,
}: {
  canUse: boolean;
  devices: Device[];
  state: AudioConsoleState;
  getAudioSourceForDevice: (deviceId: string) => AudioInputSource;
  linkedUsb: Record<string, string | null>;
  sessionId?: string | null;
  onExport?: () => void;
  className?: string;
}) {
  const rows = useMemo(
    () => buildChannelInventoryRows({ devices, state, getAudioSourceForDevice, linkedUsb }),
    [devices, state, getAudioSourceForDevice, linkedUsb],
  );

  if (!canUse) return null;

  return (
    <section className={cn('studiolive-enterprise-panel', className)}>
      <p className="studiolive-enterprise-panel__title flex items-center gap-1">
        <SlidersHorizontal className="h-3 w-3" /> Channel inventory
      </p>
      <p className="studiolive-enterprise-panel__hint">
        Export live input routing, levels, and mute state for compliance handoff.
      </p>
      <p className="studiolive-enterprise-panel__hint">{rows.length} active channel(s)</p>
      <div className="studiolive-enterprise-panel__actions">
        <button
          type="button"
          disabled={rows.length === 0}
          className="studiolive-enterprise-panel__btn"
          onClick={() => {
            downloadChannelInventoryCsv(buildChannelInventoryCsv(rows), 'cloudcast-audio-channels.csv');
            onExport?.();
          }}
        >
          <Download className="h-3 w-3" /> CSV
        </button>
        <button
          type="button"
          disabled={rows.length === 0}
          className="studiolive-enterprise-panel__btn"
          onClick={() => {
            downloadChannelInventoryJson(buildChannelInventoryJson(rows, sessionId), 'cloudcast-audio-channels.json');
            onExport?.();
          }}
        >
          <Download className="h-3 w-3" /> JSON
        </button>
      </div>
    </section>
  );
}

export function AudioRundownRunSheetPanel({
  canUse,
  draft,
  templateName,
  onExport,
  className,
}: {
  canUse: boolean;
  draft: AudioSceneRundownItem[];
  templateName?: string;
  onExport?: () => void;
  className?: string;
}) {
  const name = templateName?.trim() || 'Scene rundown';

  if (!canUse) return null;

  return (
    <section className={cn('studiolive-enterprise-panel', className)}>
      <p className="studiolive-enterprise-panel__title flex items-center gap-1">
        <ListOrdered className="h-3 w-3" /> Rundown run sheet
      </p>
      {draft.length === 0 ? (
        <p className="studiolive-enterprise-panel__hint">Build a scene rundown queue to export a show calling sheet.</p>
      ) : (
        <>
          <p className="studiolive-enterprise-panel__hint">
            {draft.length} step(s) · {draft.reduce((sum, item) => sum + item.holdSeconds, 0)}s total hold
          </p>
          <div className="studiolive-enterprise-panel__actions">
            <button
              type="button"
              className="studiolive-enterprise-panel__btn"
              onClick={() => {
                downloadRundownRunSheetCsv(buildRundownRunSheetCsv(name, draft), 'cloudcast-rundown-runsheet.csv');
                onExport?.();
              }}
            >
              <Download className="h-3 w-3" /> CSV
            </button>
            <button
              type="button"
              className="studiolive-enterprise-panel__btn"
              onClick={() => {
                downloadRundownRunSheetJson(buildRundownRunSheetJson(name, draft), 'cloudcast-rundown-runsheet.json');
                onExport?.();
              }}
            >
              <Download className="h-3 w-3" /> JSON
            </button>
            <button
              type="button"
              className="studiolive-enterprise-panel__btn"
              onClick={() => {
                downloadRundownRunSheetText(buildRundownRunSheetText(name, draft), 'cloudcast-rundown-runsheet.txt');
                onExport?.();
              }}
            >
              <Download className="h-3 w-3" /> TXT
            </button>
          </div>
        </>
      )}
    </section>
  );
}
