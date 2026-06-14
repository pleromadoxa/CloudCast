import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bug, ChevronDown, Copy } from 'lucide-react';
import { isRealDevice } from '../../types/device';
import type { Device } from '../../types/device';
import {
  buildVideoMixerChecklist,
  evaluateVideoSwitcherHealth,
  formatVideoMixerDebugSnapshot,
  type VideoSwitcherDebug,
} from '../../lib/videoMixerDebug';
import { cn } from '../../lib/utils';

const STORAGE_KEY = 'cloudcast-video-debug-open';

interface VideoMixerDebugPanelProps {
  sessionId: string | null;
  switcher: VideoSwitcherDebug;
  devices: Device[];
  isSignalingLeader: boolean;
  operatorReadOnly: boolean;
  canCloud: boolean;
  className?: string;
}

export function VideoMixerDebugPanel({
  sessionId,
  switcher,
  devices,
  isSignalingLeader,
  operatorReadOnly,
  canCloud,
  className,
}: VideoMixerDebugPanelProps) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, open ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [open]);

  const snapshot = useMemo(
    () => ({
      capturedAt: new Date().toISOString(),
      sessionId,
      switcher,
      deviceCount: devices.filter(isRealDevice).length,
      checklist: buildVideoMixerChecklist({
        switcher,
        hasPairedDevices: devices.some(isRealDevice),
        isSignalingLeader,
        operatorReadOnly,
        canCloud,
      }),
    }),
    [sessionId, switcher, devices, isSignalingLeader, operatorReadOnly, canCloud],
  );

  const switcherHealth = evaluateVideoSwitcherHealth(switcher);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(formatVideoMixerDebugSnapshot(snapshot));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [snapshot]);

  return (
    <section className={cn('studiolive-debug handshake-debug', className)}>
      <button type="button" className="studiolive-debug__toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Bug className="h-3.5 w-3.5" />
        <span>Video mixer diagnostics</span>
        <span className="studiolive-debug__toggle-hint">ingress · program · enterprise</span>
        <ChevronDown className={cn('studiolive-debug__chevron', open && 'studiolive-debug__chevron--open')} />
      </button>

      {open && (
        <div className="studiolive-debug__body">
          <div className="studiolive-debug__summary">
            <span>
              <strong>Program</strong>{' '}
              <span className={cn('handshake-debug__health', switcherHealth.health === 'ok' ? 'handshake-debug__health--ok' : switcherHealth.health === 'fail' ? 'handshake-debug__health--fail' : 'handshake-debug__health--warn')}>
                {switcherHealth.health}
              </span>
            </span>
            <span>
              <strong>Live</strong> {switcher.liveInputCount}
            </span>
            <span>
              <strong>On air</strong> {switcher.isOnAir ? 'yes' : 'no'}
            </span>
            <span>
              <strong>Leader tab</strong> {isSignalingLeader ? 'yes' : 'no'}
            </span>
          </div>

          <div className="handshake-debug__checklist-wrap">
            <p className="handshake-debug__section-heading">Enterprise readiness checklist</p>
            {snapshot.checklist.map((section) => (
              <div key={section.title} className="handshake-debug__checklist-section">
                <p className="handshake-debug__checklist-title">{section.title}</p>
                <ul className="handshake-debug__checklist">
                  {section.steps.map((step) => (
                    <li key={step.id} className="handshake-debug__checklist-item">
                      <span className={cn(step.autoPass && 'handshake-debug__checklist-done')}>
                        {step.autoPass ? '✓' : '○'} {step.label}
                      </span>
                      <span className="handshake-debug__checklist-hint">{step.hint}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="studiolive-debug__actions">
            <button type="button" className="studiolive-debug__action" onClick={() => { void handleCopy(); }}>
              <Copy className="h-3 w-3" />
              {copied ? 'Copied' : 'Copy debug snapshot'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
