import { memo, useMemo, type ComponentProps, type CSSProperties } from 'react';
import type {
  StudioCameraPreset,
  StudioEffectOverrides,
  StudioPlacedElement,
  StudioProductionMode,
  StudioScreenSource,
  StudioTransitionSettings,
} from '../../lib/virtualStudio/types';
import { defaultPhotorealState } from '../../lib/virtualStudio/types';
import { getStudioScene, STUDIO_SCENES } from '../../lib/virtualStudio/sceneRegistry';
import type { StudioQualityTier } from '../../lib/virtualStudio/quality';
import type { ImportedModelEntry } from '../prism/ImportedModelGroup';
import type { PrismSceneObject } from '../../types/prismFeed';
import { StudioStage } from './StudioStage';
import { StudioSceneRenderer } from './StudioSceneRenderer';

/**
 * One-stop photoreal stage: picks the scene definition off the registry,
 * wires camera, talent, screen bindings and the render pipeline together.
 * This is the component Prism mounts in place of the classic virtual scene.
 */
export interface VirtualStudioStageProps {
  sceneId: string;
  /**
   * Compositing mode (VS / AR / XR). The stage adapts its canvas, lens and
   * environment so AR layers over a live plate and XR opens an LED volume.
   */
  mode?: StudioProductionMode;
  camera?: StudioCameraPreset;
  onCameraChange?: (patch: Partial<StudioCameraPreset>) => void;
  /** Transition style for recalled shots (jib sweep, whip, crane…). */
  transition?: StudioTransitionSettings;
  bindings?: Record<string, StudioScreenSource>;
  backdrop?: StudioScreenSource;
  tickerSpeed?: number;
  lighting?: number;
  /** Colour temperature across the rig: 0 cool – 0.5 balanced – 1 warm. */
  temperature?: number;
  /** Extra exposure multiplier on top of the scene bias (0.6 – 1.6). */
  exposure?: number;
  /** Override the scene accent colour. */
  accent?: string;
  /** Per-effect overrides on top of the quality preset. */
  effects?: StudioEffectOverrides;
  /** Operator-placed set dressing. */
  elements?: StudioPlacedElement[];
  /** Imported glTF models from the 3D library (parity with the classic stage). */
  importedModels?: ImportedModelEntry[];
  /** Procedural catalog objects placed from the 3D model library. */
  sceneObjects?: PrismSceneObject[];
  selectedElementId?: string | null;
  snapToGrid?: boolean;
  onSelectElement?: (id: string | null) => void;
  onMoveElement?: (id: string, position: [number, number]) => void;
  onRotateElement?: (id: string, rotation: number) => void;
  onScaleElement?: (id: string, scale: [number, number, number]) => void;
  onElevateElement?: (id: string, elevation: number) => void;
  quality?: StudioQualityTier | 'auto';
  /** Shadow toggle (studio `showShadows`). */
  shadows?: boolean;
  /** Render the set itself (pipeline `virtual_set` node enabled). */
  visible?: boolean;
  interactive?: boolean;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  talent?: StudioSceneRendererProps['talent'];
  className?: string;
  style?: CSSProperties;
}

type StudioSceneRendererProps = ComponentProps<typeof StudioSceneRenderer>;

export const VirtualStudioStage = memo(function VirtualStudioStage({
  sceneId,
  mode = 'virtual_studio',
  camera,
  onCameraChange,
  transition,
  bindings,
  backdrop,
  tickerSpeed,
  lighting,
  temperature,
  exposure,
  accent,
  effects,
  elements,
  importedModels,
  sceneObjects,
  selectedElementId,
  snapToGrid,
  onSelectElement,
  onMoveElement,
  onRotateElement,
  onScaleElement,
  onElevateElement,
  quality = 'auto',
  shadows,
  visible = true,
  interactive = true,
  onCanvasReady,
  talent,
  className,
  style,
}: VirtualStudioStageProps) {
  const scene = useMemo(
    () => getStudioScene(sceneId) ?? getStudioScene('cyclorama') ?? STUDIO_SCENES[0],
    [sceneId],
  );

  return (
    <StudioStage
      scene={scene}
      mode={mode}
      camera={camera ?? scene.camera}
      onCameraChange={onCameraChange}
      transition={transition}
      quality={quality}
      lighting={lighting ?? defaultPhotorealState().lighting}
      temperature={temperature}
      exposure={exposure}
      accent={accent}
      effects={effects}
      shadows={shadows}
      interactive={interactive}
      onCanvasReady={onCanvasReady}
      className={className}
      style={style}
    >
      <StudioSceneRenderer
        sceneId={scene.id}
        mode={mode}
        bindings={bindings}
        backdrop={backdrop}
        tickerSpeed={tickerSpeed}
        talent={talent}
        visible={visible}
        accent={accent}
        elements={elements}
        importedModels={importedModels}
        sceneObjects={sceneObjects}
        selectedElementId={selectedElementId}
        snapToGrid={snapToGrid}
        onSelectElement={onSelectElement}
        onMoveElement={onMoveElement}
        onRotateElement={onRotateElement}
        onScaleElement={onScaleElement}
        onElevateElement={onElevateElement}
      />
    </StudioStage>
  );
});
