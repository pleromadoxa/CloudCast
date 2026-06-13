import type { ConsoleSceneSnapshot, SceneId } from './audioConsolePersistence';
import { FX_SLOTS } from '../hooks/useAudioConsoleState';
import { downloadBlobLocally } from './replayClipService';

export interface SceneManifestRow {
  sceneId: SceneId;
  stored: boolean;
  channelCount: number;
  mutedChannelCount: number;
  masterVolume: number;
  masterMuted: boolean;
  monitorMuted: boolean;
  fxEnabledSlots: string;
  fxMixSummary: string;
  soloActive: boolean;
}

function summarizeFx(snapshot: ConsoleSceneSnapshot): { enabled: string; mix: string } {
  const enabled = FX_SLOTS.filter((slot) => snapshot.fxEnabled[slot.id]).map((slot) => slot.id);
  const mix = FX_SLOTS.map((slot) => `${slot.id}:${snapshot.fxMix[slot.id]}%`).join('|');
  return { enabled: enabled.join('|') || 'none', mix };
}

export function buildSceneManifestRows(
  storedScenes: Partial<Record<SceneId, ConsoleSceneSnapshot>>,
): SceneManifestRow[] {
  const sceneIds: SceneId[] = ['A', 'B', 'C', 'D'];
  return sceneIds.map((sceneId) => {
    const snapshot = storedScenes[sceneId];
    if (!snapshot) {
      return {
        sceneId,
        stored: false,
        channelCount: 0,
        mutedChannelCount: 0,
        masterVolume: 0,
        masterMuted: false,
        monitorMuted: false,
        fxEnabledSlots: '',
        fxMixSummary: '',
        soloActive: false,
      };
    }
    const fx = summarizeFx(snapshot);
    return {
      sceneId,
      stored: true,
      channelCount: Object.keys(snapshot.inputVolumes).length,
      mutedChannelCount: Object.values(snapshot.inputMuted).filter(Boolean).length,
      masterVolume: snapshot.masterVolume,
      masterMuted: snapshot.masterMuted,
      monitorMuted: snapshot.monitorMuted,
      fxEnabledSlots: fx.enabled,
      fxMixSummary: fx.mix,
      soloActive: Boolean(snapshot.soloId),
    };
  });
}

function csvEscape(value: unknown): string {
  const text = value == null ? '' : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function buildSceneManifestCsv(rows: SceneManifestRow[]): string {
  const header = [
    'scene_id',
    'stored',
    'channel_count',
    'muted_channels',
    'master_volume',
    'master_muted',
    'monitor_muted',
    'fx_enabled',
    'fx_mix',
    'solo_active',
  ];
  const body = rows.map((row) => [
    row.sceneId,
    String(row.stored),
    String(row.channelCount),
    String(row.mutedChannelCount),
    String(row.masterVolume),
    String(row.masterMuted),
    String(row.monitorMuted),
    row.fxEnabledSlots,
    row.fxMixSummary,
    String(row.soloActive),
  ]);
  return [header.join(','), ...body.map((r) => r.map(csvEscape).join(','))].join('\n');
}

export function buildSceneManifestJson(
  storedScenes: Partial<Record<SceneId, ConsoleSceneSnapshot>>,
  sessionId?: string | null,
): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      sessionId: sessionId ?? null,
      manifest: buildSceneManifestRows(storedScenes),
      scenes: storedScenes,
    },
    null,
    2,
  );
}

export function downloadSceneManifestCsv(content: string, fileName: string): void {
  downloadBlobLocally(new Blob([content], { type: 'text/csv;charset=utf-8' }), fileName);
}

export function downloadSceneManifestJson(content: string, fileName: string): void {
  downloadBlobLocally(new Blob([content], { type: 'application/json;charset=utf-8' }), fileName);
}
