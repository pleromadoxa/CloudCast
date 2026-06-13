import type { AudioInputSource } from '../types/audio';
import type { Device } from '../types/device';
import type { AudioConsoleState } from '../hooks/useAudioConsoleState';
import type { ConsoleSceneSnapshot, SceneId } from './audioConsolePersistence';
import type { AudioAuditRow } from './audioAuditService';
import type { AudioSceneRundownItem } from './audioSceneRundown';
import type { AudioComplianceExportPreset } from './audioComplianceExportPresets';
import { buildAudioAuditComplianceCsv, buildAudioAuditComplianceJson } from './audioComplianceExport';
import { buildChannelInventoryCsv, buildChannelInventoryJson, buildChannelInventoryRows } from './audioChannelInventory';
import { buildSceneManifestCsv, buildSceneManifestJson, buildSceneManifestRows } from './audioSceneManifest';
import { buildRundownRunSheetJson, buildRundownRunSheetText } from './audioRundownRunSheet';
import { downloadBlobLocally } from './replayClipService';

export interface AudioComplianceBundleInput {
  sessionId?: string | null;
  operatorLabel?: string | null;
  auditRows: AudioAuditRow[];
  devices: Device[];
  state: AudioConsoleState;
  getAudioSourceForDevice: (deviceId: string) => AudioInputSource;
  linkedUsb: Record<string, string | null>;
  storedScenes: Partial<Record<SceneId, ConsoleSceneSnapshot>>;
  rundownDraft?: AudioSceneRundownItem[];
  rundownName?: string;
}

export interface AudioComplianceBundle {
  exportedAt: string;
  sessionId: string | null;
  operatorLabel: string | null;
  preset: Pick<
    AudioComplianceExportPreset,
    'includeAudit' | 'includeChannels' | 'includeScenes' | 'includeRundown'
  >;
  audit?: { csv: string; json: string; eventCount: number };
  channels?: { csv: string; json: string; channelCount: number };
  scenes?: { csv: string; json: string; storedCount: number };
  rundown?: { json: string; text: string; stepCount: number };
}

export function buildComplianceBundle(
  preset: AudioComplianceExportPreset,
  input: AudioComplianceBundleInput,
): AudioComplianceBundle {
  const bundle: AudioComplianceBundle = {
    exportedAt: new Date().toISOString(),
    sessionId: input.sessionId ?? null,
    operatorLabel: input.operatorLabel ?? null,
    preset: {
      includeAudit: preset.includeAudit,
      includeChannels: preset.includeChannels,
      includeScenes: preset.includeScenes,
      includeRundown: preset.includeRundown,
    },
  };

  if (preset.includeAudit) {
    bundle.audit = {
      csv: buildAudioAuditComplianceCsv(input.auditRows),
      json: buildAudioAuditComplianceJson(input.auditRows),
      eventCount: input.auditRows.length,
    };
  }

  if (preset.includeChannels) {
    const rows = buildChannelInventoryRows({
      devices: input.devices,
      state: input.state,
      getAudioSourceForDevice: input.getAudioSourceForDevice,
      linkedUsb: input.linkedUsb,
    });
    bundle.channels = {
      csv: buildChannelInventoryCsv(rows),
      json: buildChannelInventoryJson(rows, input.sessionId),
      channelCount: rows.length,
    };
  }

  if (preset.includeScenes) {
    const manifestRows = buildSceneManifestRows(input.storedScenes);
    bundle.scenes = {
      csv: buildSceneManifestCsv(manifestRows),
      json: buildSceneManifestJson(input.storedScenes, input.sessionId),
      storedCount: manifestRows.filter((row) => row.stored).length,
    };
  }

  if (preset.includeRundown && input.rundownDraft && input.rundownDraft.length > 0) {
    const name = input.rundownName?.trim() || 'Scene rundown';
    bundle.rundown = {
      json: buildRundownRunSheetJson(name, input.rundownDraft),
      text: buildRundownRunSheetText(name, input.rundownDraft),
      stepCount: input.rundownDraft.length,
    };
  }

  return bundle;
}

export function downloadComplianceBundleJson(bundle: AudioComplianceBundle, fileName: string): void {
  downloadBlobLocally(
    new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json;charset=utf-8' }),
    fileName,
  );
}

export function summarizeComplianceBundle(bundle: AudioComplianceBundle): string {
  const parts: string[] = [];
  if (bundle.audit) parts.push(`${bundle.audit.eventCount} audit event(s)`);
  if (bundle.channels) parts.push(`${bundle.channels.channelCount} channel(s)`);
  if (bundle.scenes) parts.push(`${bundle.scenes.storedCount} stored scene(s)`);
  if (bundle.rundown) parts.push(`${bundle.rundown.stepCount} rundown step(s)`);
  return parts.length > 0 ? parts.join(' · ') : 'No sections included';
}
