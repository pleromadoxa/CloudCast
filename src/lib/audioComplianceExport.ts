import type { AudioAuditRow } from './audioAuditService';
import { downloadBlobLocally } from './replayClipService';

function csvEscape(value: unknown): string {
  const text = value == null ? '' : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function rowsToCsv(headers: string[], rows: string[][]): string {
  return [headers.join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
}

export function buildAudioAuditComplianceCsv(rows: AudioAuditRow[]): string {
  return rowsToCsv(
    ['timestamp', 'event_type', 'session_id', 'channel_index', 'scene_id', 'label', 'meta_json'],
    rows.map((row) => [
      row.createdAt,
      row.eventType,
      row.sessionId ?? '',
      row.channelIndex != null ? String(row.channelIndex + 1) : '',
      row.sceneId ?? '',
      row.label ?? '',
      JSON.stringify(row.meta),
    ]),
  );
}

export function buildAudioAuditComplianceJson(rows: AudioAuditRow[]): string {
  return JSON.stringify(
    { exportedAt: new Date().toISOString(), eventCount: rows.length, events: rows },
    null,
    2,
  );
}

export function downloadAudioComplianceCsv(content: string, fileName: string): void {
  downloadBlobLocally(new Blob([content], { type: 'text/csv;charset=utf-8' }), fileName);
}

export function downloadAudioComplianceJson(content: string, fileName: string): void {
  downloadBlobLocally(new Blob([content], { type: 'application/json;charset=utf-8' }), fileName);
}
