import { useCallback, useMemo, useRef, useState } from 'react';
import { Box, Image, Layers, Move3D, Search, Trash2, Upload } from 'lucide-react';
import {
  PRISM_MODEL_CATEGORIES,
  catalogCountForPlan,
  createSceneObject,
  getCatalogEntry,
  modelsForPlan,
  type PrismModelCategory,
} from '../../lib/prism/modelCatalog';
import { bundlesForPlan, instantiateBundle, type PrismSceneBundle } from '../../lib/prism/sceneBundles';
import type { VirtualSetDefinition } from '../../lib/prism/virtualSets';
import type { PrismProductionMode } from '../../lib/prism/virtualSets';
import type { PrismSceneObject } from '../../types/prismFeed';
import { SceneSelector } from './SceneSelector';
import { validateGltfFile, type ImportedModelEntry } from './ImportedModelGroup';
import { cn } from '../../lib/utils';
import type { PlanTier } from '../../types/plans';

interface ModelLibraryPanelProps {
  planId: PlanTier | string;
  virtualSets: VirtualSetDefinition[];
  selectedVirtualSetId: string;
  lockedVirtualSetIds: Set<string>;
  productionMode: PrismProductionMode;
  canUseAr: boolean;
  onSelectVirtualSet: (id: string) => void;
  onSelectProductionMode: (mode: PrismProductionMode) => void;
  sceneObjects: PrismSceneObject[];
  importedModels: ImportedModelEntry[];
  onAddObject: (obj: PrismSceneObject) => void;
  onUpdateObject: (id: string, patch: Partial<PrismSceneObject>) => void;
  onRemoveObject: (id: string) => void;
  onSetObjects: (objects: PrismSceneObject[]) => void;
  onLoadBundle: (bundle: PrismSceneBundle, objects: PrismSceneObject[]) => void;
  onAddImport: (entry: ImportedModelEntry) => void;
  onUpdateImport: (id: string, patch: Partial<ImportedModelEntry>) => void;
  onRemoveImport: (id: string) => void;
  canImportGltf?: boolean;
}

type Tab = 'backgrounds' | 'sets' | 'objects' | 'scene' | 'import';

function TransformSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-[10px]">
      <span className="text-mixer-muted">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-0.5 w-full accent-amber-500"
      />
      <span className="text-[9px] text-amber-300/80">{value.toFixed(2)}</span>
    </label>
  );
}

export function ModelLibraryPanel({
  planId,
  virtualSets,
  selectedVirtualSetId,
  lockedVirtualSetIds,
  productionMode,
  canUseAr,
  onSelectVirtualSet,
  onSelectProductionMode,
  sceneObjects,
  importedModels,
  onAddObject,
  onUpdateObject,
  onRemoveObject,
  onSetObjects,
  onLoadBundle,
  onAddImport,
  onUpdateImport: _onUpdateImport,
  onRemoveImport,
  canImportGltf = false,
}: ModelLibraryPanelProps) {
  const [tab, setTab] = useState<Tab>('sets');
  const [category, setCategory] = useState<PrismModelCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadFeedback, setLoadFeedback] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const catalog = useMemo(() => modelsForPlan(planId), [planId]);
  const bundles = useMemo(() => bundlesForPlan(planId), [planId]);
  const totalAvailable = catalogCountForPlan(planId);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((m) => {
      if (category !== 'all' && m.category !== category) return false;
      if (!q) return true;
      return m.name.toLowerCase().includes(q) || m.tags.some((t) => t.includes(q));
    });
  }, [catalog, category, query]);

  const selected = sceneObjects.find((o) => o.id === selectedId) ?? null;
  const selectedMeta = selected ? getCatalogEntry(selected.catalogId) : null;

  const handleImport = (file: File) => {
    if (!validateGltfFile(file)) return;
    const url = URL.createObjectURL(file);
    onAddImport({
      id: crypto.randomUUID(),
      name: file.name.replace(/\.(glb|gltf)$/i, ''),
      url,
      position: [0.8, 0, -0.5],
      rotation: [0, 0, 0],
      scale: 0.5,
    });
  };

  const handleLoadBundle = useCallback(
    (bundle: PrismSceneBundle) => {
      try {
        const objects = instantiateBundle(bundle);
        onLoadBundle(bundle, objects);
        setSelectedId(objects[0]?.id ?? null);
        setTab('scene');
        setLoadFeedback(`Loaded ${objects.length} props · ${bundle.name}`);
        window.setTimeout(() => setLoadFeedback(null), 3500);
      } catch (err) {
        setLoadFeedback(err instanceof Error ? err.message : 'Failed to load set');
      }
    },
    [onLoadBundle],
  );

  const tabs: { id: Tab; label: string; icon: typeof Box }[] = [
    { id: 'backgrounds', label: '3D Backgrounds', icon: Image },
    { id: 'sets', label: '3D Sets', icon: Layers },
    { id: 'objects', label: '3D Objects', icon: Box },
    { id: 'scene', label: 'In Scene', icon: Move3D },
    { id: 'import', label: 'Import', icon: Upload },
  ];

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <p className="text-[10px] text-mixer-muted">
        Photorealistic studio library · {totalAvailable} objects · {bundles.length} ready sets · drag viewport to orbit
      </p>
      {loadFeedback && (
        <p className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-200">
          {loadFeedback}
        </p>
      )}

      <div className="flex flex-wrap gap-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'inline-flex items-center gap-1 rounded px-2 py-1 text-[9px] font-bold tracking-wider',
              tab === id ? 'bg-amber-500/20 text-amber-300' : 'border border-white/10 text-mixer-muted hover:text-white',
            )}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'backgrounds' && (
        <div className="space-y-3">
          <p className="text-[10px] leading-relaxed text-mixer-muted">
            Photorealistic room shells with PBR walls, floors, recessed lighting, and reflections — Aximetry-style virtual backgrounds.
          </p>
          <div className="flex gap-1">
            {(['virtual_studio', 'augmented_reality', 'xr_extension'] as PrismProductionMode[]).map((m) => (
              <button
                key={m}
                type="button"
                disabled={m !== 'virtual_studio' && !canUseAr}
                onClick={() => onSelectProductionMode(m)}
                className={cn(
                  'flex-1 rounded px-1 py-1 text-[9px] font-bold tracking-wider',
                  productionMode === m ? 'bg-amber-500/20 text-amber-300' : 'text-mixer-muted hover:text-white',
                  m !== 'virtual_studio' && !canUseAr && 'opacity-40',
                )}
              >
                {m === 'virtual_studio' ? 'VS' : m === 'augmented_reality' ? 'AR' : 'XR'}
              </button>
            ))}
          </div>
          <SceneSelector
            sets={virtualSets}
            selectedId={selectedVirtualSetId}
            onSelect={onSelectVirtualSet}
            lockedIds={lockedVirtualSetIds}
          />
        </div>
      )}

      {tab === 'sets' && (
        <div className="space-y-2 overflow-y-auto pr-1">
          {bundles.map((bundle) => (
            <div key={bundle.id} className="rounded border border-white/10 bg-black/30 p-2">
              <p className="text-xs font-semibold text-white">{bundle.name}</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-mixer-muted">{bundle.description}</p>
              <p className="mt-1 text-[9px] text-amber-400/80">{bundle.objects.length} photoreal props · {bundle.virtualSetId.replace(/_/g, ' ')}</p>
              <button
                type="button"
                onClick={() => handleLoadBundle(bundle)}
                className="mt-2 w-full rounded bg-amber-500/90 py-1.5 text-[10px] font-bold tracking-wider text-black hover:bg-amber-400"
              >
                LOAD SET
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'objects' && (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-mixer-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search couches, TVs, fans, mats, decals…"
              className="w-full rounded border border-white/10 bg-black/40 py-1.5 pl-7 pr-2 text-[10px] text-white placeholder:text-mixer-muted"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setCategory('all')}
              className={cn(
                'rounded px-2 py-0.5 text-[9px] font-bold',
                category === 'all' ? 'bg-amber-500/20 text-amber-300' : 'text-mixer-muted hover:text-white',
              )}
            >
              All
            </button>
            {PRISM_MODEL_CATEGORIES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setCategory(id)}
                className={cn(
                  'rounded px-2 py-0.5 text-[9px] font-bold',
                  category === id ? 'bg-amber-500/20 text-amber-300' : 'text-mixer-muted hover:text-white',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="max-h-[280px] space-y-1 overflow-y-auto pr-1">
            {filtered.slice(0, 80).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  const obj = createSceneObject(item.id);
                  if (obj) {
                    onAddObject(obj);
                    setSelectedId(obj.id);
                    setTab('scene');
                  }
                }}
                className="flex w-full items-center justify-between rounded border border-white/10 px-2 py-1.5 text-left text-[10px] hover:border-amber-500/30 hover:bg-amber-500/5"
              >
                <span className="truncate text-white">{item.name}</span>
                <span className="ml-2 shrink-0 text-[9px] uppercase text-mixer-muted">{item.category.slice(0, 4)}</span>
              </button>
            ))}
            {filtered.length > 80 && (
              <p className="py-1 text-center text-[9px] text-mixer-muted">Refine search to see more ({filtered.length} matches)</p>
            )}
          </div>
        </>
      )}

      {tab === 'scene' && (
        <div className="space-y-2">
          {sceneObjects.length === 0 ? (
            <p className="text-[10px] text-mixer-muted">Load a photoreal set or add props from 3D Objects. Drag the viewport to orbit the camera.</p>
          ) : (
            <>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onSetObjects([])}
                  className="rounded border border-mixer-red/40 px-2 py-1 text-[9px] font-bold text-mixer-red hover:bg-mixer-red/10"
                >
                  CLEAR ALL
                </button>
              </div>
              <ul className="max-h-[140px] space-y-1 overflow-y-auto pr-1">
                {sceneObjects.map((o) => {
                  const meta = getCatalogEntry(o.catalogId);
                  return (
                    <li key={o.id} className="flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-xs">
                      <button
                        type="button"
                        onClick={() => setSelectedId(o.id === selectedId ? null : o.id)}
                        className={cn(
                          'flex min-w-0 flex-1 truncate text-left text-[10px]',
                          selectedId === o.id ? 'text-amber-300' : 'hover:text-white',
                        )}
                      >
                        {meta?.name ?? o.catalogId}
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveObject(o.id)}
                        className="text-mixer-red hover:text-red-300"
                        aria-label="Remove"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {selected && selectedMeta && (
            <div className="space-y-2 rounded border border-amber-500/25 bg-black/40 p-2">
              <p className="text-[10px] font-bold tracking-wider text-amber-300">TRANSFORM · {selectedMeta.name}</p>
              <TransformSlider
                label="Pos X"
                value={selected.position[0]}
                min={-5}
                max={5}
                step={0.05}
                onChange={(v) => onUpdateObject(selected.id, { position: [v, selected.position[1], selected.position[2]] })}
              />
              <TransformSlider
                label="Pos Y"
                value={selected.position[1]}
                min={-2}
                max={3}
                step={0.05}
                onChange={(v) => onUpdateObject(selected.id, { position: [selected.position[0], v, selected.position[2]] })}
              />
              <TransformSlider
                label="Pos Z"
                value={selected.position[2]}
                min={-5}
                max={3}
                step={0.05}
                onChange={(v) => onUpdateObject(selected.id, { position: [selected.position[0], selected.position[1], v] })}
              />
              <TransformSlider
                label="Rotate Y"
                value={selected.rotation[1]}
                min={-Math.PI}
                max={Math.PI}
                step={0.05}
                onChange={(v) => onUpdateObject(selected.id, { rotation: [selected.rotation[0], v, selected.rotation[2]] })}
              />
              <TransformSlider
                label="Scale"
                value={selected.scale}
                min={0.1}
                max={3}
                step={0.05}
                onChange={(v) => onUpdateObject(selected.id, { scale: v })}
              />
            </div>
          )}
        </div>
      )}

      {tab === 'import' && (
        <div className="space-y-3">
          <button
            type="button"
            disabled={!canImportGltf}
            onClick={() => importRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded border border-dashed border-amber-500/40 py-3 text-[10px] font-bold tracking-wider text-amber-300 hover:bg-amber-500/10 disabled:opacity-40"
          >
            <Upload className="h-3.5 w-3.5" />
            IMPORT GLTF / GLB
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImport(file);
              e.target.value = '';
            }}
          />
          {!canImportGltf && (
            <p className="text-[10px] text-mixer-muted">Custom GLB import unlocks on Pro Master. Use the built-in library on all paid plans.</p>
          )}
          {importedModels.length > 0 && (
            <ul className="space-y-1">
              {importedModels.map((m) => (
                <li key={m.id} className="flex items-center justify-between rounded border border-white/10 px-2 py-1 text-[10px]">
                  <span className="truncate">{m.name}</span>
                  <button type="button" onClick={() => onRemoveImport(m.id)} className="text-mixer-red hover:underline">
                    REMOVE
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}