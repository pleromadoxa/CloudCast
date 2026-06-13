import { useCallback, useState } from 'react';
import { Copy, Download, Share2 } from 'lucide-react';
import type { ConsoleSceneSnapshot, SceneId } from '../../lib/audioConsolePersistence';
import {
  buildFxDiffCsv,
  buildFxDiffJson,
  diffFxSnapshots,
  downloadFxDiffCsv,
  downloadFxDiffJson,
} from '../../lib/audioFxDiff';
import { formatSceneRundownShareCode } from '../../lib/audioSceneRundownShare';
import { cn } from '../../lib/utils';

const SCENE_OPTIONS: SceneId[] = ['A', 'B', 'C', 'D'];

export function AudioSceneRundownSharePanel({
  canShare,
  readOnly,
  templates,
  onPublishShare,
  onImportShare,
  onImported,
  className,
}: {
  canShare: boolean;
  readOnly: boolean;
  templates: Array<{ id: string; name: string }>;
  onPublishShare: (templateId: string) => Promise<string>;
  onImportShare: (code: string) => Promise<void>;
  onImported?: () => void;
  className?: string;
}) {
  const [selectedId, setSelectedId] = useState('');
  const [importCode, setImportCode] = useState('');
  const [shareCode, setShareCode] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handlePublish = useCallback(async () => {
    if (!selectedId) {
      setStatus('Select a saved rundown first.');
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
    const code = formatSceneRundownShareCode(importCode);
    if (!code) return;
    try {
      await onImportShare(code);
      setImportCode('');
      setStatus('Shared rundown imported.');
      onImported?.();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Import failed.');
    }
  }, [importCode, onImportShare, onImported]);

  if (!canShare) return null;

  return (
    <section className={cn('studiolive-enterprise-panel', className)}>
      <p className="studiolive-enterprise-panel__title flex items-center gap-1">
        <Share2 className="h-3 w-3" /> Rundown share
      </p>
      <p className="studiolive-enterprise-panel__hint">Publish 8-character codes for scene rundown templates.</p>
      {templates.length > 0 ? (
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="mt-2 w-full rounded border border-white/10 bg-black px-2 py-1 text-[10px] outline-none"
        >
          <option value="">Select rundown…</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      ) : (
        <p className="studiolive-enterprise-panel__hint">Save a rundown template first.</p>
      )}
      <div className="studiolive-enterprise-panel__actions mt-2">
        <button type="button" disabled={readOnly || !selectedId} className="studiolive-enterprise-panel__btn" onClick={() => { void handlePublish(); }}>
          PUBLISH
        </button>
        {shareCode && (
          <button
            type="button"
            className="studiolive-enterprise-panel__btn"
            onClick={() => {
              void navigator.clipboard.writeText(shareCode);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }}
          >
            <Copy className="h-3 w-3" /> {copied ? 'Copied' : shareCode}
          </button>
        )}
      </div>
      <div className="mt-2 flex gap-1">
        <input
          type="text"
          value={importCode}
          onChange={(e) => setImportCode(e.target.value.toUpperCase())}
          placeholder="Import code"
          maxLength={8}
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

export function AudioFxDiffPanel({
  canUse,
  storedScenes,
  onExport,
  className,
}: {
  canUse: boolean;
  storedScenes: Partial<Record<SceneId, ConsoleSceneSnapshot>>;
  onExport?: () => void;
  className?: string;
}) {
  const [sceneA, setSceneA] = useState<SceneId>('A');
  const [sceneB, setSceneB] = useState<SceneId>('B');

  const available = SCENE_OPTIONS.filter((id) => Boolean(storedScenes[id]));
  const snapA = storedScenes[sceneA];
  const snapB = storedScenes[sceneB];
  const summary =
    snapA && snapB && sceneA !== sceneB ? diffFxSnapshots(sceneA, snapA, sceneB, snapB) : null;

  if (!canUse) return null;

  return (
    <section className={cn('studiolive-enterprise-panel', className)}>
      <p className="studiolive-enterprise-panel__title">FX diff export</p>
      {available.length < 2 ? (
        <p className="studiolive-enterprise-panel__hint">Store at least two scenes to compare FX slots A–D.</p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
            <select value={sceneA} onChange={(e) => setSceneA(e.target.value as SceneId)} className="rounded border border-white/10 bg-black px-2 py-1 outline-none">
              {available.map((id) => (
                <option key={id} value={id}>Scene {id}</option>
              ))}
            </select>
            <span className="self-center text-mixer-muted">vs</span>
            <select value={sceneB} onChange={(e) => setSceneB(e.target.value as SceneId)} className="rounded border border-white/10 bg-black px-2 py-1 outline-none">
              {available.filter((id) => id !== sceneA).map((id) => (
                <option key={id} value={id}>Scene {id}</option>
              ))}
            </select>
          </div>
          {summary && (
            <>
              <p className="studiolive-enterprise-panel__hint">
                {summary.rows.length} FX slot change(s) between scenes {sceneA} and {sceneB}
              </p>
              {summary.rows.length > 0 && (
                <ul className="mt-1 max-h-20 space-y-0.5 overflow-y-auto text-[10px] text-sky-200/90">
                  {summary.rows.map((row) => (
                    <li key={row.slot}>
                      {row.slotName}: {row.enabledFrom ? 'on' : 'off'} → {row.enabledTo ? 'on' : 'off'} · mix {row.mixFrom}% → {row.mixTo}%
                    </li>
                  ))}
                </ul>
              )}
              <div className="studiolive-enterprise-panel__actions">
                <button
                  type="button"
                  className="studiolive-enterprise-panel__btn"
                  onClick={() => {
                    downloadFxDiffCsv(buildFxDiffCsv(summary), `fx-diff-${sceneA}-${sceneB}.csv`);
                    onExport?.();
                  }}
                >
                  <Download className="h-3 w-3" /> CSV
                </button>
                <button
                  type="button"
                  className="studiolive-enterprise-panel__btn"
                  onClick={() => {
                    downloadFxDiffJson(buildFxDiffJson(summary), `fx-diff-${sceneA}-${sceneB}.json`);
                    onExport?.();
                  }}
                >
                  <Download className="h-3 w-3" /> JSON
                </button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
