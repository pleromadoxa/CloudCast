import type { VideoSessionSyncPayload } from '../../lib/videoSessionSync';
import { cn } from '../../lib/utils';

interface VideoSessionSyncPanelProps {
  remoteState: VideoSessionSyncPayload | null;
  className?: string;
}

export function VideoSessionSyncPanel({ remoteState, className }: VideoSessionSyncPanelProps) {
  if (!remoteState) {
    return (
      <section className={cn('studiolive-enterprise-panel', className)}>
        <p className="studiolive-enterprise-panel__title">Director sync</p>
        <p className="studiolive-enterprise-panel__hint">Waiting for primary TD operator state…</p>
      </section>
    );
  }

  return (
    <section className={cn('studiolive-enterprise-panel', className)}>
      <p className="studiolive-enterprise-panel__title">Director sync</p>
      <div className="studiolive-enterprise-panel__body">
        <p>
          <strong>{remoteState.operatorLabel}</strong> · {remoteState.activePanel}
        </p>
        <p>
          PST {remoteState.pstDeviceLabel ?? '—'} · PGM {remoteState.pgmDeviceLabel ?? '—'}
        </p>
        <p>
          {remoteState.isOnAir ? 'ON AIR' : 'Off air'}
          {remoteState.isRecording ? ' · REC' : ''}
          {remoteState.inTransition ? ` · ${remoteState.transitionType} ${Math.round(remoteState.transitionProgress * 100)}%` : ''}
        </p>
        <p>Output {remoteState.outputMode}</p>
        {remoteState.replayOnPgmLabel && <p>Replay on PGM — {remoteState.replayOnPgmLabel}</p>}
      </div>
    </section>
  );
}
