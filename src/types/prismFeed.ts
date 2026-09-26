import type { ChromaKeySettings } from '../lib/prism/chromaKey';
import type { PrismNodeGraph } from '../lib/prism/nodeGraph';
import type { MotionTemplateOverrides, PrismMotionState } from '../lib/prism/motionGraphics';
import { DEFAULT_MOTION_STATE } from '../lib/prism/motionGraphics';
import type { PrismBrandKit } from '../lib/prism/brandKit';
import type { PrismProductionMode } from '../lib/prism/virtualSets';
import type { PrismSecondarySlot } from './prismCameras';
import type { StudioScreenSource } from '../lib/virtualStudio/types';

export const REGAL_PRISM_DEVICE_ID = 'regal-prism-feed';

export interface PrismLowerThird {
  title: string;
  subtitle: string;
  visible: boolean;
}

export interface PrismFeedState {
  virtualSetId: string;
  mode: PrismProductionMode;
  keySettings: ChromaKeySettings;
  cameraYaw: number;
  cameraPitch: number;
  cameraZoom: number;
  /**
   * Free-camera look-at point in world space — drag/WASD panning flies the
   * camera anywhere in the set (Aximetry-style). Unset = scene default anchor.
   */
  cameraTarget?: [number, number, number];
  showShadows: boolean;
  showReflections: boolean;
  showWatermark: boolean;
  captureWidth: number;
  captureHeight: number;
  /** When true, composite is routed to Video Mixer virtual input */
  routeToMixer: boolean;
  lowerThird: PrismLowerThird;
  /** local webcam or paired mobile device id */
  cameraSourceId: string;
  orientationTracking: boolean;
  webxrTracking: boolean;
  /** inline = head pose in page; immersive-ar = device AR passthrough session */
  webxrMode: 'inline' | 'immersive-ar';
  programAudioMic: boolean;
  programAudioMixer: boolean;
  /** 3D motion graphics template playback (outros, openers, stings). */
  motion: PrismMotionState;
}

/** Instance of a catalog 3D object placed in the virtual set */
export interface PrismSceneObject {
  id: string;
  catalogId: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}

export interface PrismSceneExtendedState {
  nodeGraph?: PrismNodeGraph;
  secondarySlots?: PrismSecondarySlot[];
  lowerThird?: PrismLowerThird;
  /** Placed 3D props from the model library */
  sceneObjects?: PrismSceneObject[];
  /**
   * 3D motion graphics state — brand kit + template overrides round-trip with
   * the scene (optional so previously saved scenes stay valid).
   */
  motion?: {
    brand?: PrismBrandKit;
    overrides?: MotionTemplateOverrides;
  };
  /** Photoreal render engine state (screen bindings, backdrop, look). */
  photoreal?: {
    renderEngine?: 'classic' | 'photoreal';
    sceneId?: string;
    bindings?: Record<string, StudioScreenSource>;
    backdrop?: StudioScreenSource;
    lighting?: number;
    tickerSpeed?: number;
    shots?: ({
      yaw: number;
      pitch: number;
      zoom: number;
      fov?: number;
      target?: [number, number, number];
    } | null)[];
    temperature?: number;
    exposure?: number;
    accent?: string;
    effects?: {
      bloom?: boolean;
      bloomIntensity?: number;
      depthOfField?: boolean;
      vignette?: boolean;
      ao?: boolean;
      smaa?: boolean;
    };
    elements?: {
      id: string;
      elementId: string;
      position: [number, number];
      rotation: number;
      scale: number | [number, number, number];
      elevation?: number;
      source?: StudioScreenSource;
    }[];
    rundown?: {
      label: string;
      pose: { yaw: number; pitch: number; zoom: number; fov?: number; target?: [number, number, number] };
      duration: number;
    }[];
    snapToGrid?: boolean;
    /** Keyed talent plate placement (position/angle/size anywhere on stage). */
    talentPlacement?: {
      position: [number, number, number];
      width?: number;
      yaw?: number;
      pitch?: number;
      roll?: number;
    };
    /** Camera/production transition style & travel time. */
    transition?: {
      style: 'cut' | 'dissolve' | 'jib' | 'whip' | 'crane' | 'zoom';
      duration: number;
    };
  };
}

export interface PrismSceneRecord {
  id: string;
  name: string;
  virtual_set_id: string;
  key_color: { r: number; g: number; b: number };
  key_settings: Record<string, number>;
  camera_settings: {
    yaw: number;
    pitch: number;
    zoom: number;
    fov?: number;
    target?: [number, number, number];
  };
  lighting: { shadows: boolean; reflections: boolean };
  mode: PrismProductionMode;
  extended_state: PrismSceneExtendedState;
  created_at: string;
  updated_at: string;
}

export function createDefaultPrismFeedState(): PrismFeedState {
  return {
    virtualSetId: 'news_studio',
    mode: 'virtual_studio',
    keySettings: {
      keyColor: { r: 0, g: 177, b: 64 },
      similarity: 0.4,
      smoothness: 0.08,
      spill: 0.35,
      lightWrap: 0.15,
    },
    cameraYaw: 0,
    cameraPitch: 0.15,
    cameraZoom: 1,
    showShadows: true,
    showReflections: true,
    showWatermark: false,
    captureWidth: 1920,
    captureHeight: 1080,
    routeToMixer: false,
    lowerThird: { title: '', subtitle: '', visible: false },
    cameraSourceId: 'local',
    orientationTracking: false,
    webxrTracking: false,
    webxrMode: 'inline',
    programAudioMic: true,
    programAudioMixer: false,
    motion: { ...DEFAULT_MOTION_STATE },
  };
}
