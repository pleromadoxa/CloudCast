import { describe, expect, it } from 'vitest';
import { buildAudioMixerChecklist, evaluateAudioEngineHealth } from './audioMixerDebug';

describe('audioMixerDebug', () => {
  it('evaluates engine health when console is live with inputs', () => {
    const result = evaluateAudioEngineHealth({
      consoleEnabled: true,
      masterMuted: false,
      monitorMuted: false,
      masterVolume: 80,
      activeChannels: 8,
      liveInputCount: 2,
      soloActive: false,
    });
    expect(result.health).toBe('ok');
  });

  it('builds enterprise checklist sections', () => {
    const sections = buildAudioMixerChecklist({
      engine: {
        consoleEnabled: true,
        masterMuted: false,
        monitorMuted: false,
        masterVolume: 80,
        activeChannels: 8,
        liveInputCount: 1,
        soloActive: false,
      },
      bridge: { canBridge: true, bridgeCode: 'ABC123', bridgeConnected: true },
      deviceRows: [],
      hasPairedDevices: true,
      connectionMode: 'mesh',
      operatorReadOnly: false,
      storedSceneCount: 2,
      fatChannelEnabled: true,
    });
    expect(sections.some((s) => s.title.includes('Enterprise'))).toBe(true);
  });
});
