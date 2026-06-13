import type { AudioSessionSyncPayload } from '../../lib/audioSessionSync';
import { cn } from '../../lib/utils';

interface AudioSessionSyncPanelProps {
  remoteState: AudioSessionSyncPayload | null;
  followRundownMirror?: boolean;
  onFollowRundownMirrorChange?: (enabled: boolean) => void;
  className?: string;
}

export function AudioSessionSyncPanel({
  remoteState,
  followRundownMirror = true,
  onFollowRundownMirrorChange,
  className,
}: AudioSessionSyncPanelProps) {
  if (!remoteState) {
    return (
      <section className={cn('studiolive-enterprise-panel', className)}>
        <p className="studiolive-enterprise-panel__title">Director sync</p>
        <p className="studiolive-enterprise-panel__hint">Waiting for primary A1 operator state…</p>
        {onFollowRundownMirrorChange && (
          <label className="mt-2 flex items-center gap-2 text-[10px] text-sky-200/90">
            <input
              type="checkbox"
              checked={followRundownMirror}
              onChange={(e) => onFollowRundownMirrorChange(e.target.checked)}
            />
            Auto-recall scenes during rundown
          </label>
        )}
      </section>
    );
  }

  return (
    <section className={cn('studiolive-enterprise-panel', className)}>
      <p className="studiolive-enterprise-panel__title">Director sync</p>
      <div className="studiolive-enterprise-panel__body">
        <p>
          <strong>{remoteState.operatorLabel}</strong> · ch {remoteState.selectedChannel + 1} · {remoteState.activeBank}
        </p>
        <p>
          Master {remoteState.masterMuted ? 'MUTED' : `${remoteState.masterVolume}%`} · Monitor{' '}
          {remoteState.monitorMuted ? 'MUTED' : 'on'}
        </p>
        <p>Console {remoteState.consoleEnabled ? 'LIVE' : 'OFF'}</p>
        {remoteState.soloDeviceId && <p>Solo active</p>}
        {remoteState.activeScene && <p>Scene {remoteState.activeScene}</p>}
        {remoteState.rundownActive && (
          <p>
            Rundown step {(remoteState.rundownStepIndex ?? 0) + 1}/{remoteState.rundownTotal ?? 0}
            {remoteState.rundownCurrentScene ? ` · scene ${remoteState.rundownCurrentScene}` : ''}
          </p>
        )}
        {remoteState.rundownScenes && remoteState.rundownScenes.length > 0 && remoteState.rundownActive && (
          <p className="text-mixer-muted">Queue: {remoteState.rundownScenes.join(' → ')}</p>
        )}
        {remoteState.bridgeConnected && <p>PGM bridge publishing</p>}
      </div>
      {onFollowRundownMirrorChange && (
        <label className="mt-2 flex items-center gap-2 text-[10px] text-sky-200/90">
          <input
            type="checkbox"
            checked={followRundownMirror}
            onChange={(e) => onFollowRundownMirrorChange(e.target.checked)}
          />
          Auto-recall scenes during rundown
        </label>
      )}
    </section>
  );
}
