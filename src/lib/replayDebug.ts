import type { ConnectionMode } from '../types/plans';
import type { ReplaySourceKind } from '../types/replay';
import type { ReplayIngressPath } from './replayIngress';

export type ReplayHealth = 'ok' | 'warn' | 'fail' | 'idle';

export interface ReplayBufferDebug {
  isRecording: boolean;
  bufferSeconds: number;
  maxSeconds: number;
  markInSec: number | null;
  markOutSec: number | null;
  markTimecodeIn: string | null;
  markTimecodeOut: string | null;
  houseClockSmpte: string;
  chunkCount: number;
  mimeType: string;
}

export interface ReplaySourceDebug {
  kind: ReplaySourceKind;
  deviceId: string | null;
  hasStream: boolean;
  videoTracks: number;
  audioTracks: number;
  ingressPath: ReplayIngressPath | 'pgm' | 'screen' | 'none';
  error: string | null;
}

export interface ReplayDeviceRow {
  deviceId: string;
  label: string;
  status: string;
  expectedIngress: ReplayIngressPath;
  meshActive: boolean;
  whepActive: boolean;
  whepState: string | null;
}

export interface ReplayDebugSnapshot {
  capturedAt: string;
  connectionMode: ConnectionMode;
  source: ReplaySourceDebug;
  buffer: ReplayBufferDebug;
  devices: ReplayDeviceRow[];
  pgmIngressConnected: boolean;
  replayOnPgm: boolean;
  replayOnPgmLabel: string | null;
  cloudClipCount: number;
  checklist: ReplayChecklistSection[];
}

export interface ReplayChecklistStep {
  id: string;
  label: string;
  hint: string;
  autoPass?: boolean;
}

export interface ReplayChecklistSection {
  title: string;
  steps: ReplayChecklistStep[];
}

export function evaluateReplayBufferHealth(buffer: ReplayBufferDebug): { health: ReplayHealth; reason: string } {
  if (!buffer.isRecording) {
    return { health: 'idle', reason: 'Buffer paused' };
  }
  if (buffer.bufferSeconds >= 1) {
    return { health: 'ok', reason: 'Rolling buffer active' };
  }
  if (buffer.chunkCount > 0) {
    return { health: 'warn', reason: 'Buffer warming up' };
  }
  return { health: 'fail', reason: 'No buffer chunks — check source' };
}

export function evaluateReplaySourceHealth(source: ReplaySourceDebug): { health: ReplayHealth; reason: string } {
  if (source.error) {
    return { health: 'fail', reason: source.error };
  }
  if (source.hasStream && source.videoTracks > 0) {
    return { health: 'ok', reason: `${source.kind} feed with video` };
  }
  if (source.hasStream && source.audioTracks > 0 && source.videoTracks === 0) {
    return { health: 'warn', reason: 'Audio-only source' };
  }
  if (source.kind === 'pgm-program' && !source.hasStream) {
    return { health: 'warn', reason: 'Waiting for PGM program feed (open Video Mixer on air)' };
  }
  return { health: 'fail', reason: 'No live replay source' };
}

export function buildReplayChecklist(input: {
  source: ReplaySourceDebug;
  buffer: ReplayBufferDebug;
  replayOnPgm: boolean;
  pgmIngressConnected: boolean;
  hasPairedDevices: boolean;
  connectionMode: ConnectionMode;
}): ReplayChecklistSection[] {
  const bufferHealth = evaluateReplayBufferHealth(input.buffer);
  const sourceHealth = evaluateReplaySourceHealth(input.source);

  return [
    {
      title: '1 · Source',
      steps: [
        {
          id: 'source-selected',
          label:
            input.source.kind === 'pgm-program'
              ? 'Program feed (PGM) selected'
              : input.source.kind === 'screen'
                ? 'Screen share source'
                : 'Camera / ISO source selected',
          autoPass:
            input.source.kind === 'pgm-program' ||
            input.source.kind === 'screen' ||
            Boolean(input.source.deviceId) ||
            input.hasPairedDevices,
          hint: 'Use Program feed to buffer what viewers see (graphics, PiP, cuts).',
        },
        {
          id: 'source-live',
          label: 'Live video on replay source',
          autoPass: sourceHealth.health === 'ok',
          hint:
            input.connectionMode === 'mesh'
              ? 'Mesh camera or screen share.'
              : 'Regal Cloud cameras use WHEP fallback when mesh video is unavailable.',
        },
        {
          id: 'pgm-feed',
          label: 'PGM ingress available for program buffer',
          autoPass: input.pgmIngressConnected || input.source.kind !== 'pgm-program',
          hint: 'Video Mixer must be open with a source on program.',
        },
      ],
    },
    {
      title: '2 · Rolling buffer',
      steps: [
        {
          id: 'buffer-recording',
          label: 'Buffer recording',
          autoPass: input.buffer.isRecording,
          hint: 'Toggle BUFFER ON after source is live.',
        },
        {
          id: 'buffer-depth',
          label: `Buffer depth ≥ 1s (${input.buffer.bufferSeconds.toFixed(1)}s)`,
          autoPass: input.buffer.bufferSeconds >= 1,
          hint: `Plan max: ${input.buffer.maxSeconds}s`,
        },
        {
          id: 'marks',
          label: 'Mark in / out before save',
          autoPass: input.buffer.markInSec != null && input.buffer.markOutSec != null,
          hint: 'Shortcuts: I mark in · O mark out · Enter save',
        },
        {
          id: 'mark-timecodes',
          label: 'SMPTE mark timecodes captured',
          autoPass: Boolean(input.buffer.markTimecodeIn && input.buffer.markTimecodeOut),
          hint: `House clock: ${input.buffer.houseClockSmpte}`,
        },
      ],
    },
    {
      title: '3 · PGM bus',
      steps: [
        {
          id: 'pgm-bus',
          label: 'Push to PGM uses mixer program bus',
          autoPass: input.replayOnPgm,
          hint: 'Clip routes through PGM monitor and stream encoders — not overlay-only.',
        },
        {
          id: 'return-live',
          label: 'Return to live after clip ends',
          hint: 'Use RETURN TO LIVE on Video Mixer when replay finishes.',
        },
      ],
    },
    {
      title: '4 · Enterprise',
      steps: [
        {
          id: 'house-clock',
          label: 'House clock tracking',
          autoPass: input.buffer.isRecording && input.buffer.houseClockSmpte !== '00:00:00:00',
          hint: 'SMPTE house clock runs while buffer is live.',
        },
        {
          id: 'audit-trail',
          label: 'Operator audit trail',
          hint: 'Marks, saves, PGM takes, and returns are logged to Regal Cloud when signed in.',
        },
        {
          id: 'buffer-resilience',
          label: 'Buffer stall auto-recovery',
          hint: 'Stalled MediaRecorder buffers restart without clearing rolling history.',
        },
        {
          id: 'operator-lock',
          label: 'Multi-operator console lock',
          hint: 'Only one replay operator controls marks/saves per session; others are read-only.',
        },
        {
          id: 'clip-search',
          label: 'Cloud clip metadata search',
          hint: 'Search Regal Cloud clips by label, device, tag, or SMPTE timecode.',
        },
        {
          id: 'export-presets',
          label: 'Export presets (playback · frame · cloud)',
          hint: 'Save and apply export presets for consistent slow-mo and frame-accurate saves.',
        },
        {
          id: 'pgm-rundown',
          label: 'PGM rundown queue',
          hint: 'Play multiple bank clips sequentially on program with auto-advance.',
        },
        {
          id: 'compliance-export',
          label: 'Compliance audit & clip manifest export',
          hint: 'Download CSV/JSON audit trail and clip metadata from the audit panel.',
        },
        {
          id: 'director-sync',
          label: 'Cross-operator director sync',
          hint: 'Read-only replay stations mirror primary operator marks and rundown state.',
        },
        {
          id: 'rundown-templates',
          label: 'Saved PGM rundown templates',
          hint: 'Store and reload bank orders per session or show.',
        },
        {
          id: 'quota-alerts',
          label: 'Regal Cloud quota alerts',
          hint: 'Warns before storage is full and blocks cloud sync when quota exceeded.',
        },
        {
          id: 'edl-export',
          label: 'CMX3600 EDL post handoff',
          hint: 'Export edit decision list with SMPTE timecodes from cloud clips.',
        },
        {
          id: 'rundown-share',
          label: 'Team rundown share codes',
          hint: 'Publish an 8-character code so another operator can import your rundown template.',
        },
        {
          id: 'buffer-snapshot',
          label: 'Ops buffer snapshot archival',
          hint: 'Rolling metadata (marks, house clock, chunk count) saved to Regal Cloud every 30s while recording.',
        },
        {
          id: 'quota-email',
          label: 'Storage quota email alerts',
          hint: 'Warn/critical quota states trigger transactional email when signed in (once per threshold).',
        },
        {
          id: 'show-library',
          label: 'Account show library (rundown templates)',
          hint: 'Promote rundowns to reusable show categories across sessions.',
        },
        {
          id: 'ops-digest',
          label: 'Ops snapshot digest email',
          hint: 'Email summary of buffer snapshots and audit trail from the last 7 days.',
        },
        {
          id: 'clip-lifecycle',
          label: 'Cloud clip lifecycle policies',
          hint: 'Auto-archive aged clips and purge archived clips after retention window.',
        },
      ],
    },
    {
      title: '5 · Health',
      steps: [
        {
          id: 'buffer-health',
          label: `Buffer health: ${bufferHealth.health}`,
          autoPass: bufferHealth.health === 'ok',
          hint: bufferHealth.reason,
        },
      ],
    },
  ];
}

export function formatReplayDebugSnapshot(snapshot: ReplayDebugSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}
