import { useEffect } from 'react';
import { AI_CONTROL_EVENT, type AIControlEventDetail } from '../config/aiControlRegistry';
import type { OverlayType, StreamQuality } from '../types/device';
import type { MixerPanel, OutputMode, PipPosition, TransitionType, VideoAspectRatio } from '../types/mixer';

export interface AIControlHandlers {
  selectStream: (deviceId: string, selected?: boolean) => void;
  selectAllLiveStreams: () => void;
  clearStreamSelection: () => void;
  setStreamQuality: (deviceId: string, quality: StreamQuality) => void;
  setDefaultQuality: (quality: StreamQuality) => void;
  setOverlay: (deviceId: string, overlay: OverlayType) => void;
  setGlobalOverlay: (overlay: OverlayType) => void;
  setStatusFilter: (status: DashboardControlsStatusFilter) => void;
  setViewMode: (mode: 'grid' | 'focus' | 'single', deviceId?: string) => void;
  toggleOfflineTiles: (show?: boolean) => void;
  toggleMasterMute: (muted?: boolean) => void;
  focusDevice: (deviceId: string) => void;
  reconnectStream: (deviceId: string) => void;
  sendToPst: (deviceId: string) => void;
  setSubSource: (deviceId: string) => void;
  setOutputMode: (mode: OutputMode) => void;
  setPipPosition: (position: PipPosition) => void;
  cutToPreview: () => void;
  take: () => void;
  cutToDevice: (deviceId: string) => void;
  swapPstPgm: () => void;
  setTransitionType: (type: TransitionType) => void;
  setTransitionDuration: (ms: number) => void;
  setTransitionProgress: (progress: number) => void;
  toggleOnAir: () => void;
  toggleRecording: () => void;
  toggleMultiview: () => void;
  toggleFullscreen: () => void;
  setAspectRatio: (ratio: VideoAspectRatio) => void;
  setMasterVolume: (volume: number) => void;
  setInputVolume: (deviceId: string, volume: number) => void;
  toggleInputMute: (deviceId: string) => void;
  toggleInputSolo: (deviceId: string) => void;
  toggleViewAudioMute: (deviceId: string) => void;
  setActivePanel: (panel: MixerPanel) => void;
  patchLayers: (partial: Record<string, unknown>) => void;
  patchPip: (partial: Record<string, unknown>) => void;
  patchKey: (partial: Record<string, unknown>) => void;
}

type DashboardControlsStatusFilter = 'all' | 'live' | 'offline' | 'connecting' | 'error';

function readBool(params: Record<string, unknown> | undefined, key: string): boolean | undefined {
  const v = params?.[key];
  return typeof v === 'boolean' ? v : undefined;
}

function readString(params: Record<string, unknown> | undefined, key: string): string | undefined {
  const v = params?.[key];
  return typeof v === 'string' ? v : undefined;
}

function readNumber(params: Record<string, unknown> | undefined, key: string): number | undefined {
  const v = params?.[key];
  return typeof v === 'number' ? v : undefined;
}

export function useAIControls(handlers: AIControlHandlers, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const onControl = (e: Event) => {
      const { action, params } = (e as CustomEvent<AIControlEventDetail>).detail ?? {};
      if (!action) return;

      switch (action) {
        case 'selectStream': {
          const deviceId = readString(params, 'deviceId');
          if (deviceId) handlers.selectStream(deviceId, readBool(params, 'selected'));
          break;
        }
        case 'selectAllLiveStreams':
          handlers.selectAllLiveStreams();
          break;
        case 'clearStreamSelection':
          handlers.clearStreamSelection();
          break;
        case 'setStreamQuality': {
          const deviceId = readString(params, 'deviceId');
          const quality = readString(params, 'quality') as StreamQuality | undefined;
          if (deviceId && quality) handlers.setStreamQuality(deviceId, quality);
          break;
        }
        case 'setDefaultQuality': {
          const quality = readString(params, 'quality') as StreamQuality | undefined;
          if (quality) handlers.setDefaultQuality(quality);
          break;
        }
        case 'setOverlay': {
          const deviceId = readString(params, 'deviceId');
          const overlay = readString(params, 'overlay') as OverlayType | undefined;
          if (deviceId && overlay) handlers.setOverlay(deviceId, overlay);
          break;
        }
        case 'setGlobalOverlay': {
          const overlay = readString(params, 'overlay') as OverlayType | undefined;
          if (overlay) handlers.setGlobalOverlay(overlay);
          break;
        }
        case 'setStatusFilter': {
          const status = readString(params, 'status') as DashboardControlsStatusFilter | undefined;
          if (status) handlers.setStatusFilter(status);
          break;
        }
        case 'setViewMode': {
          const mode = readString(params, 'mode') as 'grid' | 'focus' | 'single' | undefined;
          if (mode) handlers.setViewMode(mode, readString(params, 'deviceId'));
          break;
        }
        case 'toggleOfflineTiles':
          handlers.toggleOfflineTiles(readBool(params, 'show'));
          break;
        case 'toggleAudioMute':
        case 'toggleMasterMute':
          handlers.toggleMasterMute(readBool(params, 'muted'));
          break;
        case 'focusDevice':
        case 'sendToPst':
        case 'setPstSource': {
          const deviceId = readString(params, 'deviceId');
          if (deviceId) {
            if (action === 'focusDevice') handlers.focusDevice(deviceId);
            else handlers.sendToPst(deviceId);
          }
          break;
        }
        case 'reconnectStream': {
          const deviceId = readString(params, 'deviceId');
          if (deviceId) handlers.reconnectStream(deviceId);
          break;
        }
        case 'setSubSource': {
          const deviceId = readString(params, 'deviceId');
          if (deviceId) handlers.setSubSource(deviceId);
          break;
        }
        case 'setOutputMode': {
          const mode = readString(params, 'mode') as OutputMode | undefined;
          if (mode) handlers.setOutputMode(mode);
          break;
        }
        case 'setPipPosition': {
          const position = readString(params, 'position') as PipPosition | undefined;
          if (position) handlers.setPipPosition(position);
          break;
        }
        case 'cutToPreview':
          handlers.cutToPreview();
          break;
        case 'take':
        case 'takePreview':
          handlers.take();
          break;
        case 'cutToDevice': {
          const deviceId = readString(params, 'deviceId');
          if (deviceId) handlers.cutToDevice(deviceId);
          break;
        }
        case 'swapPstPgm':
          handlers.swapPstPgm();
          break;
        case 'setTransitionType': {
          const type = readString(params, 'type') as TransitionType | undefined;
          if (type) handlers.setTransitionType(type);
          break;
        }
        case 'setTransitionDuration': {
          const ms = readNumber(params, 'durationMs') ?? readNumber(params, 'ms');
          if (ms != null) handlers.setTransitionDuration(ms);
          break;
        }
        case 'setTransitionProgress': {
          const progress = readNumber(params, 'progress');
          if (progress != null) handlers.setTransitionProgress(progress);
          break;
        }
        case 'toggleOnAir':
          handlers.toggleOnAir();
          break;
        case 'toggleRecording':
          handlers.toggleRecording();
          break;
        case 'toggleMultiview':
          handlers.toggleMultiview();
          break;
        case 'toggleFullscreen':
          handlers.toggleFullscreen();
          break;
        case 'setAspectRatio': {
          const aspectRatio = readString(params, 'aspectRatio') as VideoAspectRatio | undefined;
          if (aspectRatio) handlers.setAspectRatio(aspectRatio);
          break;
        }
        case 'setMasterVolume': {
          const volume = readNumber(params, 'volume');
          if (volume != null) handlers.setMasterVolume(volume);
          break;
        }
        case 'setInputVolume': {
          const deviceId = readString(params, 'deviceId');
          const volume = readNumber(params, 'volume');
          if (deviceId && volume != null) handlers.setInputVolume(deviceId, volume);
          break;
        }
        case 'toggleInputMute': {
          const deviceId = readString(params, 'deviceId');
          if (deviceId) handlers.toggleInputMute(deviceId);
          break;
        }
        case 'toggleInputSolo': {
          const deviceId = readString(params, 'deviceId');
          if (deviceId) handlers.toggleInputSolo(deviceId);
          break;
        }
        case 'toggleViewAudioMute': {
          const deviceId = readString(params, 'deviceId');
          if (deviceId) handlers.toggleViewAudioMute(deviceId);
          break;
        }
        case 'setActivePanel': {
          const panel = readString(params, 'panel') as MixerPanel | undefined;
          if (panel) handlers.setActivePanel(panel);
          break;
        }
        case 'patchLayers':
          if (params) handlers.patchLayers(params);
          break;
        case 'patchPip':
          if (params) handlers.patchPip(params);
          break;
        case 'patchKey':
          if (params) handlers.patchKey(params);
          break;
        default:
          break;
      }
    };

    window.addEventListener(AI_CONTROL_EVENT, onControl);
    return () => window.removeEventListener(AI_CONTROL_EVENT, onControl);
  }, [handlers, enabled]);
}
