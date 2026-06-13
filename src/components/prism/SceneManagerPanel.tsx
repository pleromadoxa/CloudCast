import { useCallback, useEffect, useState } from 'react';
import { FolderOpen, Loader2, Save, Trash2 } from 'lucide-react';
import {
  listPrismScenes,
  savePrismScene,
  deletePrismScene,
} from '../../lib/prism/prismSceneService';
import type { PrismLowerThird, PrismSceneObject, PrismSceneRecord } from '../../types/prismFeed';
import type { ChromaKeySettings } from '../../lib/prism/chromaKey';
import type { PrismProductionMode } from '../../lib/prism/virtualSets';
import type { PrismNodeGraph } from '../../lib/prism/nodeGraph';
import type { PrismSecondarySlot } from '../../types/prismCameras';
import { prismCloudScenesForPlan } from '../../config/products';
import type { PlanTier } from '../../types/plans';

interface SceneManagerPanelProps {
  planId: PlanTier;
  virtualSetId: string;
  mode: PrismProductionMode;
  keySettings: ChromaKeySettings;
  cameraYaw: number;
  cameraPitch: number;
  cameraZoom: number;
  showShadows: boolean;
  showReflections: boolean;
  nodeGraph: PrismNodeGraph;
  secondarySlots: PrismSecondarySlot[];
  lowerThird: PrismLowerThird;
  sceneObjects: PrismSceneObject[];
  onLoad: (scene: PrismSceneRecord) => void;
}

export function SceneManagerPanel({
  planId,
  virtualSetId,
  mode,
  keySettings,
  cameraYaw,
  cameraPitch,
  cameraZoom,
  showShadows,
  showReflections,
  nodeGraph,
  secondarySlots,
  lowerThird,
  sceneObjects,
  onLoad,
}: SceneManagerPanelProps) {
  const quota = prismCloudScenesForPlan(planId);
  const [scenes, setScenes] = useState<PrismSceneRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setScenes(await listPrismScenes());
    } catch {
      setScenes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSave = async () => {
    if (!name.trim()) return;
    if (scenes.length >= quota) {
      setError(`Plan limit: ${quota} cloud scene${quota === 1 ? '' : 's'}`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await savePrismScene({
        name: name.trim(),
        virtualSetId,
        mode,
        keySettings,
        cameraYaw,
        cameraPitch,
        cameraZoom,
        showShadows,
        showReflections,
        extendedState: {
          nodeGraph,
          secondarySlots,
          lowerThird,
          sceneObjects,
        },
      });
      setName('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePrismScene(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-mixer-muted">
        {scenes.length}/{quota} cloud scenes · saves pipeline, PiP, graphics, and 3D props
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Scene name"
          className="min-w-0 flex-1 rounded border border-white/10 bg-black px-2 py-1.5 text-xs outline-none focus:border-amber-500/40"
        />
        <button
          type="button"
          disabled={saving || !name.trim() || scenes.length >= quota}
          onClick={() => void handleSave()}
          className="inline-flex items-center gap-1 rounded bg-amber-500 px-2 py-1.5 text-[10px] font-bold tracking-wider text-black hover:bg-amber-400 disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          SAVE
        </button>
      </div>
      {error && <p className="text-[10px] text-mixer-red">{error}</p>}
      {loading ? (
        <Loader2 className="mx-auto h-4 w-4 animate-spin text-amber-400" />
      ) : scenes.length === 0 ? (
        <p className="text-[10px] text-mixer-muted">No saved scenes yet.</p>
      ) : (
        <ul className="max-h-48 space-y-1 overflow-y-auto">
          {scenes.map((scene) => (
            <li
              key={scene.id}
              className="flex items-center gap-1 rounded border border-white/10 bg-black/40 px-2 py-1.5"
            >
              <button
                type="button"
                onClick={() => onLoad(scene)}
                className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs hover:text-amber-300"
              >
                <FolderOpen className="h-3 w-3 shrink-0 text-amber-500" />
                <span className="truncate">{scene.name}</span>
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(scene.id)}
                className="shrink-0 p-0.5 text-mixer-muted hover:text-mixer-red"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
