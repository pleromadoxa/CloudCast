import type { ReplaySessionSyncPayload } from '../../lib/replaySessionSync';
import { cn } from '../../lib/utils';

interface ReplaySessionSyncPanelProps {
  remoteState: ReplaySessionSyncPayload | null;
  className?: string;
}

export function ReplaySessionSyncPanel({ remoteState, className }: ReplaySessionSyncPanelProps) {
  if (!remoteState) {
    return (
      <section className={cn('border-t border-white/5 px-3 py-2', className)}>
        <p className="text-[10px] font-bold uppercase tracking-wider text-mixer-muted">Director sync</p>
        <p className="mt-1 text-[10px] text-white/30">Waiting for primary replay operator state…</p>
      </section>
    );
  }

  return (
    <section className={cn('border-t border-white/5 px-3 py-2', className)}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-mixer-muted">Director sync</p>
      <div className="mt-1 space-y-0.5 text-[10px] text-emerald-200/90">
        <p>
          <strong>{remoteState.operatorLabel}</strong> · bank {remoteState.activeBankIndex + 1}
        </p>
        <p>House TC {remoteState.houseClockSmpte}</p>
        {(remoteState.markTimecodeIn || remoteState.markTimecodeOut) && (
          <p>
            Marks {remoteState.markTimecodeIn ?? '—'} → {remoteState.markTimecodeOut ?? '—'}
          </p>
        )}
        {remoteState.pgmLabel && <p>PGM: {remoteState.pgmLabel}</p>}
        {remoteState.rundownLabels.length > 0 && (
          <p>Rundown: {remoteState.rundownLabels.join(' → ')}</p>
        )}
      </div>
    </section>
  );
}
