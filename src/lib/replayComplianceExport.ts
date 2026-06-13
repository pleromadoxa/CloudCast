import type { ReplayAuditRow } from './replayAuditService';
import type { ReplayCloudClip } from '../types/replay';
import { downloadBlobLocally } from './replayClipService';

function csvEscape(value: unknown): string {
  const text = value == null ? '' : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function rowsToCsv(headers: string[], rows: string[][]): string {
  return [headers.join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
}

export function buildAuditComplianceCsv(rows: ReplayAuditRow[]): string {
  return rowsToCsv(
    ['timestamp', 'event_type', 'session_id', 'clip_id', 'bank_index', 'label', 'meta_json'],
    rows.map((row) => [
      row.createdAt,
      row.eventType,
      row.sessionId ?? '',
      row.clipId ?? '',
      row.bankIndex != null ? String(row.bankIndex + 1) : '',
      row.label ?? '',
      JSON.stringify(row.meta),
    ]),
  );
}

export function buildClipManifestCsv(clips: ReplayCloudClip[]): string {
  return rowsToCsv(
    [
      'created_at',
      'label',
      'file_name',
      'duration_sec',
      'in_sec',
      'out_sec',
      'timecode_in',
      'timecode_out',
      'frame_rate',
      'source_device_id',
      'bank_index',
      'tags',
      'size_bytes',
      'storage_path',
    ],
    clips.map((clip) => [
      clip.createdAt,
      clip.label ?? '',
      clip.fileName,
      clip.durationSec != null ? String(clip.durationSec) : '',
      clip.inSec != null ? String(clip.inSec) : '',
      clip.outSec != null ? String(clip.outSec) : '',
      clip.timecodeIn ?? '',
      clip.timecodeOut ?? '',
      clip.frameRate != null ? String(clip.frameRate) : '',
      clip.sourceDeviceId ?? '',
      clip.bankIndex != null ? String(clip.bankIndex + 1) : '',
      clip.tags.join('|'),
      String(clip.sizeBytes),
      clip.storagePath,
    ]),
  );
}

export function downloadComplianceCsv(content: string, fileName: string): void {
  downloadBlobLocally(new Blob([content], { type: 'text/csv;charset=utf-8' }), fileName);
}

export function buildAuditComplianceJson(rows: ReplayAuditRow[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      eventCount: rows.length,
      events: rows,
    },
    null,
    2,
  );
}

export function downloadComplianceJson(content: string, fileName: string): void {
  downloadBlobLocally(new Blob([content], { type: 'application/json;charset=utf-8' }), fileName);
}
