import { useState } from 'react';
import { BookOpen, CloudUpload, RotateCcw } from 'lucide-react';
import type { SceneId } from '../../lib/audioConsolePersistence';
import type { AudioSceneRundownItem } from '../../lib/audioSceneRundown';
import { cn } from '../../lib/utils';

export function AudioSceneRundownLibraryPanel({
  canUse,
  readOnly,
  templates,
  libraryEntries,
  onPromote,
  onLoadItems,
  className,
}: {
  canUse: boolean;
  readOnly: boolean;
  templates: Array<{ id: string; name: string }>;
  libraryEntries: Array<{ id: string; name: string; category: string | null; items: AudioSceneRundownItem[] }>;
  onPromote: (templateId: string, category: string) => Promise<void>;
  onLoadItems: (items: AudioSceneRundownItem[], name: string) => void;
  className?: string;
}) {
  const [selectedId, setSelectedId] = useState('');
  const [category, setCategory] = useState('General');
  const [status, setStatus] = useState<string | null>(null);

  if (!canUse) return null;

  return (
    <section className={cn('studiolive-enterprise-panel', className)}>
      <p className="studiolive-enterprise-panel__title flex items-center gap-1">
        <BookOpen className="h-3 w-3" /> Rundown library
      </p>
      <p className="studiolive-enterprise-panel__hint">Promote saved rundowns to reusable account categories.</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {templates.length > 0 && (
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="min-w-0 flex-1 rounded border border-white/10 bg-black px-2 py-1 text-[10px] outline-none"
          >
            <option value="">Promote rundown…</option>
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
          className="w-20 rounded border border-white/10 bg-black px-2 py-1 text-[10px] outline-none"
        />
        <button
          type="button"
          disabled={readOnly || !selectedId}
          className="studiolive-enterprise-panel__btn"
          onClick={() => {
            void onPromote(selectedId, category)
              .then(() => setStatus('Added to rundown library.'))
              .catch((e) => setStatus(e instanceof Error ? e.message : 'Failed'));
          }}
        >
          ADD
        </button>
      </div>
      {libraryEntries.length > 0 && (
        <ul className="mt-2 max-h-20 space-y-1 overflow-y-auto text-[10px]">
          {libraryEntries.map((entry) => (
            <li key={entry.id} className="flex justify-between gap-2 text-sky-200/90">
              <span className="truncate">{entry.category ?? 'General'} · {entry.name} ({entry.items.length})</span>
              <button
                type="button"
                className="studiolive-enterprise-panel__btn"
                onClick={() => {
                  onLoadItems(entry.items, entry.name);
                  setStatus(`Loaded "${entry.name}" from library.`);
                }}
              >
                LOAD
              </button>
            </li>
          ))}
        </ul>
      )}
      {status && <p className="studiolive-enterprise-panel__hint">{status}</p>}
    </section>
  );
}

export function AudioSceneBackupPanel({
  canUse,
  readOnly,
  backups,
  storedScenes,
  onRestore,
  className,
}: {
  canUse: boolean;
  readOnly: boolean;
  backups: Array<{ sceneId: SceneId; updatedAt: string }>;
  storedScenes: Partial<Record<SceneId, unknown>>;
  onRestore: (sceneId: SceneId) => void;
  className?: string;
}) {
  if (!canUse) return null;

  const backedUp = new Set(backups.map((row) => row.sceneId));

  return (
    <section className={cn('studiolive-enterprise-panel', className)}>
      <p className="studiolive-enterprise-panel__title flex items-center gap-1">
        <CloudUpload className="h-3 w-3" /> Cloud scene backup
      </p>
      <p className="studiolive-enterprise-panel__hint">
        Stored scenes A–D auto-sync to Regal Cloud when you Shift+store.
      </p>
      <ul className="mt-2 space-y-1 text-[10px] text-sky-200/90">
        {(['A', 'B', 'C', 'D'] as SceneId[]).map((sceneId) => {
          const backup = backups.find((row) => row.sceneId === sceneId);
          const local = Boolean(storedScenes[sceneId]);
          return (
            <li key={sceneId} className="flex items-center justify-between gap-2">
              <span>
                Scene {sceneId} · {backup ? `cloud ${new Date(backup.updatedAt).toLocaleString()}` : 'no cloud backup'}
                {local ? ' · local stored' : ''}
              </span>
              {backup && (
                <button
                  type="button"
                  disabled={readOnly}
                  className="studiolive-enterprise-panel__btn"
                  onClick={() => onRestore(sceneId)}
                >
                  <RotateCcw className="h-3 w-3" /> RESTORE
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {backedUp.size === 0 && (
        <p className="studiolive-enterprise-panel__hint">Store a scene (Shift+A–D) to create your first cloud backup.</p>
      )}
    </section>
  );
}
