import { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { fetchReplayAuditLog, type ReplayAuditRow } from '../../lib/replayAuditService';
import {
  buildAuditComplianceCsv,
  buildAuditComplianceJson,
  buildClipManifestCsv,
  downloadComplianceCsv,
  downloadComplianceJson,
} from '../../lib/replayComplianceExport';
import { buildCmx3600Edl, clipsToEdlSources, downloadEdlFile } from '../../lib/replayEdlExport';
import type { ReplayCloudClip } from '../../types/replay';
import { cn } from '../../lib/utils';

function formatEvent(row: ReplayAuditRow): string {
  switch (row.eventType) {
    case 'buffer_start':
      return 'Buffer started';
    case 'buffer_stall_recovered':
      return 'Buffer stall recovered';
    case 'mark_in':
      return `Mark IN ${row.meta.timecode ? `@ ${row.meta.timecode}` : ''}`.trim();
    case 'mark_out':
      return `Mark OUT ${row.meta.timecode ? `@ ${row.meta.timecode}` : ''}`.trim();
    case 'clip_saved':
      return `Clip saved${row.bankIndex != null ? ` → bank ${row.bankIndex + 1}` : ''}`;
    case 'pgm_push':
      return `PGM push — ${row.label ?? 'clip'}`;
    case 'pgm_return':
      return 'Returned to live';
    case 'cloud_sync':
      return 'Cloud sync';
    case 'precise_export':
      return 'Precise export';
    case 'rundown_start':
      return `Rundown started — ${row.meta.count ?? '?'} clips`;
    case 'rundown_advance':
      return `Rundown advance — ${row.label ?? 'next clip'}`;
    case 'rundown_template_saved':
      return `Rundown template saved — ${row.label ?? 'template'}`;
    case 'quota_warning':
      return `Storage alert — ${row.meta.message ?? 'quota threshold'}`;
    default:
      return row.eventType;
  }
}

interface ReplayAuditPanelProps {
  sessionId?: string | null;
  cloudClips?: ReplayCloudClip[];
  className?: string;
}

export function ReplayAuditPanel({ sessionId, cloudClips = [], className }: ReplayAuditPanelProps) {
  const [rows, setRows] = useState<ReplayAuditRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchReplayAuditLog(50);
      setRows(
        sessionId
          ? data.filter((row) => !row.sessionId || row.sessionId === sessionId)
          : data,
      );
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return (
    <section className={cn('border-t border-white/5 px-3 py-2', className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-mixer-muted">Operator audit trail</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="replay-btn text-[9px]"
            disabled={rows.length === 0}
            onClick={() => downloadComplianceCsv(buildAuditComplianceCsv(rows), `replay-audit-${Date.now()}.csv`)}
            title="Export audit CSV"
          >
            <Download className="h-3 w-3" /> CSV
          </button>
          <button
            type="button"
            className="replay-btn text-[9px]"
            disabled={rows.length === 0}
            onClick={() =>
              downloadComplianceJson(buildAuditComplianceJson(rows), `replay-audit-${Date.now()}.json`)
            }
            title="Export audit JSON"
          >
            JSON
          </button>
          <button
            type="button"
            className="replay-btn text-[9px]"
            disabled={cloudClips.length === 0}
            onClick={() =>
              downloadEdlFile(
                buildCmx3600Edl(clipsToEdlSources(cloudClips), 'CloudCast Replay'),
                `replay-export-${Date.now()}.edl`,
              )
            }
            title="Export CMX3600 EDL for post"
          >
            EDL
          </button>
          <button
            type="button"
            className="replay-btn text-[9px]"
            disabled={cloudClips.length === 0}
            onClick={() =>
              downloadComplianceCsv(buildClipManifestCsv(cloudClips), `replay-clips-${Date.now()}.csv`)
            }
            title="Export clip manifest CSV"
          >
            CLIPS
          </button>
          <button type="button" className="replay-btn text-[9px]" onClick={() => { void refresh(); }}>
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          </button>
        </div>
      </div>
      <div className="max-h-32 overflow-y-auto">
        {rows.length === 0 ? (
          <p className="text-[10px] text-white/30">No audit events yet — marks, saves, and PGM takes are logged here.</p>
        ) : (
          <ul className="space-y-1">
            {rows.map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-2 text-[10px]">
                <span className="text-emerald-200/90">{formatEvent(row)}</span>
                <span className="shrink-0 text-mixer-muted">
                  {new Date(row.createdAt).toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
