import { describe, expect, it } from 'vitest';
import { buildVideoMixerChecklist, evaluateVideoSwitcherHealth } from './videoMixerDebug';
import { formatProgramPresetShareCode } from './videoProgramShare';
import { snapshotAgeMinutes } from './videoProgramSnapshot';

describe('videoMixerDebug', () => {
  it('evaluates switcher health when on air with live inputs', () => {
    const result = evaluateVideoSwitcherHealth({
      isOnAir: true,
      isRecording: false,
      liveInputCount: 2,
      pstDeviceId: 'pst-1',
      pgmDeviceId: 'pgm-1',
      inTransition: false,
    });
    expect(result.health).toBe('ok');
  });

  it('builds enterprise checklist sections', () => {
    const sections = buildVideoMixerChecklist({
      switcher: {
        isOnAir: false,
        isRecording: false,
        liveInputCount: 1,
        pstDeviceId: 'pst-1',
        pgmDeviceId: 'pgm-1',
        inTransition: false,
      },
      hasPairedDevices: true,
      isSignalingLeader: true,
      operatorReadOnly: false,
      canCloud: true,
    });
    expect(sections.some((s) => s.title.includes('Enterprise'))).toBe(true);
  });
});

describe('videoProgramShare', () => {
  it('normalizes share codes', () => {
    expect(formatProgramPresetShareCode(' ab12cd34 ')).toBe('AB12CD34');
  });
});

describe('videoProgramSnapshot', () => {
  it('computes age in minutes', () => {
    const now = Date.parse('2025-06-13T12:00:00.000Z');
    expect(snapshotAgeMinutes('2025-06-13T11:45:00.000Z', now)).toBe(15);
  });
});
