import { describe, expect, it } from 'vitest';
import { buildCmx3600Edl } from './replayEdlExport';

describe('replayEdlExport', () => {
  it('builds CMX3600 events with timecodes', () => {
    const edl = buildCmx3600Edl([
      {
        label: 'Goal replay',
        durationSec: 3,
        inSec: 0,
        outSec: 3,
        timecodeIn: '00:10:00:00',
        timecodeOut: '00:10:03:00',
        frameRate: 30,
        reelName: 'goal.webm',
      },
    ]);

    expect(edl).toContain('TITLE: CloudCast Replay');
    expect(edl).toContain('001');
    expect(edl).toContain('Goal replay');
    expect(edl).toContain('00:10:00:00');
  });
});
