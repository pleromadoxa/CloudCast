import { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { fetchAudioAuditLog, type AudioAuditRow } from '../../lib/audioAuditService';
import {
  buildAudioAuditComplianceCsv,
  buildAudioAuditComplianceJson,
  downloadAudioComplianceCsv,
  downloadAudioComplianceJson,
} from '../../lib/audioComplianceExport';
import {
  buildSceneManifestCsv,
  buildSceneManifestJson,
  buildSceneManifestRows,
  downloadSceneManifestCsv,
  downloadSceneManifestJson,
} from '../../lib/audioSceneManifest';
import type { ConsoleSceneSnapshot, SceneId } from '../../lib/audioConsolePersistence';
import { cn } from '../../lib/utils';

function formatEvent(row: AudioAuditRow): string {
  switch (row.eventType) {
    case 'console_power':
      return `Console ${row.meta.enabled ? 'ON' : 'OFF'}`;
    case 'master_mute':
      return `Master ${row.meta.muted ? 'muted' : 'unmuted'}`;
    case 'monitor_mute':
      return `Monitor ${row.meta.muted ? 'muted' : 'unmuted'}`;
    case 'scene_store':
      return `Scene ${row.sceneId} stored`;
    case 'scene_recall':
      return `Scene ${row.sceneId} recalled`;
    case 'channel_mute':
      return `Ch ${(row.channelIndex ?? 0) + 1} ${row.meta.muted ? 'muted' : 'unmuted'}`;
    case 'channel_solo':
      return `Solo ch ${(row.channelIndex ?? 0) + 1}`;
    case 'pgm_bridge_connect':
      return `PGM bridge connected — ${row.label ?? 'code'}`;
    case 'pgm_bridge_disconnect':
      return 'PGM bridge disconnected';
    case 'show_preset_saved':
      return `Show file saved — ${row.label ?? 'preset'}`;
    case 'show_preset_loaded':
      return `Show file loaded — ${row.label ?? 'preset'}`;
    case 'show_shared':
      return `Show share code — ${row.label ?? 'code'}`;
    case 'show_imported':
      return `Show imported — ${row.label ?? 'file'}`;
    case 'show_library_promoted':
      return `Show library — ${row.label ?? 'preset'}`;
    case 'ops_digest_sent':
      return 'Ops digest email queued';
    case 'scheduled_digest_sent':
      return 'Scheduled ops digest sent';
    case 'scene_rundown_start':
      return `Scene rundown started — ${row.meta.count ?? '?'} steps`;
    case 'scene_rundown_advance':
      return `Rundown → scene ${row.sceneId ?? '?'}`;
    case 'scene_rundown_complete':
      return 'Scene rundown complete';
    case 'scene_diff_exported':
      return 'Scene diff exported';
    case 'fx_diff_exported':
      return 'FX diff exported';
    case 'rundown_shared':
      return `Rundown share code — ${row.label ?? 'code'}`;
    case 'rundown_imported':
      return `Rundown imported — ${row.label ?? 'template'}`;
    case 'rundown_library_promoted':
      return `Rundown library — ${row.label ?? 'template'}`;
    case 'scene_backup_restored':
      return `Cloud scene restored — ${row.sceneId ?? '?'}`;
    case 'scene_manifest_exported':
      return 'Scene manifest exported';
    case 'lifecycle_policy_applied':
      return `Lifecycle applied — ${row.meta.prunedSnapshots ?? 0} snapshots, ${row.meta.prunedBackups ?? 0} backups`;
    case 'channel_inventory_exported':
      return 'Channel inventory exported';
    case 'rundown_runsheet_exported':
      return 'Rundown run sheet exported';
    case 'compliance_bundle_exported':
      return 'Compliance handoff bundle exported';
    case 'auto_lifecycle_applied':
      return `Auto lifecycle — ${row.meta.prunedSnapshots ?? 0} snapshots, ${row.meta.prunedBackups ?? 0} backups`;
    case 'source_change':
      return `Source change — ${row.label ?? 'input'}`;
    default:
      return row.eventType;
  }
}

interface AudioAuditPanelProps {
  sessionId?: string | null;
  storedScenes?: Partial<Record<SceneId, ConsoleSceneSnapshot>>;
  onSceneManifestExport?: () => void;
  className?: string;
}

export function AudioAuditPanel({
  sessionId,
  storedScenes = {},
  onSceneManifestExport,
  className,
}: AudioAuditPanelProps) {
  const [rows, setRows] = useState<AudioAuditRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAudioAuditLog(50);
      setRows(
        sessionId ? data.filter((row) => !row.sessionId || row.sessionId === sessionId) : data,
      );
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 15_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const manifestRows = buildSceneManifestRows(storedScenes);

  return (
    <section className={cn('studiolive-enterprise-panel', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="studiolive-enterprise-panel__title">Audit trail</p>
        <button type="button" className="studiolive-enterprise-panel__btn" disabled={loading} onClick={() => { void refresh(); }}>
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>
      <ul className="studiolive-audit-list">
        {rows.slice(0, 8).map((row) => (
          <li key={row.id}>
            <span className="studiolive-audit-list__time">{new Date(row.createdAt).toLocaleTimeString()}</span>
            <span>{formatEvent(row)}</span>
          </li>
        ))}
        {rows.length === 0 && <li className="studiolive-enterprise-panel__hint">No audit events yet — sign in to Regal Cloud.</li>}
      </ul>
      <div className="studiolive-enterprise-panel__actions">
        <button
          type="button"
          className="studiolive-enterprise-panel__btn"
          onClick={() => downloadAudioComplianceCsv(buildAudioAuditComplianceCsv(rows), 'cloudcast-audio-audit.csv')}
        >
          <Download className="h-3 w-3" /> CSV
        </button>
        <button
          type="button"
          className="studiolive-enterprise-panel__btn"
          onClick={() => downloadAudioComplianceJson(buildAudioAuditComplianceJson(rows), 'cloudcast-audio-audit.json')}
        >
          <Download className="h-3 w-3" /> JSON
        </button>
        <button
          type="button"
          className="studiolive-enterprise-panel__btn"
          onClick={() => {
            downloadSceneManifestCsv(buildSceneManifestCsv(manifestRows), 'cloudcast-audio-scenes.csv');
            onSceneManifestExport?.();
          }}
        >
          <Download className="h-3 w-3" /> SCENES
        </button>
        <button
          type="button"
          className="studiolive-enterprise-panel__btn"
          onClick={() => {
            downloadSceneManifestJson(
              buildSceneManifestJson(storedScenes, sessionId),
              'cloudcast-audio-scenes.json',
            );
            onSceneManifestExport?.();
          }}
        >
          <Download className="h-3 w-3" /> SCN JSON
        </button>
      </div>
    </section>
  );
}
