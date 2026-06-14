import { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { fetchVideoAuditLog, type VideoAuditRow } from '../../lib/videoAuditService';
import {
  buildVideoAuditComplianceCsv,
  buildVideoAuditComplianceJson,
  downloadVideoComplianceCsv,
  downloadVideoComplianceJson,
} from '../../lib/videoComplianceExport';
import { cn } from '../../lib/utils';

function formatEvent(row: VideoAuditRow): string {
  switch (row.eventType) {
    case 'cut':
      return `Cut to ${row.label ?? row.deviceId ?? 'preview'}`;
    case 'take':
      return `Take ${row.label ?? row.deviceId ?? 'preview'}`;
    case 'send_to_pgm':
      return `Send to PGM — ${row.label ?? row.deviceId ?? 'source'}`;
    case 'on_air_start':
      return 'Stream started — on air';
    case 'on_air_stop':
      return 'Stream stopped — off air';
    case 'recording_start':
      return 'Recording started';
    case 'recording_stop':
      return 'Recording stopped';
    case 'preset_saved':
      return `Preset saved — ${row.label ?? 'program'}`;
    case 'preset_loaded':
      return `Preset loaded — ${row.label ?? 'program'}`;
    case 'preset_shared':
      return `Preset share code — ${row.label ?? 'code'}`;
    case 'preset_imported':
      return `Preset imported — ${row.label ?? 'program'}`;
    case 'preset_library_promoted':
      return `Preset library — ${row.label ?? 'program'}`;
    case 'ops_digest_sent':
      return 'Ops digest email queued';
    case 'scheduled_digest_sent':
      return 'Scheduled ops digest sent';
    default:
      return row.eventType;
  }
}

interface VideoAuditPanelProps {
  sessionId?: string | null;
  className?: string;
}

export function VideoAuditPanel({ sessionId, className }: VideoAuditPanelProps) {
  const [rows, setRows] = useState<VideoAuditRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchVideoAuditLog(50);
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
          onClick={() => downloadVideoComplianceCsv(buildVideoAuditComplianceCsv(rows), 'cloudcast-video-audit.csv')}
        >
          <Download className="h-3 w-3" /> CSV
        </button>
        <button
          type="button"
          className="studiolive-enterprise-panel__btn"
          onClick={() => downloadVideoComplianceJson(buildVideoAuditComplianceJson(rows), 'cloudcast-video-audit.json')}
        >
          <Download className="h-3 w-3" /> JSON
        </button>
      </div>
    </section>
  );
}
