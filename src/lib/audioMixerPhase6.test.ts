import { describe, expect, it } from 'vitest';
import { buildChannelInventoryCsv, buildChannelInventoryRows } from './audioChannelInventory';
import { parsePruneDaysInput } from './audioConsoleLifecycle';
import {
  buildRundownRunSheetCsv,
  buildRundownRunSheetRows,
  buildRundownRunSheetText,
} from './audioRundownRunSheet';
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

describe('audioChannelInventory', () => {
  it('builds inventory rows for real devices', () => {
    const device = {
      ...createEmptyAudioSlot(1),
      deviceId: 'dev1',
      label: 'Phone 1',
      status: 'live' as const,
      platform: 'ios' as const,
      isOnline: true,
      lastSeenAt: new Date().toISOString(),
    };
    const rows = buildChannelInventoryRows({
      devices: [device],
      state: consoleState(),
      getAudioSourceForDevice: () => 'camera',
      linkedUsb: {},
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('Host mic');
    expect(buildChannelInventoryCsv(rows)).toContain('Host mic');
  });
});

describe('audioRundownRunSheet', () => {
  it('computes cumulative hold times', () => {
    const items = [
      { sceneId: 'A' as const, holdSeconds: 3 },
      { sceneId: 'B' as const, holdSeconds: 5 },
    ];
    const rows = buildRundownRunSheetRows(items);
    expect(rows[1].cumulativeSeconds).toBe(8);
    expect(buildRundownRunSheetCsv('Opening', items)).toContain('Opening');
    expect(buildRundownRunSheetText('Opening', [{ sceneId: 'A', holdSeconds: 3 }])).toContain('Scene A');
  });
});

describe('audioConsoleLifecycle', () => {
  it('validates prune day inputs', () => {
    expect(parsePruneDaysInput('14')).toBe(14);
    expect(parsePruneDaysInput('3')).toBeNull();
    expect(parsePruneDaysInput('')).toBeNull();
  });
});
