import type { ChromaKeySettings } from '../lib/prism/chromaKey';
import type { PrismNodeGraph } from '../lib/prism/nodeGraph';
import type { PrismProductionMode } from '../lib/prism/virtualSets';
import type { PrismSecondarySlot } from './prismCameras';

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
}

export interface PrismSceneRecord {
  id: string;
  name: string;
  virtual_set_id: string;
  key_color: { r: number; g: number; b: number };
  key_settings: Record<string, number>;
  camera_settings: { yaw: number; pitch: number; zoom: number };
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
  };
}
