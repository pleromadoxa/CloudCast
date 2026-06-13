import type { ConsoleSceneSnapshot, SceneId } from './audioConsolePersistence';
import { downloadBlobLocally } from './replayClipService';

export interface SceneDiffRow {
  channelKey: string;
  label: string;
  volumeFrom: number | null;
  volumeTo: number | null;
  volumeDelta: number | null;
  mutedFrom: boolean | null;
  mutedTo: boolean | null;
  mixFrom: boolean | null;
  mixTo: boolean | null;
}

export interface SceneDiffSummary {
  sceneA: SceneId;
  sceneB: SceneId;
  masterVolumeFrom: number;
  masterVolumeTo: number;
  masterMutedFrom: boolean;
  masterMutedTo: boolean;
  rows: SceneDiffRow[];
}

function channelLabel(snapshot: ConsoleSceneSnapshot, deviceId: string): string {
  return snapshot.channelLabels[deviceId]?.trim() || deviceId.slice(0, 8);
}

function collectDeviceIds(snapshot: ConsoleSceneSnapshot): string[] {
  const ids = new Set<string>();
  for (const key of Object.keys(snapshot.inputVolumes)) ids.add(key);
  for (const key of Object.keys(snapshot.inputMuted)) ids.add(key);
  for (const key of Object.keys(snapshot.mixEnabled)) ids.add(key);
  for (const key of Object.keys(snapshot.channelLabels)) ids.add(key);
  return [...ids].sort();
}

export function diffSceneSnapshots(
  sceneA: SceneId,
  snapshotA: ConsoleSceneSnapshot,
  sceneB: SceneId,
  snapshotB: ConsoleSceneSnapshot,
): SceneDiffSummary {
  const deviceIds = new Set([...collectDeviceIds(snapshotA), ...collectDeviceIds(snapshotB)]);
  const rows: SceneDiffRow[] = [];

  for (const deviceId of [...deviceIds].sort()) {
    const volumeFrom = snapshotA.inputVolumes[deviceId] ?? null;
    const volumeTo = snapshotB.inputVolumes[deviceId] ?? null;
    const mutedFrom = snapshotA.inputMuted[deviceId] ?? null;
    const mutedTo = snapshotB.inputMuted[deviceId] ?? null;
    const mixFrom = snapshotA.mixEnabled[deviceId] ?? null;
    const mixTo = snapshotB.mixEnabled[deviceId] ?? null;

    const unchanged =
      volumeFrom === volumeTo &&
      mutedFrom === mutedTo &&
      mixFrom === mixTo;

    if (unchanged) continue;

    rows.push({
      channelKey: deviceId,
      label: channelLabel(snapshotB, deviceId) || channelLabel(snapshotA, deviceId),
      volumeFrom,
      volumeTo,
      volumeDelta: volumeFrom != null && volumeTo != null ? volumeTo - volumeFrom : null,
      mutedFrom,
      mutedTo,
      mixFrom,
      mixTo,
    });
  }

  return {
    sceneA,
    sceneB,
    masterVolumeFrom: snapshotA.masterVolume,
    masterVolumeTo: snapshotB.masterVolume,
    masterMutedFrom: snapshotA.masterMuted,
    masterMutedTo: snapshotB.masterMuted,
    rows,
  };
}

function csvEscape(value: unknown): string {
  const text = value == null ? '' : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function buildSceneDiffCsv(summary: SceneDiffSummary): string {
  const header = [
    'scene_a',
    'scene_b',
    'channel',
    'label',
    'volume_from',
    'volume_to',
    'volume_delta',
    'muted_from',
    'muted_to',
    'mix_from',
    'mix_to',
  ];
  const masterRow = [
    summary.sceneA,
    summary.sceneB,
    'MASTER',
    'Program master',
    String(summary.masterVolumeFrom),
    String(summary.masterVolumeTo),
    String(summary.masterVolumeTo - summary.masterVolumeFrom),
    String(summary.masterMutedFrom),
    String(summary.masterMutedTo),
    '',
    '',
  ];
  const body = summary.rows.map((row) => [
    summary.sceneA,
    summary.sceneB,
    row.channelKey,
    row.label,
    row.volumeFrom != null ? String(row.volumeFrom) : '',
    row.volumeTo != null ? String(row.volumeTo) : '',
    row.volumeDelta != null ? String(row.volumeDelta) : '',
    row.mutedFrom != null ? String(row.mutedFrom) : '',
    row.mutedTo != null ? String(row.mutedTo) : '',
    row.mixFrom != null ? String(row.mixFrom) : '',
    row.mixTo != null ? String(row.mixTo) : '',
  ]);
  return [header.join(','), masterRow.map(csvEscape).join(','), ...body.map((r) => r.map(csvEscape).join(','))].join('\n');
}

export function buildSceneDiffJson(summary: SceneDiffSummary): string {
  return JSON.stringify({ exportedAt: new Date().toISOString(), ...summary }, null, 2);
}

export function downloadSceneDiffCsv(content: string, fileName: string): void {
  downloadBlobLocally(new Blob([content], { type: 'text/csv;charset=utf-8' }), fileName);
}

export function downloadSceneDiffJson(content: string, fileName: string): void {
  downloadBlobLocally(new Blob([content], { type: 'application/json;charset=utf-8' }), fileName);
}
