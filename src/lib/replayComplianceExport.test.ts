import { describe, expect, it } from 'vitest';
import { buildAuditComplianceCsv, buildClipManifestCsv } from './replayComplianceExport';
import type { ReplayAuditRow } from './replayAuditService';
import type { ReplayCloudClip } from '../types/replay';

describe('replayComplianceExport', () => {
  it('builds audit csv with headers', () => {
    const rows: ReplayAuditRow[] = [
      {
        id: '1',
        eventType: 'clip_saved',
        sessionId: 'sess',
        clipId: 'clip-1',
        bankIndex: 0,
        label: 'Goal',
        meta: { durationSec: 3.2 },
        createdAt: '2026-06-13T12:00:00.000Z',
      },
    ];
    const csv = buildAuditComplianceCsv(rows);
    expect(csv).toContain('event_type');
    expect(csv).toContain('clip_saved');
    expect(csv).toContain('Goal');
  });

  it('builds clip manifest csv', () => {
    const clips: ReplayCloudClip[] = [
      {
        id: 'c1',
        userId: 'u1',
        storagePath: 'u1/clips/a.webm',
        fileName: 'a.webm',
        mimeType: 'video/webm',
        sizeBytes: 1000,
        durationSec: 2,
        inSec: 0,
        outSec: 2,
        sourceDeviceId: 'cam-1',
        bankIndex: 1,
        label: 'Highlight',
        tags: ['instant-replay'],
        timecodeIn: '00:01:00:00',
        timecodeOut: '00:01:02:00',
        frameRate: 30,
        createdAt: '2026-06-13T12:00:00.000Z',
      },
    ];
    const csv = buildClipManifestCsv(clips);
    expect(csv).toContain('timecode_in');
    expect(csv).toContain('00:01:00:00');
  });
});
