import { describe, expect, it } from 'vitest';
import { buildComplianceBundle, summarizeComplianceBundle } from './audioComplianceBundle';
import { resolveDefaultComplianceExportPreset } from './audioComplianceExportPresets';
import type { AudioConsoleState } from '../hooks/useAudioConsoleState';
import { createEmptyAudioSlot } from '../types/device';

function consoleState(partial: Partial<AudioConsoleState> = {}): AudioConsoleState {
  return {
    consoleEnabled: true,
    peakHoldEnabled: false,
    masterVolume: 80,
    masterMuted: false,
    monitorMuted: false,
    monitorVolume: 80,
    selectedChannel: 0,
    activeBank: 'inputs',
    inputVolumes: { dev1: 70 },
    inputMuted: { dev1: false },
    soloId: null,
    mixEnabled: { dev1: true },
    fatChannel: {},
    noiseCancel: {},
    noiseFloors: {},
    mixSends: {},
    fxEnabled: { A: false, B: false, C: false, D: false },
    fxMix: { A: 25, B: 30, C: 20, D: 40 },
    channelLabels: { dev1: 'Host mic' },
    ...partial,
  };
}

describe('audioComplianceBundle', () => {
  it('builds bundle sections from preset flags', () => {
    const preset = resolveDefaultComplianceExportPreset([]);
    const device = {
      ...createEmptyAudioSlot(1),
      deviceId: 'dev1',
      label: 'Phone 1',
      status: 'live' as const,
      platform: 'ios' as const,
      isOnline: true,
      lastSeenAt: new Date().toISOString(),
    };
    const bundle = buildComplianceBundle(preset, {
      sessionId: 'sess-1',
      operatorLabel: 'A1',
      auditRows: [],
      devices: [device],
      state: consoleState(),
      getAudioSourceForDevice: () => 'camera',
      linkedUsb: {},
      storedScenes: {},
    });
    expect(bundle.audit).toBeDefined();
    expect(bundle.channels).toBeDefined();
    expect(bundle.scenes).toBeDefined();
    expect(summarizeComplianceBundle(bundle)).toContain('channel');
  });

  it('includes rundown when preset and draft provided', () => {
    const preset = {
      ...resolveDefaultComplianceExportPreset([]),
      includeRundown: true,
    };
    const bundle = buildComplianceBundle(preset, {
      auditRows: [],
      devices: [],
      state: consoleState(),
      getAudioSourceForDevice: () => 'camera',
      linkedUsb: {},
      storedScenes: {},
      rundownDraft: [{ sceneId: 'A', holdSeconds: 3 }],
      rundownName: 'Opening',
    });
    expect(bundle.rundown?.stepCount).toBe(1);
  });
});

describe('audioComplianceExportPresets', () => {
  it('resolves builtin default when list is empty', () => {
    const preset = resolveDefaultComplianceExportPreset([]);
    expect(preset.includeAudit).toBe(true);
    expect(preset.name).toBe('Full handoff');
  });
});
