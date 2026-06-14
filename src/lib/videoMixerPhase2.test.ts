import { describe, expect, it } from 'vitest';
import { digestFrequencyLabel } from './videoOpsDigest';

describe('videoOpsDigest', () => {
  it('labels digest frequencies', () => {
    expect(digestFrequencyLabel('daily')).toBe('Daily');
    expect(digestFrequencyLabel('weekly')).toBe('Weekly');
    expect(digestFrequencyLabel('manual')).toBe('Manual only');
  });
});
