import type { ReplayStorageUsage } from '../types/replay';

export type ReplayQuotaAlertLevel = 'ok' | 'warn' | 'critical' | 'full';

export interface ReplayQuotaAlert {
  level: ReplayQuotaAlertLevel;
  percentUsed: number;
  message: string;
  blocksUpload: boolean;
}

export function evaluateReplayQuotaAlert(
  usage: ReplayStorageUsage | null | undefined,
  pendingBytes = 0,
): ReplayQuotaAlert {
  if (!usage || usage.quotaBytes <= 0) {
    return {
      level: 'ok',
      percentUsed: 0,
      message: '',
      blocksUpload: false,
    };
  }

  const totalUsed = usage.totalUsedBytes ?? usage.usedBytes;
  const projected = totalUsed + Math.max(0, pendingBytes);
  const percentUsed = Math.min(100, (projected / usage.quotaBytes) * 100);
  const remaining = usage.quotaBytes - projected;

  if (remaining <= 0) {
    return {
      level: 'full',
      percentUsed: 100,
      message: 'Regal Cloud storage is full — delete clips or upgrade before saving.',
      blocksUpload: true,
    };
  }

  if (percentUsed >= 95) {
    return {
      level: 'critical',
      percentUsed,
      message: `Storage critically low (${percentUsed.toFixed(0)}% used) — cloud sync may fail soon.`,
      blocksUpload: pendingBytes > usage.remainingBytes,
    };
  }

  if (percentUsed >= 80) {
    return {
      level: 'warn',
      percentUsed,
      message: `Storage ${percentUsed.toFixed(0)}% full — consider archiving old clips.`,
      blocksUpload: pendingBytes > usage.remainingBytes,
    };
  }

  return {
    level: 'ok',
    percentUsed,
    message: '',
    blocksUpload: pendingBytes > usage.remainingBytes,
  };
}
