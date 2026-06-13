import type { AudioSceneRundownItem } from './audioSceneRundown';
import { downloadBlobLocally } from './replayClipService';

export interface RundownRunSheetRow {
  step: number;
  sceneId: string;
  holdSeconds: number;
  cumulativeSeconds: number;
}

function csvEscape(value: unknown): string {
  const text = value == null ? '' : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function buildRundownRunSheetRows(items: AudioSceneRundownItem[]): RundownRunSheetRow[] {
  let cumulative = 0;
  return items.map((item, index) => {
    cumulative += item.holdSeconds;
    return {
      step: index + 1,
      sceneId: item.sceneId,
      holdSeconds: item.holdSeconds,
      cumulativeSeconds: cumulative,
    };
  });
}

export function buildRundownRunSheetCsv(name: string, items: AudioSceneRundownItem[]): string {
  const rows = buildRundownRunSheetRows(items);
  const header = ['rundown_name', 'step', 'scene_id', 'hold_seconds', 'cumulative_seconds'];
  const body = rows.map((row) => [name, String(row.step), row.sceneId, String(row.holdSeconds), String(row.cumulativeSeconds)]);
  return [header.join(','), ...body.map((r) => r.map(csvEscape).join(','))].join('\n');
}

export function buildRundownRunSheetJson(name: string, items: AudioSceneRundownItem[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      name,
      totalSteps: items.length,
      totalDurationSeconds: items.reduce((sum, item) => sum + item.holdSeconds, 0),
      steps: buildRundownRunSheetRows(items),
    },
    null,
    2,
  );
}

/** Plain-text show calling sheet for A1 operators. */
export function buildRundownRunSheetText(name: string, items: AudioSceneRundownItem[]): string {
  const rows = buildRundownRunSheetRows(items);
  const lines = [
    `CloudCast Audio — Scene Rundown Run Sheet`,
    `Name: ${name}`,
    `Steps: ${items.length}`,
    `Total hold: ${items.reduce((sum, item) => sum + item.holdSeconds, 0)}s`,
    '',
  ];
  for (const row of rows) {
    lines.push(`${String(row.step).padStart(2, '0')}. Scene ${row.sceneId} — hold ${row.holdSeconds}s (T+${row.cumulativeSeconds}s)`);
  }
  return lines.join('\n');
}

export function downloadRundownRunSheetCsv(content: string, fileName: string): void {
  downloadBlobLocally(new Blob([content], { type: 'text/csv;charset=utf-8' }), fileName);
}

export function downloadRundownRunSheetJson(content: string, fileName: string): void {
  downloadBlobLocally(new Blob([content], { type: 'application/json;charset=utf-8' }), fileName);
}

export function downloadRundownRunSheetText(content: string, fileName: string): void {
  downloadBlobLocally(new Blob([content], { type: 'text/plain;charset=utf-8' }), fileName);
}
