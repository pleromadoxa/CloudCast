import { describe, expect, it } from 'vitest';
import { diffSceneSnapshots, buildSceneDiffCsv } from './audioSceneDiff';
import type { ConsoleSceneSnapshot } from './audioConsolePersistence';
import { validateRundownDraft } from './audioSceneRundown';

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

describe('audioSceneDiff', () => {
  it('detects volume and mute changes between scenes', () => {
    const summary = diffSceneSnapshots(
      'A',
      scene({ inputVolumes: { dev1: 70 }, inputMuted: { dev1: false } }),
      'B',
      scene({ inputVolumes: { dev1: 50 }, inputMuted: { dev1: true } }),
    );
    expect(summary.rows).toHaveLength(1);
    expect(summary.rows[0].volumeDelta).toBe(-20);
    expect(summary.rows[0].mutedTo).toBe(true);
    expect(buildSceneDiffCsv(summary)).toContain('Host mic');
  });
});

describe('audioSceneRundown', () => {
  it('validates stored scenes before play', () => {
    expect(validateRundownDraft([{ sceneId: 'A', holdSeconds: 3 }], { A: scene() })).toBeNull();
    expect(validateRundownDraft([{ sceneId: 'C', holdSeconds: 3 }], { A: scene() })).toContain('Scene C');
  });
});
