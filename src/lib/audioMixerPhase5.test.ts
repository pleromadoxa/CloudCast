import { describe, expect, it } from 'vitest';
import { backupAgeMinutes } from './audioSceneBackup';
import { buildSceneManifestCsv, buildSceneManifestRows } from './audioSceneManifest';
import type { ConsoleSceneSnapshot } from './audioConsolePersistence';
import { getFollowRundownMirrorPref } from './audioFollowerPrefs';

function scene(partial: Partial<ConsoleSceneSnapshot> = {}): ConsoleSceneSnapshot {
  return {
    inputVolumes: { dev1: 70, dev2: 40 },
    inputMuted: { dev1: false, dev2: true },
    mixEnabled: { dev1: true, dev2: false },
    fatChannel: {},
    noiseCancel: {},
    noiseFloors: {},
    mixSends: {},
    masterVolume: 80,
    masterMuted: false,
    monitorMuted: false,
    monitorVolume: 80,
    soloId: null,
    fxEnabled: { A: true, B: false, C: false, D: false },
    fxMix: { A: 25, B: 30, C: 20, D: 40 },
    channelLabels: { dev1: 'Host mic' },
    selectedChannel: 0,
    activeBank: 'inputs',
    ...partial,
  };
}

describe('audioSceneManifest', () => {
  it('builds manifest rows for stored and empty scenes', () => {
    const rows = buildSceneManifestRows({ A: scene(), B: scene({ masterVolume: 60 }) });
    expect(rows).toHaveLength(4);
    expect(rows[0].stored).toBe(true);
    expect(rows[0].channelCount).toBe(2);
    expect(rows[0].fxEnabledSlots).toBe('A');
    expect(rows[2].stored).toBe(false);
    expect(buildSceneManifestCsv(rows)).toContain('scene_id');
  });
});

describe('audioSceneBackup', () => {
  it('computes backup age in minutes', () => {
    const now = Date.parse('2025-06-13T12:00:00.000Z');
    expect(backupAgeMinutes('2025-06-13T11:45:00.000Z', now)).toBe(15);
  });
});

describe('audioFollowerPrefs', () => {
  it('treats missing pref as enabled', () => {
    expect(getFollowRundownMirrorPref()).toBe(true);
  });
});
