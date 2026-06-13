import { describe, expect, it } from 'vitest';
import { holdsLock, isLockHeldByOther, type ReplayOperatorLock } from './replayOperatorLocks';

describe('replayOperatorLocks', () => {
  const locks: ReplayOperatorLock[] = [
    {
      id: '1',
      sessionId: 'sess',
      operatorKey: 'op-a',
      operatorLabel: 'Alice',
      lockScope: 'console',
      bankIndex: null,
      acquiredAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
    {
      id: '2',
      sessionId: 'sess',
      operatorKey: 'op-b',
      operatorLabel: 'Bob',
      lockScope: 'pgm',
      bankIndex: null,
      acquiredAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
  ];

  it('detects foreign console lock', () => {
    expect(isLockHeldByOther(locks, 'console', 'op-b')).toMatchObject({ operatorLabel: 'Alice' });
    expect(isLockHeldByOther(locks, 'console', 'op-a')).toBeNull();
  });

  it('detects own PGM lock', () => {
    expect(holdsLock(locks, 'pgm', 'op-b')).toBe(true);
    expect(holdsLock(locks, 'pgm', 'op-a')).toBe(false);
  });
});
