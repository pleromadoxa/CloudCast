import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import { DEFAULT_KEY_SETTINGS, type ChromaKeySettings } from '../lib/prism/chromaKey';
import { PrismOutputCapture } from '../lib/prism/prismOutputCapture';
import type { ImportedModelEntry } from '../components/prism/ImportedModelGroup';
import type { PrismProductionMode } from '../lib/prism/virtualSets';
import { createDefaultPrismFeedState, type PrismFeedState, type PrismLowerThird, type PrismSceneObject } from '../types/prismFeed';
import { DEFAULT_NODE_GRAPH, type PrismNodeGraph, toggleNode, type PrismNodeId, pipelineNode } from '../lib/prism/nodeGraph';
import type { PrismMotionState } from '../lib/prism/motionGraphics';
import { DEFAULT_SECONDARY_SLOTS, type PrismSecondarySlot } from '../types/prismCameras';
import type { PrismPipOverlay, PrismMotionOverlay } from '../lib/prism/prismOutputCapture';
import { defaultPhotorealState, type PhotorealStudioState } from '../lib/virtualStudio/types';

/** Which renderer draws the main viewport. */
export type PrismRenderEngine = 'classic' | 'photoreal';

export interface PrismStudioState {
  virtualSetId: string;
  mode: PrismProductionMode;
  keySettings: ChromaKeySettings;
  cameraYaw: number;
  cameraPitch: number;
  cameraZoom: number;
  /** Free-camera look-at point — panning flies the camera anywhere in the set. */
  cameraTarget?: [number, number, number];
  /** Lens field of view in degrees (camera deck lens buttons). */
  cameraFov?: number;
  showShadows: boolean;
  showReflections: boolean;
  importedModels: ImportedModelEntry[];
  sceneObjects: PrismSceneObject[];
  cameraActive: boolean;
  nodeGraph: PrismNodeGraph;
  secondarySlots: PrismSecondarySlot[];
  /** Renderer used for the viewport: classic sets or photoreal studio. */
  renderEngine: PrismRenderEngine;
  /** Photoreal studio scene, screen bindings and look controls. */
  photoreal: PhotorealStudioState;
}

interface PrismFeedContextValue {
  state: PrismFeedState;
  studio: PrismStudioState;
  programStream: MediaStream | null;
  isLive: boolean;
  patchState: (partial: Partial<PrismFeedState>) => void;
  patchStudio: (partial: Partial<PrismStudioState>) => void;
  setKeySettings: (settings: ChromaKeySettings) => void;
  setLowerThird: (partial: Partial<PrismLowerThird>) => void;
  setMotion: (partial: Partial<PrismMotionState>) => void;
  attachGlCanvas: (canvas: HTMLCanvasElement | HTMLVideoElement | null) => void;
  goLive: () => void;
  stopLive: () => void;
  refreshCapture: () => void;
  togglePipelineNode: (id: PrismNodeId) => void;
  setSecondarySlots: (slots: PrismSecondarySlot[]) => void;
  getPipOverlaysRef: MutableRefObject<() => PrismPipOverlay[]>;
  /** Latest 3D motion graphics canvas, composited over the program output. */
  getMotionOverlayRef: MutableRefObject<() => PrismMotionOverlay | null>;
  /** Latest WebGPU backdrop plate, composited under the motion graphics. */
  getMotionBackdropRef: MutableRefObject<() => PrismMotionOverlay | null>;
}

const defaultStudio = (): PrismStudioState => ({
  virtualSetId: 'news_studio',
  mode: 'virtual_studio',
  keySettings: { ...DEFAULT_KEY_SETTINGS },
  cameraYaw: 0,
  cameraPitch: 0.15,
  cameraZoom: 1,
  showShadows: true,
  showReflections: true,
  importedModels: [],
  sceneObjects: [],
  cameraActive: false,
  nodeGraph: DEFAULT_NODE_GRAPH,
  secondarySlots: DEFAULT_SECONDARY_SLOTS.map((s) => ({ ...s })),
  // Default to the production 3D engine so VS/AR/XR open as a full photoreal
  // stage (filmic rendering, PBR sets, adaptive quality) rather than the flat
  // classic backdrop. Classic remains available via the sets panel.
  renderEngine: 'photoreal',
  photoreal: defaultPhotorealState(),
});

const PrismFeedContext = createContext<PrismFeedContextValue | null>(null);

export function PrismFeedProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PrismFeedState>(() => createDefaultPrismFeedState());
  const [studio, setStudio] = useState<PrismStudioState>(() => defaultStudio());
  const [programStream, setProgramStream] = useState<MediaStream | null>(null);
  const [isLive, setIsLive] = useState(false);
  const captureRef = useRef<PrismOutputCapture | null>(null);
  const glCanvasRef = useRef<HTMLCanvasElement | HTMLVideoElement | null>(null);
  const stateRef = useRef(state);
  const studioRef = useRef(studio);
  const pipOverlaysRef = useRef<() => PrismPipOverlay[]>(() => []);
  const motionOverlayRef = useRef<() => PrismMotionOverlay | null>(() => null);
  const motionBackdropRef = useRef<() => PrismMotionOverlay | null>(() => null);

  // Latest-value refs for capture callbacks — updated after commit, never
  // during render (so captures always read the committed state).
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    studioRef.current = studio;
  }, [studio]);

  const patchState = useCallback((partial: Partial<PrismFeedState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const patchStudio = useCallback((partial: Partial<PrismStudioState>) => {
    setStudio((prev) => ({ ...prev, ...partial }));
  }, []);

  const setKeySettings = useCallback((keySettings: ChromaKeySettings) => {
    setStudio((prev) => ({ ...prev, keySettings }));
    setState((prev) => ({ ...prev, keySettings }));
  }, []);

  const setLowerThird = useCallback((partial: Partial<PrismLowerThird>) => {
    setState((prev) => ({
      ...prev,
      lowerThird: { ...prev.lowerThird, ...partial },
    }));
  }, []);

  const setMotion = useCallback((partial: Partial<PrismMotionState>) => {
    setState((prev) => ({
      ...prev,
      motion: { ...prev.motion, ...partial },
    }));
  }, []);

  const startCapture = useCallback(() => {
    const canvas = glCanvasRef.current;
    if (!canvas) return;
    captureRef.current?.stop();
    const { captureWidth, captureHeight } = stateRef.current;
    const capture = new PrismOutputCapture(captureWidth, captureHeight);
    const stream = capture.start(canvas, {
      getOverlay: () => ({
        watermark: stateRef.current.showWatermark,
        lowerThird: pipelineNode(studioRef.current.nodeGraph, 'graphics').enabled
          ? stateRef.current.lowerThird
          : null,
        pipOverlays: pipelineNode(studioRef.current.nodeGraph, 'pip').enabled
          ? pipOverlaysRef.current()
          : [],
        // 3D motion graphics composite above the set but below the watermark,
        // with the WebGPU backdrop plate underneath them.
        motionBackdrop: pipelineNode(studioRef.current.nodeGraph, 'motion').enabled
          ? motionBackdropRef.current()
          : null,
        motion: pipelineNode(studioRef.current.nodeGraph, 'motion').enabled
          ? motionOverlayRef.current()
          : null,
      }),
    });
    captureRef.current = capture;
    setProgramStream(stream);
  }, []);

  const refreshCapture = useCallback(() => {
    if (isLive) startCapture();
  }, [isLive, startCapture]);

  const attachGlCanvas = useCallback(
    (canvas: HTMLCanvasElement | HTMLVideoElement | null) => {
      glCanvasRef.current = canvas;
      if (canvas && isLive) startCapture();
    },
    [isLive, startCapture],
  );

  const goLive = useCallback(() => {
    setIsLive(true);
    setState((prev) => ({ ...prev, routeToMixer: true }));
    startCapture();
  }, [startCapture]);

  const stopLive = useCallback(() => {
    setIsLive(false);
    setState((prev) => ({ ...prev, routeToMixer: false }));
    captureRef.current?.stop();
    captureRef.current = null;
    setProgramStream(null);
  }, []);

  const togglePipelineNode = useCallback((id: PrismNodeId) => {
    setStudio((prev) => ({
      ...prev,
      nodeGraph: toggleNode(prev.nodeGraph, id),
    }));
  }, []);

  const setSecondarySlots = useCallback((slots: PrismSecondarySlot[]) => {
    setStudio((prev) => ({ ...prev, secondarySlots: slots }));
  }, []);

  const value = useMemo(
    () => ({
      state,
      studio,
      programStream,
      isLive,
      patchState,
      patchStudio,
      setKeySettings,
      setLowerThird,
      setMotion,
      attachGlCanvas,
      goLive,
      stopLive,
      refreshCapture,
      togglePipelineNode,
      setSecondarySlots,
      getPipOverlaysRef: pipOverlaysRef,
      getMotionOverlayRef: motionOverlayRef,
      getMotionBackdropRef: motionBackdropRef,
    }),
    [state, studio, programStream, isLive, patchState, patchStudio, setKeySettings, setLowerThird, setMotion, attachGlCanvas, goLive, stopLive, refreshCapture, togglePipelineNode, setSecondarySlots],
  );

  return <PrismFeedContext.Provider value={value}>{children}</PrismFeedContext.Provider>;
}

export function usePrismFeed() {
  const ctx = useContext(PrismFeedContext);
  if (!ctx) throw new Error('usePrismFeed must be used within PrismFeedProvider');
  return ctx;
}

export function usePrismFeedOptional() {
  return useContext(PrismFeedContext);
}
