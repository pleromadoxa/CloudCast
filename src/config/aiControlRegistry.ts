/**
 * AI-readable control registry for the CloudCast dashboard.
 * Each entry defines a controllable surface that agents can invoke programmatically
 * via the useDashboardState hook actions or by dispatching CustomEvents on window.
 */
import type { ControlAction } from '../types/controls';

export const AI_CONTROL_REGISTRY: ControlAction[] = [
  {
    id: 'selectStream',
    label: 'Select Stream',
    description:
      'Add or remove a device stream from the main camera grid. Pass deviceId to toggle selection.',
    category: 'stream',
    parameters: {
      deviceId: { type: 'string', description: 'Unique device identifier from presence payload' },
      selected: { type: 'boolean', description: 'Force select (true) or deselect (false); omit to toggle' },
    },
  },
  {
    id: 'selectAllLiveStreams',
    label: 'Select All Live Streams',
    description: 'Populate the grid with every device currently in live status.',
    category: 'stream',
  },
  {
    id: 'clearStreamSelection',
    label: 'Clear Stream Selection',
    description: 'Remove all devices from the main camera grid.',
    category: 'stream',
  },
  {
    id: 'setStreamQuality',
    label: 'Set Stream Quality',
    description: 'Override playback quality for a specific device stream.',
    category: 'quality',
    parameters: {
      deviceId: { type: 'string', description: 'Target device' },
      quality: {
        type: 'string',
        description: 'Quality preset',
        enum: ['auto', 'high', 'medium', 'low'],
      },
    },
  },
  {
    id: 'setDefaultQuality',
    label: 'Set Default Quality',
    description: 'Set the global default quality applied to new streams.',
    category: 'quality',
    parameters: {
      quality: {
        type: 'string',
        description: 'Default quality preset',
        enum: ['auto', 'high', 'medium', 'low'],
      },
    },
  },
  {
    id: 'setOverlay',
    label: 'Set Graphic Overlay',
    description: 'Apply a graphic overlay to a specific camera tile.',
    category: 'overlay',
    parameters: {
      deviceId: { type: 'string', description: 'Target device' },
      overlay: {
        type: 'string',
        description: 'Overlay type',
        enum: ['none', 'timestamp', 'device-label', 'crosshair', 'safe-zone'],
      },
    },
  },
  {
    id: 'setGlobalOverlay',
    label: 'Set Global Overlay',
    description: 'Apply an overlay to all tiles that do not have a per-device override.',
    category: 'overlay',
    parameters: {
      overlay: {
        type: 'string',
        description: 'Overlay type',
        enum: ['none', 'timestamp', 'device-label', 'crosshair', 'safe-zone'],
      },
    },
  },
  {
    id: 'setStatusFilter',
    label: 'Filter by Status',
    description: 'Filter the device sidebar and grid by connectivity state.',
    category: 'status',
    parameters: {
      status: {
        type: 'string',
        description: 'Device status filter',
        enum: ['all', 'live', 'offline', 'connecting', 'error'],
      },
    },
  },
  {
    id: 'setViewMode',
    label: 'Set View Mode',
    description: 'Switch between multi-view grid, focus (1+ thumbnails), and single-camera layouts.',
    category: 'layout',
    parameters: {
      mode: { type: 'string', description: 'Layout mode', enum: ['grid', 'focus', 'single'] },
      deviceId: { type: 'string', description: 'Required when mode is focus or single' },
    },
  },
  {
    id: 'toggleOfflineTiles',
    label: 'Toggle Offline Tiles',
    description: 'Show or hide placeholder tiles for offline devices in the grid.',
    category: 'status',
    parameters: {
      show: { type: 'boolean', description: 'true to show offline placeholders, false to hide' },
    },
  },
  {
    id: 'toggleAudioMute',
    label: 'Toggle Audio Mute',
    description: 'Mute or unmute audio on all playback streams.',
    category: 'audio',
    parameters: {
      muted: { type: 'boolean', description: 'true to mute, false to unmute' },
    },
  },
  {
    id: 'focusDevice',
    label: 'Focus Device',
    description: 'Switch to focus view centered on a single device.',
    category: 'layout',
    parameters: {
      deviceId: { type: 'string', description: 'Device to focus' },
    },
  },
  {
    id: 'reconnectStream',
    label: 'Reconnect Stream',
    description: 'Force stream reconnection for a device (dispatches cloudcast:reconnect event).',
    category: 'stream',
    parameters: {
      deviceId: { type: 'string', description: 'Device whose stream should reconnect' },
    },
  },
  {
    id: 'setPstSource',
    label: 'Set PST Source',
    description: 'Assign a device to the Preview (PST) monitor.',
    category: 'mixer',
    parameters: { deviceId: { type: 'string', description: 'Target device ID' } },
  },
  {
    id: 'setSubSource',
    label: 'Set Sub Source',
    description: 'Assign a device to the Sub layer (PiP/KEY).',
    category: 'mixer',
    parameters: { deviceId: { type: 'string', description: 'Target device ID' } },
  },
  {
    id: 'setOutputMode',
    label: 'Set Output Mode',
    description: 'Switch between MAIN, PIP, and KEY composition modes.',
    category: 'mixer',
    parameters: {
      mode: { type: 'string', description: 'Output mode', enum: ['main', 'pip', 'key'] },
    },
  },
  {
    id: 'setPipPosition',
    label: 'Set PiP Position',
    description: 'Position the sub-stream overlay within the monitor.',
    category: 'mixer',
    parameters: {
      position: {
        type: 'string',
        enum: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'],
        description: 'Corner or center placement',
      },
    },
  },
  {
    id: 'cutToPreview',
    label: 'Cut to Preview',
    description: 'Instantly switch PGM to match PST (CUT).',
    category: 'mixer',
  },
  {
    id: 'takePreview',
    label: 'Take Preview',
    description: 'Switch PGM to PST with transition (TAKE/SW).',
    category: 'mixer',
  },
  {
    id: 'toggleOnAir',
    label: 'Toggle On Air',
    description: 'Enable or disable live program output.',
    category: 'mixer',
    parameters: { onAir: { type: 'boolean', description: 'true for on-air, false for off-air' } },
  },
  {
    id: 'sendToPst',
    label: 'Send to PST',
    description: 'Route a source to preview (alias for setPstSource).',
    category: 'mixer',
    parameters: { deviceId: { type: 'string', description: 'Target device ID' } },
  },
  {
    id: 'take',
    label: 'Take',
    description: 'Animated transition from PST to PGM.',
    category: 'mixer',
  },
  {
    id: 'cutToDevice',
    label: 'Cut to Device',
    description: 'Instant cut to a specific source on PGM.',
    category: 'mixer',
    parameters: { deviceId: { type: 'string', description: 'Target device ID' } },
  },
  {
    id: 'swapPstPgm',
    label: 'Swap PST/PGM',
    description: 'Swap preview and program buses.',
    category: 'mixer',
  },
  {
    id: 'setTransitionType',
    label: 'Set Transition Type',
    description: 'Set transition effect style.',
    category: 'mixer',
    parameters: {
      type: { type: 'string', enum: ['cut', 'mix', 'fade', 'wipe', 'dip'], description: 'Transition type' },
    },
  },
  {
    id: 'setTransitionDuration',
    label: 'Set Transition Duration',
    description: 'Transition length in milliseconds.',
    category: 'mixer',
    parameters: { durationMs: { type: 'number', description: 'Duration in ms' } },
  },
  {
    id: 'setTransitionProgress',
    label: 'Set T-Bar Progress',
    description: 'Manual transition progress 0–100.',
    category: 'mixer',
    parameters: { progress: { type: 'number', description: '0–100' } },
  },
  {
    id: 'toggleRecording',
    label: 'Toggle Recording',
    description: 'Start or stop PGM recording to WebM file.',
    category: 'mixer',
  },
  {
    id: 'toggleMultiview',
    label: 'Toggle Multiview',
    description: 'Open or close multiview modal.',
    category: 'mixer',
  },
  {
    id: 'toggleFullscreen',
    label: 'Toggle Fullscreen',
    description: 'Fullscreen PGM monitor.',
    category: 'mixer',
  },
  {
    id: 'setAspectRatio',
    label: 'Set Aspect Ratio',
    description: 'Video frame aspect for monitors.',
    category: 'mixer',
    parameters: {
      aspectRatio: { type: 'string', enum: ['16:9', '9:16', '4:3', '1:1'], description: 'Aspect ratio' },
    },
  },
  {
    id: 'toggleMasterMute',
    label: 'Toggle Master Mute',
    description: 'Mute or unmute PGM master output.',
    category: 'audio',
    parameters: { muted: { type: 'boolean', description: 'true to mute' } },
  },
  {
    id: 'setMasterVolume',
    label: 'Set Master Volume',
    description: 'PGM master fader 0–100.',
    category: 'audio',
    parameters: { volume: { type: 'number', description: '0–100' } },
  },
  {
    id: 'setInputVolume',
    label: 'Set Input Volume',
    description: 'Per-input fader 0–100.',
    category: 'audio',
    parameters: {
      deviceId: { type: 'string', description: 'Input device ID' },
      volume: { type: 'number', description: '0–100' },
    },
  },
  {
    id: 'toggleInputMute',
    label: 'Toggle Input Mute',
    description: 'Mute a specific input on the PGM bus.',
    category: 'audio',
    parameters: { deviceId: { type: 'string', description: 'Input device ID' } },
  },
  {
    id: 'toggleInputSolo',
    label: 'Toggle Input Solo',
    description: 'Solo a specific input.',
    category: 'audio',
    parameters: { deviceId: { type: 'string', description: 'Input device ID' } },
  },
  {
    id: 'toggleViewAudioMute',
    label: 'Toggle View Audio Mute',
    description: 'Mute preview audio on a source tile.',
    category: 'audio',
    parameters: { deviceId: { type: 'string', description: 'Device ID' } },
  },
  {
    id: 'setActivePanel',
    label: 'Set Active Panel',
    description: 'Switch mixer control deck tab.',
    category: 'mixer',
    parameters: {
      panel: {
        type: 'string',
        enum: ['sources', 'layers', 'audio', 'transitions', 'devices', 'stream', 'settings'],
        description: 'Panel id',
      },
    },
  },
  {
    id: 'patchLayers',
    label: 'Patch Layers',
    description: 'Partial update to graphics layer settings.',
    category: 'mixer',
  },
  {
    id: 'patchPip',
    label: 'Patch PiP',
    description: 'Partial update to picture-in-picture settings.',
    category: 'mixer',
  },
  {
    id: 'patchKey',
    label: 'Patch Key',
    description: 'Partial update to chroma key settings.',
    category: 'mixer',
  },
];

export const AI_CONTROL_EVENT = 'cloudcast:control';

export interface AIControlEventDetail {
  action: string;
  params?: Record<string, unknown>;
}

/** Dispatch a control action programmatically (for AI agents or external automation). */
export function dispatchAIControl(action: string, params?: Record<string, unknown>) {
  window.dispatchEvent(
    new CustomEvent<AIControlEventDetail>(AI_CONTROL_EVENT, { detail: { action, params } }),
  );
}
