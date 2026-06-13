import { describe, expect, it } from 'vitest';
import { buildFxDiffCsv, diffFxSnapshots } from './audioFxDiff';
import type { ConsoleSceneSnapshot } from './audioConsolePersistence';
import { formatSceneRundownShareCode } from './audioSceneRundownShare';
import { buildAudioSessionSyncPayload } from './audioSessionSync';

function scene(partial: Partial<ConsoleSceneSnapshot> = {}): ConsoleSceneSnapshot {
  return {
    inputVolumes: { dev1: 70 },
    inputMuted: { dev1: false },
    mixEnabled: { dev1: true },
    fatChannel: {},
    noiseCancel: {},
    noiseFloors: {},
    mixSends: {},
    masterVolume: 80,
    masterMuted: false,
    monitorMuted: false,
    monitorVolume: 80,
    soloId: null,
    fxEnabled: { A: false, B: false, C: false, D: false },
    fxMix: { A: 25, B: 30, C: 20, D: 40 },
    channelLabels: { dev1: 'Host mic' },
    selectedChannel: 0,
    activeBank: 'inputs',
    ...partial,
  };
}

describe('audioFxDiff', () => {
  it('detects FX enable and mix changes between scenes', () => {
    const summary = diffFxSnapshots(
      'A',
      scene({ fxEnabled: { A: true, B: false, C: false, D: false }, fxMix: { A: 25, B: 30, C: 20, D: 40 } }),
      'B',
      scene({ fxEnabled: { A: true, B: true, C: false, D: false }, fxMix: { A: 50, B: 30, C: 20, D: 40 } }),
    );
    expect(summary.rows).toHaveLength(2);
    expect(summary.rows.find((row) => row.slot === 'A')?.mixDelta).toBe(25);
    expect(summary.rows.find((row) => row.slot === 'B')?.enabledTo).toBe(true);
    expect(buildFxDiffCsv(summary)).toContain('Hall Reverb');
  });
});

describe('audioSceneRundownShare', () => {
  it('normalizes share codes', () => {
    expect(formatSceneRundownShareCode(' ab12-xy ')).toBe('AB12XY');
  });
});

describe('audioSessionSync rundown fields', () => {
  it('includes rundown progress in sync payload', () => {
    const payload = buildAudioSessionSyncPayload({
      operatorKey: 'op1',
      operatorLabel: 'A1',
      selectedChannel: 0,
      activeBank: 'inputs',
      masterVolume: 80,
      masterMuted: false,
      monitorMuted: false,
      consoleEnabled: true,
      soloDeviceId: null,
      activeScene: 'B',
      bridgeConnected: false,
      rundownActive: true,
      rundownStepIndex: 1,
      rundownTotal: 3,
      rundownScenes: ['A', 'B', 'C'],
      rundownCurrentScene: 'B',
    });
    expect(payload.rundownActive).toBe(true);
    expect(payload.rundownCurrentScene).toBe('B');
    expect(payload.rundownScenes).toEqual(['A', 'B', 'C']);
  });
});
