import { memo, useMemo } from 'react';
import type {
  StudioProductionMode,
  StudioScreenSource,
  StudioTalentPlacement,
} from '../../lib/virtualStudio/types';
import { getStudioScene } from '../../lib/virtualStudio/sceneRegistry';
import { resolveSlotSource } from '../../lib/virtualStudio/screenSources';
import { TalentPlane } from './TalentPlane';
import { ElementsLayer, type PlacedElementLike } from './ElementsLayer';
import { ArLivePlate, XrSetExtension } from './ModeStages';
import { ImportedModelGroup, type ImportedModelEntry } from '../prism/ImportedModelGroup';
import { ProceduralModelGroup } from '../prism/ProceduralModelGroup';
import type { PrismSceneObject } from '../../types/prismFeed';
import { sceneComponentFor } from './scenes/sceneComponentMap';
import { CycloramaScene } from './scenes/StudioScenes';

/** Dev-only guard: each unmapped scene warns exactly once per session. */
const warnedUnmapped = new Set<string>();

export interface StudioSceneRendererProps {
  sceneId: string;
  /** Compositing mode — VS shows the set, AR a live plate, XR an LED volume. */
  mode?: StudioProductionMode;
  /** Operator bindings keyed by slot id — win over scene defaults. */
  bindings?: Record<string, StudioScreenSource>;
  /** Full-scene replacement plate (image or live feed). */
  backdrop?: StudioScreenSource;
  tickerSpeed?: number;
  /** Keyed/raw talent composite. */
  talent?: {
    keyedCanvas: HTMLCanvasElement | null;
    rawVideo: HTMLVideoElement | null;
    keyerEnabled?: boolean;
    showReflections?: boolean;
    enabled?: boolean;
    /** Operator placement override — wins over the scene default. */
    placement?: Partial<StudioTalentPlacement>;
  };
  /** Render the set itself (pipeline `virtual_set` node). Talent still shows. */
  visible?: boolean;
  /** Override the scene accent (tints the XR set-extension). */
  accent?: string;
  /** Operator-placed set dressing (plants, furniture, screens…). */
  elements?: PlacedElementLike[];
  /** Imported glTF models from the 3D library. */
  importedModels?: ImportedModelEntry[];
  /** Procedural catalog objects from the 3D model library. */
  sceneObjects?: PrismSceneObject[];
  selectedElementId?: string | null;
  /** Snap element drags to a 0.25 m floor grid. */
  snapToGrid?: boolean;
  onSelectElement?: (id: string | null) => void;
  onMoveElement?: (id: string, position: [number, number]) => void;
  onRotateElement?: (id: string, rotation: number) => void;
  onScaleElement?: (id: string, scale: [number, number, number]) => void;
  onElevateElement?: (id: string, elevation: number) => void;
}

export const StudioSceneRenderer = memo(function StudioSceneRenderer({
  sceneId,
  mode = 'virtual_studio',
  bindings = {},
  backdrop,
  tickerSpeed,
  talent,
  visible = true,
  accent,
  elements = [],
  importedModels = [],
  sceneObjects = [],
  selectedElementId,
  snapToGrid,
  onSelectElement,
  onMoveElement,
  onRotateElement,
  onScaleElement,
  onElevateElement,
}: StudioSceneRendererProps) {
  const definition = getStudioScene(sceneId);
  const isAr = mode === 'augmented_reality';
  const isXr = mode === 'xr_extension';

  const sources = useMemo(() => {
    const resolved: Record<string, StudioScreenSource> = {};
    for (const screen of definition?.screens ?? []) {
      resolved[screen.id] = resolveSlotSource({ sources: bindings }, screen.id, screen.defaultSource);
    }
    return resolved;
  }, [definition, bindings]);

  const resolvedBackdrop = useMemo(() => {
    if (backdrop) return backdrop;
    const bound = bindings.backdrop;
    if (bound) return bound;
    return { kind: 'off' } as StudioScreenSource;
  }, [backdrop, bindings]);

  const mappedComponent = sceneComponentFor(sceneId);
  if (!mappedComponent && import.meta.env.DEV && !warnedUnmapped.has(sceneId)) {
    // Unmapped registry id — the set silently degrades to the blank cyclorama.
    warnedUnmapped.add(sceneId);
    console.warn(`[StudioSceneRenderer] scene "${sceneId}" has no mapped component`);
  }
  const SceneComponent = mappedComponent ?? CycloramaScene;
  const placement: StudioTalentPlacement | undefined = definition?.talent
    ? {
        ...definition.talent,
        ...talent?.placement,
        position: talent?.placement?.position ?? definition.talent.position,
      }
    : talent?.placement?.position
      ? (talent.placement as StudioTalentPlacement)
      : undefined;
  const xrAccent = accent ?? definition?.accent ?? '#6366f1';

  return (
    <>
      {/* ── environment ───────────────────────────────────────────────── */}
      {isAr ? (
        /* AR back plate: the live feed locked behind every graphic. Not gated by
           the virtual-set node — the camera is the environment itself. */
        <ArLivePlate video={talent?.rawVideo ?? null} />
      ) : (
        visible && (
          <>
            <SceneComponent sources={sources} backdrop={resolvedBackdrop} tickerSpeed={tickerSpeed} />
            {isXr && <XrSetExtension accent={xrAccent} />}
          </>
        )
      )}

      {/* ── talent front plate (AR talent already lives in the feed) ───── */}
      {!isAr && talent?.enabled !== false && placement && (
        <TalentPlane
          keyedCanvas={talent?.keyedCanvas ?? null}
          rawVideo={talent?.rawVideo ?? null}
          keyerEnabled={talent?.keyerEnabled ?? true}
          position={placement.position}
          width={placement.width ?? 2.4}
          yaw={placement.yaw ?? 0}
          pitch={placement.pitch ?? 0}
          roll={placement.roll ?? 0}
          pose={placement.pose ?? 'standing'}
          reflection={(talent?.showReflections ?? true) && !isAr}
        />
      )}

      {/* ── 3D model library content (parity with the classic stage) ───── */}
      {importedModels.length > 0 && <ImportedModelGroup models={importedModels} />}
      {sceneObjects.length > 0 && <ProceduralModelGroup objects={sceneObjects} />}

      {/* ── operator-placed set dressing / augmented graphics ─────────── */}
      {visible && elements.length > 0 && onMoveElement && onSelectElement && onRotateElement && (
        <ElementsLayer
          elements={elements}
          selectedId={selectedElementId}
          snapToGrid={snapToGrid}
          onSelect={onSelectElement}
          onMove={onMoveElement}
          onRotate={onRotateElement}
          onScale={onScaleElement ?? (() => undefined)}
          onElevate={onElevateElement ?? (() => undefined)}
        />
      )}
    </>
  );
});
