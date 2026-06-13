import { describe, expect, it } from 'vitest';
import { evaluateReplayQuotaAlert } from './replayQuotaAlerts';
import type { ReplayStorageUsage } from '../types/replay';

describe('replayQuotaAlerts', () => {
  const usage: ReplayStorageUsage = {
    usedBytes: 5_000_000_000,
    quotaBytes: 10_000_000_000,
    remainingBytes: 5_000_000_000,
    clipCount: 12,
    totalUsedBytes: 5_000_000_000,
  };

  it('returns ok below warn threshold', () => {
    const alert = evaluateReplayQuotaAlert(usage, 0);
    expect(alert.level).toBe('ok');
  });

  it('warns above 80 percent', () => {
    const alert = evaluateReplayQuotaAlert(usage, 3_500_000_000);
    expect(alert.level).toBe('warn');
  });

  it('blocks upload when full', () => {
    const alert = evaluateReplayQuotaAlert(usage, 5_000_000_000);
    expect(alert.level).toBe('full');
    expect(alert.blocksUpload).toBe(true);
  });
});
