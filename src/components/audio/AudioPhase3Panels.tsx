import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, ListOrdered, Play, Save, Square, Trash2 } from 'lucide-react';
import type { ConsoleSceneSnapshot, SceneId } from '../../lib/audioConsolePersistence';
import {
  buildSceneDiffCsv,
  buildSceneDiffJson,
  diffSceneSnapshots,
  downloadSceneDiffCsv,
  downloadSceneDiffJson,
} from '../../lib/audioSceneDiff';
import {
  deleteAudioSceneRundownTemplate,
  fetchAudioSceneRundownTemplates,
  saveAudioSceneRundownTemplate,
  validateRundownDraft,
  type AudioSceneRundownItem,
  type AudioSceneRundownTemplate,
} from '../../lib/audioSceneRundown';
import { SCENE_IDS } from '../../hooks/useAudioConsoleState';
import { cn } from '../../lib/utils';

const SCENE_OPTIONS: SceneId[] = ['A', 'B', 'C', 'D'];

export function AudioSceneRundownPanel({
  canUse,
  readOnly,
  sessionId,
  storedScenes,
  onRecallScene,
  onRundownStart,
  onRundownAdvance,
  onRundownComplete,
  onRundownStop,
  loadDraftRequest,
  onDraftChange,
  className,
}: {
  canUse: boolean;
  readOnly: boolean;
  sessionId: string | null | undefined;
  storedScenes: Partial<Record<SceneId, ConsoleSceneSnapshot>>;
  onRecallScene: (sceneId: SceneId) => void;
  onRundownStart: (count: number, sceneIds: string[]) => void;
  onRundownAdvance: (sceneId: SceneId, index: number) => void;
  onRundownComplete: () => void;
  onRundownStop: () => void;
  loadDraftRequest?: { items: AudioSceneRundownItem[]; name: string; token: number } | null;
  onDraftChange?: (items: AudioSceneRundownItem[], name: string) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState<AudioSceneRundownItem[]>([]);
  const [templates, setTemplates] = useState<AudioSceneRundownTemplate[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const timerRef = useRef<number | null>(null);
  const runningRef = useRef(false);

  const refreshTemplates = useCallback(async () => {
    if (!canUse) return;
    try {
      setTemplates(await fetchAudioSceneRundownTemplates(sessionId));
    } catch {
      /* offline */
    }
  }, [canUse, sessionId]);

  useEffect(() => {
    void refreshTemplates();
  }, [refreshTemplates]);

  useEffect(() => {
    if (!loadDraftRequest) return;
    setDraft(loadDraftRequest.items);
    setTemplateName(loadDraftRequest.name);
    setStatus(`Loaded "${loadDraftRequest.name}" from library.`);
  }, [loadDraftRequest?.token]);

  useEffect(() => {
    onDraftChange?.(draft, templateName.trim() || 'Scene rundown');
  }, [draft, templateName, onDraftChange]);

  const toggleScene = useCallback((sceneId: SceneId) => {
    setDraft((prev) => {
      const idx = prev.findIndex((i) => i.sceneId === sceneId);
      if (idx >= 0) return prev.filter((_, i) => i !== idx);
      return [...prev, { sceneId, holdSeconds: 3 }];
    });
  }, []);

  const stopRundown = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onRundownStop();
  }, [onRundownStop]);

  useEffect(() => () => stopRundown(), [stopRundown]);

  const playRundown = useCallback(() => {
    const err = validateRundownDraft(draft, storedScenes);
    if (err) {
      setStatus(err);
      return;
    }
    stopRundown();
    runningRef.current = true;
    setRunning(true);
    onRundownStart(draft.length, draft.map((item) => item.sceneId));

    const run = (index: number) => {
      if (!runningRef.current || index >= draft.length) {
        stopRundown();
        onRundownComplete();
        setStatus('Scene rundown complete.');
        return;
      }
      const item = draft[index];
      onRecallScene(item.sceneId);
      onRundownAdvance(item.sceneId, index);
      timerRef.current = window.setTimeout(() => run(index + 1), item.holdSeconds * 1000);
    };
    run(0);
    setStatus(`Rundown started — ${draft.length} scene(s).`);
  }, [draft, storedScenes, stopRundown, onRundownStart, onRecallScene, onRundownAdvance, onRundownComplete]);

  const handleSaveTemplate = useCallback(async () => {
    if (!templateName.trim()) {
      setStatus('Enter a rundown name.');
      return;
    }
    const err = validateRundownDraft(draft, storedScenes);
    if (err) {
      setStatus(err);
      return;
    }
    try {
      await saveAudioSceneRundownTemplate({
        sessionId,
        name: templateName.trim(),
        items: draft,
      });
      setTemplateName('');
      setStatus('Scene rundown saved.');
      await refreshTemplates();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Save failed.');
    }
  }, [templateName, draft, storedScenes, sessionId, refreshTemplates]);

  const loadTemplate = useCallback((template: AudioSceneRundownTemplate) => {
    setDraft(template.items);
    setStatus(`Loaded "${template.name}".`);
  }, []);

  if (!canUse) return null;

  return (
    <section className={cn('studiolive-enterprise-panel', className)}>
      <p className="studiolive-enterprise-panel__title flex items-center gap-1">
        <ListOrdered className="h-3 w-3" /> Scene rundown
      </p>
      <p className="studiolive-enterprise-panel__hint">Auto-recall stored scenes A–D with hold times.</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {SCENE_IDS.map((id) => (
          <button
            key={id}
            type="button"
            disabled={readOnly || !storedScenes[id]}
            className={cn('studiolive-enterprise-panel__btn', draft.some((d) => d.sceneId === id) && 'ring-1 ring-sky-400/50')}
            onClick={() => toggleScene(id)}
          >
            {id}
          </button>
        ))}
      </div>
      {draft.length > 0 && (
        <ul className="mt-2 space-y-1 text-[10px] text-sky-200/90">
          {draft.map((item, index) => (
            <li key={`${item.sceneId}-${index}`} className="flex items-center gap-2">
              <span>{index + 1}. Scene {item.sceneId}</span>
              <input
                type="number"
                min={1}
                max={120}
                value={item.holdSeconds}
                disabled={readOnly}
                onChange={(e) => {
                  const holdSeconds = Math.max(1, Number(e.target.value) || 3);
                  setDraft((prev) => prev.map((row, i) => (i === index ? { ...row, holdSeconds } : row)));
                }}
                className="w-12 rounded border border-white/10 bg-black px-1 py-0.5 text-[10px] outline-none"
              />
              <span>s hold</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex flex-wrap gap-1">
        <button type="button" disabled={readOnly || draft.length === 0 || running} className="studiolive-enterprise-panel__btn" onClick={playRundown}>
          <Play className="h-3 w-3" /> PLAY
        </button>
        {running && (
          <button type="button" className="studiolive-enterprise-panel__btn" onClick={stopRundown}>
            <Square className="h-3 w-3" /> STOP
          </button>
        )}
        <button type="button" disabled={readOnly || draft.length === 0} className="studiolive-enterprise-panel__btn" onClick={() => setDraft([])}>
          CLEAR
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <input
          type="text"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          placeholder="Rundown name"
          className="min-w-0 flex-1 rounded border border-white/10 bg-black px-2 py-1 text-[10px] outline-none"
        />
        <button type="button" disabled={readOnly} className="studiolive-enterprise-panel__btn" onClick={() => { void handleSaveTemplate(); }}>
          <Save className="h-3 w-3" /> SAVE
        </button>
      </div>
      {templates.length > 0 && (
        <ul className="mt-2 max-h-16 space-y-1 overflow-y-auto text-[10px]">
          {templates.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 text-sky-200/90">
              <button type="button" className="truncate text-left hover:text-white" onClick={() => loadTemplate(t)}>
                {t.name} ({t.items.length})
              </button>
              <button type="button" disabled={readOnly} className="text-mixer-red" onClick={() => { void deleteAudioSceneRundownTemplate(t.id).then(refreshTemplates); }}>
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

export function AudioSceneDiffPanel({
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

  const available = useMemo(
    () => SCENE_OPTIONS.filter((id) => Boolean(storedScenes[id])),
    [storedScenes],
  );

  const summary = useMemo(() => {
    const snapA = storedScenes[sceneA];
    const snapB = storedScenes[sceneB];
    if (!snapA || !snapB || sceneA === sceneB) return null;
    return diffSceneSnapshots(sceneA, snapA, sceneB, snapB);
  }, [storedScenes, sceneA, sceneB]);

  if (!canUse) return null;

  return (
    <section className={cn('studiolive-enterprise-panel', className)}>
      <p className="studiolive-enterprise-panel__title">Scene diff export</p>
      {available.length < 2 ? (
        <p className="studiolive-enterprise-panel__hint">Store at least two scenes (Shift+A–D) to compare.</p>
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
                {summary.rows.length} channel change(s) · master {summary.masterVolumeFrom}% → {summary.masterVolumeTo}%
              </p>
              <div className="studiolive-enterprise-panel__actions">
                <button
                  type="button"
                  className="studiolive-enterprise-panel__btn"
                  onClick={() => {
                    downloadSceneDiffCsv(buildSceneDiffCsv(summary), `scene-diff-${sceneA}-${sceneB}.csv`);
                    onExport?.();
                  }}
                >
                  <Download className="h-3 w-3" /> CSV
                </button>
                <button
                  type="button"
                  className="studiolive-enterprise-panel__btn"
                  onClick={() => {
                    downloadSceneDiffJson(buildSceneDiffJson(summary), `scene-diff-${sceneA}-${sceneB}.json`);
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
