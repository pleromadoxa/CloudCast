import { describe, expect, it } from 'vitest';
import { formatAudioShowShareCode } from './audioShowShare';
import { snapshotAgeMinutes } from './audioConsoleSnapshot';
import { canUseAudioFatChannel } from './productEntitlements';

describe('audioShowShare', () => {
  it('normalizes share codes', () => {
    expect(formatAudioShowShareCode(' ab12cd34 ')).toBe('AB12CD34');
  });
});

describe('audioConsoleSnapshot', () => {
  it('computes age in minutes', () => {
    const now = Date.parse('2025-06-13T12:00:00.000Z');
    expect(snapshotAgeMinutes('2025-06-13T11:45:00.000Z', now)).toBe(15);
  });
});

describe('productEntitlements audio fat channel', () => {
  it('allows fat channel on pro_master only', () => {
    expect(canUseAudioFatChannel('pro_master')).toBe(true);
    expect(canUseAudioFatChannel('pro')).toBe(false);
    expect(canUseAudioFatChannel('free')).toBe(false);
  });
});
