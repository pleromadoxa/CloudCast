import { useCallback, useState } from 'react';
import { Copy, HardDriveDownload, Share2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ReplayBufferSnapshotPanelProps {
  snapshot: {
    operatorLabel: string | null;
    bufferSeconds: number;
    chunkCount: number;
    markTimecodeIn: string | null;
    markTimecodeOut: string | null;
    houseClockSmpte: string | null;
    capturedAt: string;
  } | null;
  ageMinutes: number;
  className?: string;
}

export function ReplayBufferSnapshotPanel({ snapshot, ageMinutes, className }: ReplayBufferSnapshotPanelProps) {
  if (!snapshot) return null;

  return (
    <section className={cn('border-t border-white/5 px-3 py-2', className)}>
      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-mixer-muted">
        <HardDriveDownload className="h-3 w-3" /> Ops snapshot
      </p>
      <div className="mt-1 space-y-0.5 text-[10px] text-emerald-200/90">
        <p>
          {snapshot.operatorLabel ?? 'Operator'} · {Math.round(ageMinutes)}m ago
        </p>
        <p>
          Buffer {snapshot.bufferSeconds.toFixed(1)}s · {snapshot.chunkCount} chunks · TC {snapshot.houseClockSmpte ?? '—'}
        </p>
        {(snapshot.markTimecodeIn || snapshot.markTimecodeOut) && (
          <p>
            Marks {snapshot.markTimecodeIn ?? '—'} → {snapshot.markTimecodeOut ?? '—'}
          </p>
        )}
        <p className="text-mixer-muted">Video buffer is browser-local — snapshot is metadata for recovery notes only.</p>
      </div>
    </section>
  );
}

interface ReplayRundownSharePanelProps {
  canShare: boolean;
  readOnly: boolean;
  templates: Array<{ id: string; name: string }>;
  onPublishShare: (templateId: string) => Promise<string>;
  onImportShare: (code: string) => Promise<void>;
  className?: string;
}

export function ReplayRundownSharePanel({
  canShare,
  readOnly,
  templates,
  onPublishShare,
  onImportShare,
  className,
}: ReplayRundownSharePanelProps) {
  const [shareCode, setShareCode] = useState('');
  const [importCode, setImportCode] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [status, setStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handlePublish = useCallback(async () => {
    if (!selectedTemplateId) {
      setStatus('Save a rundown template first, then select it to publish.');
      return;
    }
    try {
      const code = await onPublishShare(selectedTemplateId);
      setShareCode(code);
      setStatus(`Share code published: ${code}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not publish share code.');
    }
  }, [selectedTemplateId, onPublishShare]);

  const handleImport = useCallback(async () => {
    if (!importCode.trim()) return;
    try {
      await onImportShare(importCode);
      setImportCode('');
      setStatus('Shared rundown imported to your library.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Import failed.');
    }
  }, [importCode, onImportShare]);

  const handleCopy = useCallback(async () => {
    if (!shareCode) return;
    try {
      await navigator.clipboard.writeText(shareCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [shareCode]);

  if (!canShare) return null;

  return (
    <section className={cn('border-t border-white/5 px-3 py-2', className)}>
      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-mixer-muted">
        <Share2 className="h-3 w-3" /> Team rundown share
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {templates.length > 0 && (
          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="min-w-0 flex-1 rounded border border-white/10 bg-black px-2 py-1 text-[10px] outline-none focus:border-emerald-500/40"
          >
            <option value="">Select template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
        <button type="button" disabled={readOnly || !selectedTemplateId} className="replay-btn text-[9px]" onClick={() => { void handlePublish(); }}>
          PUBLISH CODE
        </button>
        {shareCode && (
          <button type="button" className="replay-btn text-[9px]" onClick={() => { void handleCopy(); }}>
            <Copy className="h-3 w-3" /> {copied ? 'COPIED' : shareCode}
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <input
          type="text"
          value={importCode}
          onChange={(e) => setImportCode(e.target.value.toUpperCase())}
          placeholder="Import share code"
          className="min-w-0 flex-1 rounded border border-white/10 bg-black px-2 py-1 text-[10px] uppercase outline-none focus:border-emerald-500/40"
        />
        <button type="button" disabled={readOnly || !importCode.trim()} className="replay-btn text-[9px]" onClick={() => { void handleImport(); }}>
          IMPORT
        </button>
      </div>
      {status && <p className="mt-1 text-[9px] text-mixer-muted">{status}</p>}
    </section>
  );
}
