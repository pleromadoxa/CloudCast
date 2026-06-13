import { useCallback, useState } from 'react';
import { Archive, BookOpen, Mail, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ReplayOpsDigestFrequency } from '../../lib/replayOpsDigest';
import { digestFrequencyLabel } from '../../lib/replayOpsDigest';
import type { ReplayLifecyclePrefs } from '../../lib/replayClipLifecycle';

interface ReplayShowLibraryPanelProps {
  canUse: boolean;
  readOnly: boolean;
  templates: Array<{ id: string; name: string }>;
  libraryEntries: Array<{ id: string; name: string; category: string | null; itemCount: number }>;
  onPromote: (templateId: string, category: string) => Promise<void>;
  onLoadLibrary: (templateId: string) => void;
  className?: string;
}

export function ReplayShowLibraryPanel({
  canUse,
  readOnly,
  templates,
  libraryEntries,
  onPromote,
  onLoadLibrary,
  className,
}: ReplayShowLibraryPanelProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [category, setCategory] = useState('General');
  const [status, setStatus] = useState<string | null>(null);

  const handlePromote = useCallback(async () => {
    if (!selectedTemplateId) {
      setStatus('Select a saved template to add to your show library.');
      return;
    }
    try {
      await onPromote(selectedTemplateId, category);
      setStatus(`Added to show library (${category}).`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not promote template.');
    }
  }, [selectedTemplateId, category, onPromote]);

  if (!canUse) return null;

  return (
    <section className={cn('border-t border-white/5 px-3 py-2', className)}>
      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-mixer-muted">
        <BookOpen className="h-3 w-3" /> Show library
      </p>
      <p className="mt-1 text-[9px] text-mixer-muted">Account-wide rundown templates — reusable across sessions and shows.</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {templates.length > 0 && (
          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="min-w-0 flex-1 rounded border border-white/10 bg-black px-2 py-1 text-[10px] outline-none focus:border-emerald-500/40"
          >
            <option value="">Template to promote…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category"
          className="w-24 rounded border border-white/10 bg-black px-2 py-1 text-[10px] outline-none focus:border-emerald-500/40"
        />
        <button type="button" disabled={readOnly || !selectedTemplateId} className="replay-btn text-[9px]" onClick={() => { void handlePromote(); }}>
          ADD TO LIBRARY
        </button>
      </div>
      {libraryEntries.length > 0 && (
        <ul className="mt-2 max-h-24 space-y-1 overflow-y-auto text-[10px]">
          {libraryEntries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-2 text-emerald-200/90">
              <span className="truncate">
                {entry.category ?? 'General'} · {entry.name} ({entry.itemCount})
              </span>
              <button type="button" className="replay-btn shrink-0 text-[8px]" onClick={() => onLoadLibrary(entry.id)}>
                LOAD
              </button>
            </li>
          ))}
        </ul>
      )}
      {status && <p className="mt-1 text-[9px] text-mixer-muted">{status}</p>}
    </section>
  );
}

interface ReplayOpsDigestPanelProps {
  canUse: boolean;
  prefs: { enabled: boolean; frequency: ReplayOpsDigestFrequency; lastSentAt: string | null } | null;
  onSavePrefs: (enabled: boolean, frequency: ReplayOpsDigestFrequency) => Promise<void>;
  onSendNow: () => Promise<void>;
  className?: string;
}

export function ReplayOpsDigestPanel({
  canUse,
  prefs,
  onSavePrefs,
  onSendNow,
  className,
}: ReplayOpsDigestPanelProps) {
  const [enabled, setEnabled] = useState(prefs?.enabled ?? false);
  const [frequency, setFrequency] = useState<ReplayOpsDigestFrequency>(prefs?.frequency ?? 'manual');
  const [status, setStatus] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    try {
      await onSavePrefs(enabled, frequency);
      setStatus(`Digest prefs saved (${digestFrequencyLabel(frequency)}).`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not save digest prefs.');
    }
  }, [enabled, frequency, onSavePrefs]);

  const handleSend = useCallback(async () => {
    try {
      await onSendNow();
      setStatus('Ops digest email queued.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not send digest.');
    }
  }, [onSendNow]);

  if (!canUse) return null;

  return (
    <section className={cn('border-t border-white/5 px-3 py-2', className)}>
      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-mixer-muted">
        <Mail className="h-3 w-3" /> Ops digest email
      </p>
      <p className="mt-1 text-[9px] text-mixer-muted">
        Summarizes buffer snapshots and audit events from the last 7 days.
        {prefs?.lastSentAt ? ` Last sent ${new Date(prefs.lastSentAt).toLocaleString()}.` : ''}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
        <label className="flex items-center gap-1 text-emerald-200/90">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enable
        </label>
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as ReplayOpsDigestFrequency)}
          className="rounded border border-white/10 bg-black px-2 py-1 text-[10px] outline-none"
        >
          <option value="manual">Manual only</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
        <button type="button" className="replay-btn text-[9px]" onClick={() => { void handleSave(); }}>
          SAVE
        </button>
        <button type="button" className="replay-btn text-[9px]" onClick={() => { void handleSend(); }}>
          SEND NOW
        </button>
      </div>
      {status && <p className="mt-1 text-[9px] text-mixer-muted">{status}</p>}
    </section>
  );
}

interface ReplayLifecyclePanelProps {
  canUse: boolean;
  readOnly: boolean;
  prefs: ReplayLifecyclePrefs | null;
  archivedCount: number;
  onSavePrefs: (prefs: ReplayLifecyclePrefs) => Promise<void>;
  onApplyPolicy: () => Promise<{ archivedCount: number; deleteCandidateIds: string[] }>;
  onPurgeCandidates: (ids: string[]) => Promise<void>;
  className?: string;
}

export function ReplayLifecyclePanel({
  canUse,
  readOnly,
  prefs,
  archivedCount,
  onSavePrefs,
  onApplyPolicy,
  onPurgeCandidates,
  className,
}: ReplayLifecyclePanelProps) {
  const [archiveDays, setArchiveDays] = useState(prefs?.autoArchiveDays?.toString() ?? '');
  const [deleteDays, setDeleteDays] = useState(prefs?.autoDeleteArchivedDays?.toString() ?? '');
  const [status, setStatus] = useState<string | null>(null);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);

  const handleSave = useCallback(async () => {
    try {
      await onSavePrefs({
        autoArchiveDays: archiveDays.trim() ? Number(archiveDays) : null,
        autoDeleteArchivedDays: deleteDays.trim() ? Number(deleteDays) : null,
      });
      setStatus('Lifecycle policy saved.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not save lifecycle policy.');
    }
  }, [archiveDays, deleteDays, onSavePrefs]);

  const handleApply = useCallback(async () => {
    try {
      const result = await onApplyPolicy();
      setPendingDeleteIds(result.deleteCandidateIds);
      setStatus(
        result.archivedCount > 0 || result.deleteCandidateIds.length > 0
          ? `Archived ${result.archivedCount} clip(s). ${result.deleteCandidateIds.length} eligible for purge.`
          : 'No clips matched the lifecycle policy.',
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not apply lifecycle policy.');
    }
  }, [onApplyPolicy]);

  const handlePurge = useCallback(async () => {
    if (pendingDeleteIds.length === 0) return;
    try {
      await onPurgeCandidates(pendingDeleteIds);
      setPendingDeleteIds([]);
      setStatus(`Purged ${pendingDeleteIds.length} archived clip(s).`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Purge failed.');
    }
  }, [pendingDeleteIds, onPurgeCandidates]);

  if (!canUse) return null;

  return (
    <section className={cn('border-t border-white/5 px-3 py-2', className)}>
      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-mixer-muted">
        <Archive className="h-3 w-3" /> Clip lifecycle
      </p>
      <p className="mt-1 text-[9px] text-mixer-muted">
        Auto-archive old clips; purge archived clips after a retention window. {archivedCount} archived in library.
      </p>
      <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
        <input
          type="number"
          min={7}
          value={archiveDays}
          onChange={(e) => setArchiveDays(e.target.value)}
          placeholder="Archive after (days)"
          className="w-32 rounded border border-white/10 bg-black px-2 py-1 outline-none focus:border-emerald-500/40"
        />
        <input
          type="number"
          min={30}
          value={deleteDays}
          onChange={(e) => setDeleteDays(e.target.value)}
          placeholder="Purge archived (days)"
          className="w-32 rounded border border-white/10 bg-black px-2 py-1 outline-none focus:border-emerald-500/40"
        />
        <button type="button" disabled={readOnly} className="replay-btn text-[9px]" onClick={() => { void handleSave(); }}>
          SAVE POLICY
        </button>
        <button type="button" disabled={readOnly} className="replay-btn text-[9px]" onClick={() => { void handleApply(); }}>
          <RefreshCw className="h-3 w-3" /> APPLY
        </button>
        {pendingDeleteIds.length > 0 && (
          <button type="button" disabled={readOnly} className="replay-btn text-[9px] text-mixer-red" onClick={() => { void handlePurge(); }}>
            PURGE {pendingDeleteIds.length}
          </button>
        )}
      </div>
      {status && <p className="mt-1 text-[9px] text-mixer-muted">{status}</p>}
    </section>
  );
}
