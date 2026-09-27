import { describe, expect, it } from 'vitest';
import {
  pickPersistedProduction,
  resolveSimpleProductionView,
} from './productionPersistence';
import { isSimpleConsoleView, type AudioConsoleState } from '../hooks/useAudioConsoleState';
import { pickPersistedConsole } from './audioConsolePersistence';
import { createEmptyLayerSettings } from './layerSettings';
import type { DashboardControls } from '../types/controls';

function minimalControls(simpleProductionView: boolean): DashboardControls {
  return {
    selectedStreamIds: [],
    streamQuality: {},
    defaultQuality: 'auto',
    overlays: {},
    globalOverlay: 'none',
    statusFilter: 'all',
    viewMode: 'grid',
    focusedDeviceId: null,
    showOfflineTiles: false,
    pstDeviceId: null,
    pgmDeviceId: null,
    subDeviceId: null,
    transitionFromId: null,
    outputMode: 'main',
    activePanel: 'sources',
    openPanels: ['sources'],
    isOnAir: false,
    isRecording: false,
    showMultiview: false,
    fullscreenPgm: false,
    simpleProductionView,
    mixerViewMode: simpleProductionView ? 'compact' : 'advanced',
    transition: {
      type: 'mix',
      durationMs: 800,
      progress: 0,
      isAnimating: false,
      autoTrans: false,
      fadeToBlack: false,
      fadeToBlackLevel: 0,
    },
    pip: { position: 'bottom-right', size: 'medium', border: true, opacity: 100 },
    key: {
      keyType: 'chroma',
      color: '#00ff00',
      tolerance: 40,
      lumaThreshold: 28,
      enabled: false,
      fillSource: 'preset',
      backgroundId: 'gradient-broadcast',
    },
    layers: createEmptyLayerSettings(),
    pgmLayers: createEmptyLayerSettings(),
    display: { aspectRatio: '16:9' },
    selectedGraphicsLayerId: 'lower-third',
    keyboardShortcuts: {} as DashboardControls['keyboardShortcuts'],
    audio: {
      masterVolume: 80,
      masterMuted: false,
      inputVolumes: {},
      inputMuted: {},
      soloInputId: null,
    } as DashboardControls['audio'],
  };
}

function minimalAudioConsoleState(partial: Partial<AudioConsoleState> = {}): AudioConsoleState {
  return {
    consoleEnabled: true,
    peakHoldEnabled: false,
    consoleViewMode: 'advanced',
    masterVolume: 80,
    masterMuted: false,
    monitorMuted: false,
    monitorVolume: 80,
    selectedChannel: 0,
    activeBank: 'inputs',
    inputVolumes: {},
    inputMuted: {},
    soloId: null,
    mixEnabled: {},
    fatChannel: {},
    noiseCancel: {},
    noiseFloors: {},
    mixSends: {},
    fxEnabled: { A: false, B: false, C: false, D: false },
    fxMix: { A: 25, B: 30, C: 20, D: 40 },
    channelLabels: {},
    ...partial,
  };
}

describe('simple production view default (video mixer)', () => {
  it('defaults to simple view when the operator has no saved preference', () => {
    expect(resolveSimpleProductionView(undefined)).toBe(true);
  });

  it('respects a saved operator choice', () => {
    expect(resolveSimpleProductionView(false)).toBe(false);
    expect(resolveSimpleProductionView(true)).toBe(true);
  });

  it('persists the view preference with the production state', () => {
    expect(pickPersistedProduction(minimalControls(true)).simpleProductionView).toBe(true);
    expect(pickPersistedProduction(minimalControls(false)).simpleProductionView).toBe(false);
  });
});

describe('simple console view default (audio mixer)', () => {
  it('defaults to simple view when the operator has no saved preference', () => {
    expect(isSimpleConsoleView(minimalAudioConsoleState())).toBe(true);
    expect(isSimpleConsoleView(minimalAudioConsoleState({ simpleConsoleView: undefined }))).toBe(true);
  });

  it('respects a saved operator choice', () => {
    expect(isSimpleConsoleView(minimalAudioConsoleState({ simpleConsoleView: false }))).toBe(false);
    expect(isSimpleConsoleView(minimalAudioConsoleState({ simpleConsoleView: true }))).toBe(true);
  });

  it('persists the view preference with the console state', () => {
    expect(pickPersistedConsole(minimalAudioConsoleState()).simpleConsoleView).toBe(true);
    expect(
      pickPersistedConsole(minimalAudioConsoleState({ simpleConsoleView: false })).simpleConsoleView,
    ).toBe(false);
    expect(pickPersistedConsole(minimalAudioConsoleState()).consoleViewMode).toBe('advanced');
  });
});
