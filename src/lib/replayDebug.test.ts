import { describe, expect, it } from 'vitest';
import { evaluateReplayBufferHealth, evaluateReplaySourceHealth } from './replayDebug';

describe('replayDebug', () => {
  it('marks active buffer as ok', () => {
    const result = evaluateReplayBufferHealth({
      isRecording: true,
      bufferSeconds: 2,
      maxSeconds: 30,
      markInSec: null,
      markOutSec: null,
      markTimecodeIn: null,
      markTimecodeOut: null,
      houseClockSmpte: '00:00:02:00',
      chunkCount: 4,
      mimeType: 'video/webm',
    });
    expect(result.health).toBe('ok');
  });

  it('warns when PGM program feed is not connected', () => {
    const result = evaluateReplaySourceHealth({
      kind: 'pgm-program',
      deviceId: null,
      hasStream: false,
      videoTracks: 0,
      audioTracks: 0,
      ingressPath: 'pgm',
      error: null,
    });
    expect(result.health).toBe('warn');
  });

  it('fails when camera source has no stream', () => {
    const result = evaluateReplaySourceHealth({
      kind: 'camera',
      deviceId: 'dev-1',
      hasStream: false,
      videoTracks: 0,
      audioTracks: 0,
      ingressPath: 'mesh',
      error: null,
    });
    expect(result.health).toBe('fail');
  });
});
