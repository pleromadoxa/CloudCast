import { describe, expect, it } from 'vitest';
import { meshReofferStaggerMs } from './meshStability';

describe('meshReofferStaggerMs', () => {
  it('spreads devices across the window', () => {
    const ids = ['device-a', 'device-b', 'device-c', 'device-d'];
    const delays = ids.map((id) => meshReofferStaggerMs(id, ids.length));
    expect(new Set(delays).size).toBeGreaterThan(1);
    delays.forEach((delay) => {
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThan(2_400);
    });
  });

  it('is stable for the same device id', () => {
    expect(meshReofferStaggerMs('cam-1', 3)).toBe(meshReofferStaggerMs('cam-1', 3));
  });
});
