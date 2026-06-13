import type { ConsoleSceneSnapshot, SceneId } from './audioConsolePersistence';
import { FX_SLOTS } from '../hooks/useAudioConsoleState';
import { downloadBlobLocally } from './replayClipService';

export interface FxDiffRow {
  slot: 'A' | 'B' | 'C' | 'D';
  slotName: string;
  enabledFrom: boolean;
  enabledTo: boolean;
  mixFrom: number;
  mixTo: number;
  mixDelta: number;
}

export interface FxDiffSummary {
  sceneA: SceneId;
  sceneB: SceneId;
  rows: FxDiffRow[];
}

export function diffFxSnapshots(
  sceneA: SceneId,
  snapshotA: ConsoleSceneSnapshot,
  sceneB: SceneId,
  snapshotB: ConsoleSceneSnapshot,
): FxDiffSummary {
  const rows: FxDiffRow[] = [];

  for (const slot of FX_SLOTS) {
    const enabledFrom = snapshotA.fxEnabled[slot.id];
    const enabledTo = snapshotB.fxEnabled[slot.id];
    const mixFrom = snapshotA.fxMix[slot.id];
    const mixTo = snapshotB.fxMix[slot.id];

    if (enabledFrom === enabledTo && mixFrom === mixTo) continue;

    rows.push({
      slot: slot.id,
      slotName: slot.name,
      enabledFrom,
      enabledTo,
      mixFrom,
      mixTo,
      mixDelta: mixTo - mixFrom,
    });
  }

  return { sceneA, sceneB, rows };
}

function csvEscape(value: unknown): string {
  const text = value == null ? '' : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function buildFxDiffCsv(summary: FxDiffSummary): string {
  const header = ['scene_a', 'scene_b', 'fx_slot', 'fx_name', 'enabled_from', 'enabled_to', 'mix_from', 'mix_to', 'mix_delta'];
  const body = summary.rows.map((row) => [
    summary.sceneA,
    summary.sceneB,
    row.slot,
    row.slotName,
    String(row.enabledFrom),
    String(row.enabledTo),
    String(row.mixFrom),
    String(row.mixTo),
    String(row.mixDelta),
  ]);
  return [header.join(','), ...body.map((r) => r.map(csvEscape).join(','))].join('\n');
}

export function buildFxDiffJson(summary: FxDiffSummary): string {
  return JSON.stringify({ exportedAt: new Date().toISOString(), ...summary }, null, 2);
}

export function downloadFxDiffCsv(content: string, fileName: string): void {
  downloadBlobLocally(new Blob([content], { type: 'text/csv;charset=utf-8' }), fileName);
}

export function downloadFxDiffJson(content: string, fileName: string): void {
  downloadBlobLocally(new Blob([content], { type: 'application/json;charset=utf-8' }), fileName);
}
