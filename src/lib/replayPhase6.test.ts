import { describe, expect, it } from 'vitest';
import { formatRundownShareCode } from './replayRundownShare';
import { snapshotAgeMinutes } from './replayBufferSnapshot';

describe('replayRundownShare', () => {
  it('normalizes share codes to 8 uppercase alphanumeric chars', () => {
    expect(formatRundownShareCode(' ab12-cd34 ')).toBe('AB12CD34');
    expect(formatRundownShareCode('toolongcode123')).toBe('TOOLONGC');
  });
});

describe('replayBufferSnapshot', () => {
  it('computes snapshot age in minutes', () => {
    const now = Date.parse('2025-06-13T12:00:00.000Z');
    const captured = '2025-06-13T11:30:00.000Z';
    expect(snapshotAgeMinutes(captured, now)).toBe(30);
  });
});
