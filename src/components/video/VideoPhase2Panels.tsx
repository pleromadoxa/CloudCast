import { useCallback, useState } from 'react';
import { Copy, HardDriveDownload, Mail, Share2, BookOpen } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { VideoOpsDigestFrequency } from '../../lib/videoOpsDigest';
import { digestFrequencyLabel } from '../../lib/videoOpsDigest';
import type { VideoProgramSnapshot } from '../../lib/videoProgramSnapshot';

export function VideoProgramSnapshotPanel({
  snapshot,
  ageMinutes,
  className,
}: {
  snapshot: VideoProgramSnapshot | null;
  ageMinutes: number;
  className?: string;
}) {
  if (!snapshot) return null;
  return (
    <section className={cn('studiolive-enterprise-panel', className)}>
      <p className="studiolive-enterprise-panel__title flex items-center gap-1">
        <HardDriveDownload className="h-3 w-3" /> Ops snapshot
      </p>
      <div className="studiolive-enterprise-panel__body space-y-0.5">
        <p>{snapshot.operatorLabel ?? 'Operator'} · {Math.round(ageMinutes)}m ago</p>
        <p>
          PST {snapshot.pstDeviceLabel ?? '—'} · PGM {snapshot.pgmDeviceLabel ?? '—'}
        </p>
        <p>
          {snapshot.isOnAir ? 'ON AIR' : 'Off air'}
          {snapshot.isRecording ? ' · REC' : ''}
          {snapshot.replayOnPgm ? ` · replay ${snapshot.replayLabel ?? ''}` : ''}
        </p>
        <p>{snapshot.liveInputCount} live · output {snapshot.outputMode ?? 'main'}</p>
      </div>
    </section>
  );
}

export function VideoProgramSharePanel({
  canShare,
  readOnly,
  presets,
  onPublishShare,
  onImportShare,
  className,
}: {
  canShare: boolean;
  readOnly: boolean;
  presets: Array<{ id: string; name: string }>;
  onPublishShare: (presetId: string) => Promise<string>;
  onImportShare: (code: string) => Promise<void>;
  className?: string;
}) {
  const [selectedId, setSelectedId] = useState('');
  const [importCode, setImportCode] = useState('');
  const [shareCode, setShareCode] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handlePublish = useCallback(async () => {
    if (!selectedId) {
      setStatus('Select a program preset first.');
      return;
    }
    try {
      const code = await onPublishShare(selectedId);
      setShareCode(code);
      setStatus(`Share code: ${code}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Publish failed.');
    }
  }, [selectedId, onPublishShare]);

  const handleImport = useCallback(async () => {
    if (!importCode.trim()) return;
    try {
      await onImportShare(importCode);
      setImportCode('');
      setStatus('Shared program preset imported.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Import failed.');
    }
  }, [importCode, onImportShare]);

  if (!canShare) return null;

  return (
    <section className={cn('studiolive-enterprise-panel', className)}>
      <p className="studiolive-enterprise-panel__title flex items-center gap-1">
        <Share2 className="h-3 w-3" /> Team preset share
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {presets.length > 0 && (
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="min-w-0 flex-1 rounded border border-white/10 bg-black px-2 py-1 text-[10px] outline-none"
          >
            <option value="">Select preset…</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        <button type="button" disabled={readOnly || !selectedId} className="studiolive-enterprise-panel__btn" onClick={() => { void handlePublish(); }}>
          PUBLISH
        </button>
        {shareCode && (
          <button type="button" className="studiolive-enterprise-panel__btn" onClick={() => { void navigator.clipboard.writeText(shareCode).then(() => setCopied(true)); }}>
            <Copy className="h-3 w-3" /> {copied ? 'COPIED' : shareCode}
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <input
          type="text"
          value={importCode}
          onChange={(e) => setImportCode(e.target.value.toUpperCase())}
          placeholder="Import code"
          className="min-w-0 flex-1 rounded border border-white/10 bg-black px-2 py-1 text-[10px] uppercase outline-none"
        />
        <button type="button" disabled={readOnly || !importCode.trim()} className="studiolive-enterprise-panel__btn" onClick={() => { void handleImport(); }}>
          IMPORT
        </button>
      </div>
      {status && <p className="studiolive-enterprise-panel__hint">{status}</p>}
    </section>
  );
}

export function VideoProgramLibraryPanel({
  canUse,
  readOnly,
  presets,
  libraryEntries,
  onPromote,
  onLoad,
  className,
}: {
  canUse: boolean;
  readOnly: boolean;
  presets: Array<{ id: string; name: string }>;
  libraryEntries: Array<{ id: string; name: string; category: string | null }>;
  onPromote: (presetId: string, category: string) => Promise<void>;
  onLoad: (presetId: string) => void;
  className?: string;
}) {
  const [selectedId, setSelectedId] = useState('');
  const [category, setCategory] = useState('General');
  const [status, setStatus] = useState<string | null>(null);

  if (!canUse) return null;

  return (
    <section className={cn('studiolive-enterprise-panel', className)}>
      <p className="studiolive-enterprise-panel__title flex items-center gap-1">
        <BookOpen className="h-3 w-3" /> Preset library
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {presets.length > 0 && (
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="min-w-0 flex-1 rounded border border-white/10 bg-black px-2 py-1 text-[10px] outline-none">
            <option value="">Promote preset…</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" className="w-20 rounded border border-white/10 bg-black px-2 py-1 text-[10px] outline-none" />
        <button type="button" disabled={readOnly || !selectedId} className="studiolive-enterprise-panel__btn" onClick={() => { void onPromote(selectedId, category).then(() => setStatus('Added to library.')).catch((e) => setStatus(e instanceof Error ? e.message : 'Failed')); }}>
          ADD
        </button>
      </div>
      {libraryEntries.length > 0 && (
        <ul className="mt-2 max-h-20 space-y-1 overflow-y-auto text-[10px]">
          {libraryEntries.map((e) => (
            <li key={e.id} className="flex justify-between gap-2 text-sky-200/90">
              <span className="truncate">{e.category ?? 'General'} · {e.name}</span>
              <button type="button" className="studiolive-enterprise-panel__btn" onClick={() => onLoad(e.id)}>LOAD</button>
            </li>
          ))}
        </ul>
      )}
      {status && <p className="studiolive-enterprise-panel__hint">{status}</p>}
    </section>
  );
}

export function VideoOpsDigestPanel({
  canUse,
  prefs,
  onSavePrefs,
  onSendNow,
  className,
}: {
  canUse: boolean;
  prefs: { enabled: boolean; frequency: VideoOpsDigestFrequency; lastSentAt: string | null } | null;
  onSavePrefs: (enabled: boolean, frequency: VideoOpsDigestFrequency) => Promise<void>;
  onSendNow: () => Promise<void>;
  className?: string;
}) {
  const [enabled, setEnabled] = useState(prefs?.enabled ?? false);
  const [frequency, setFrequency] = useState<VideoOpsDigestFrequency>(prefs?.frequency ?? 'manual');
  const [status, setStatus] = useState<string | null>(null);

  if (!canUse) return null;

  return (
    <section className={cn('studiolive-enterprise-panel', className)}>
      <p className="studiolive-enterprise-panel__title flex items-center gap-1">
        <Mail className="h-3 w-3" /> Ops digest email
      </p>
      <p className="studiolive-enterprise-panel__hint">
        7-day snapshot + audit summary{prefs?.lastSentAt ? ` · last ${new Date(prefs.lastSentAt).toLocaleString()}` : ''}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
        <label className="flex items-center gap-1 text-sky-200/90">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enable
        </label>
        <select value={frequency} onChange={(e) => setFrequency(e.target.value as VideoOpsDigestFrequency)} className="rounded border border-white/10 bg-black px-2 py-1 text-[10px] outline-none">
          <option value="manual">Manual</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
        <button type="button" className="studiolive-enterprise-panel__btn" onClick={() => { void onSavePrefs(enabled, frequency).then(() => setStatus(`Saved (${digestFrequencyLabel(frequency)}).`)); }}>
          SAVE
        </button>
        <button type="button" className="studiolive-enterprise-panel__btn" onClick={() => { void onSendNow().then(() => setStatus('Digest queued.')).catch((e) => setStatus(e instanceof Error ? e.message : 'Failed')); }}>
          SEND
        </button>
      </div>
      {status && <p className="studiolive-enterprise-panel__hint">{status}</p>}
    </section>
  );
}
