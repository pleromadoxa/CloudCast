import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import { DEFAULT_KEY_SETTINGS, type ChromaKeySettings } from '../lib/prism/chromaKey';
import { PrismOutputCapture } from '../lib/prism/prismOutputCapture';
import type { ImportedModelEntry } from '../components/prism/ImportedModelGroup';
import type { PrismProductionMode } from '../lib/prism/virtualSets';
import { createDefaultPrismFeedState, type PrismFeedState, type PrismLowerThird, type PrismSceneObject } from '../types/prismFeed';
import { DEFAULT_NODE_GRAPH, type PrismNodeGraph, toggleNode, type PrismNodeId } from '../lib/prism/nodeGraph';
import { DEFAULT_SECONDARY_SLOTS, type PrismSecondarySlot } from '../types/prismCameras';
import type { PrismPipOverlay } from '../lib/prism/prismOutputCapture';

export interface PrismStudioState {
  virtualSetId: string;
  mode: PrismProductionMode;
  keySettings: ChromaKeySettings;
  cameraYaw: number;
  cameraPitch: number;
  cameraZoom: number;
  showShadows: boolean;
  showReflections: boolean;
  importedModels: ImportedModelEntry[];
  sceneObjects: PrismSceneObject[];
  cameraActive: boolean;
  nodeGraph: PrismNodeGraph;
  secondarySlots: PrismSecondarySlot[];
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
  attachGlCanvas: (canvas: HTMLCanvasElement | null) => void;
  goLive: () => void;
  stopLive: () => void;
  refreshCapture: () => void;
  togglePipelineNode: (id: PrismNodeId) => void;
  setSecondarySlots: (slots: PrismSecondarySlot[]) => void;
  getPipOverlaysRef: MutableRefObject<() => PrismPipOverlay[]>;
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
});

const PrismFeedContext = createContext<PrismFeedContextValue | null>(null);

export function PrismFeedProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PrismFeedState>(() => createDefaultPrismFeedState());
  const [studio, setStudio] = useState<PrismStudioState>(() => defaultStudio());
  const [programStream, setProgramStream] = useState<MediaStream | null>(null);
  const [isLive, setIsLive] = useState(false);
  const captureRef = useRef<PrismOutputCapture | null>(null);
  const glCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const studioRef = useRef(studio);
  studioRef.current = studio;
  const pipOverlaysRef = useRef<() => PrismPipOverlay[]>(() => []);

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

  const startCapture = useCallback(() => {
    const canvas = glCanvasRef.current;
    if (!canvas) return;
    captureRef.current?.stop();
    const { captureWidth, captureHeight } = stateRef.current;
    const capture = new PrismOutputCapture(captureWidth, captureHeight);
    const stream = capture.start(canvas, {
      getOverlay: () => ({
        watermark: stateRef.current.showWatermark,
        lowerThird: studioRef.current.nodeGraph.nodes.graphics.enabled
          ? stateRef.current.lowerThird
          : null,
        pipOverlays: studioRef.current.nodeGraph.nodes.pip.enabled
          ? pipOverlaysRef.current()
          : [],
      }),
    });
    captureRef.current = capture;
    setProgramStream(stream);
  }, []);

  const refreshCapture = useCallback(() => {
    if (isLive) startCapture();
  }, [isLive, startCapture]);

  const attachGlCanvas = useCallback(
    (canvas: HTMLCanvasElement | null) => {
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
      attachGlCanvas,
      goLive,
      stopLive,
      refreshCapture,
      togglePipelineNode,
      setSecondarySlots,
      getPipOverlaysRef: pipOverlaysRef,
    }),
    [state, studio, programStream, isLive, patchState, patchStudio, setKeySettings, setLowerThird, attachGlCanvas, goLive, stopLive, refreshCapture, togglePipelineNode, setSecondarySlots],
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
