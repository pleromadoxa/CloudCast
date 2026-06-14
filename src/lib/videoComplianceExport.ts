import type { VideoAuditRow } from './videoAuditService';
import { downloadBlobLocally } from './replayClipService';

function csvEscape(value: unknown): string {
  const text = value == null ? '' : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function rowsToCsv(headers: string[], rows: string[][]): string {
  return [headers.join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
}

export function buildVideoAuditComplianceCsv(rows: VideoAuditRow[]): string {
  return rowsToCsv(
    ['timestamp', 'event_type', 'session_id', 'device_id', 'label', 'meta_json'],
    rows.map((row) => [
      row.createdAt,
      row.eventType,
      row.sessionId ?? '',
      row.deviceId ?? '',
      row.label ?? '',
      JSON.stringify(row.meta),
    ]),
  );
}

export function buildVideoAuditComplianceJson(rows: VideoAuditRow[]): string {
  return JSON.stringify(
    { exportedAt: new Date().toISOString(), eventCount: rows.length, events: rows },
    null,
    2,
  );
}

export function downloadVideoComplianceCsv(content: string, fileName: string): void {
  downloadBlobLocally(new Blob([content], { type: 'text/csv;charset=utf-8' }), fileName);
}

export function downloadVideoComplianceJson(content: string, fileName: string): void {
  downloadBlobLocally(new Blob([content], { type: 'application/json;charset=utf-8' }), fileName);
}
