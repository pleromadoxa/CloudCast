import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bug, ChevronDown, Copy } from 'lucide-react';
import type { ConnectionMode } from '../../types/plans';
import type { Device } from '../../types/device';
import { isRealDevice } from '../../types/device';
import { buildDeviceConnectionDebugRow } from '../../lib/audioConnectionDebug';
import {
  buildAudioMixerChecklist,
  evaluateAudioEngineHealth,
  evaluateAudioIngressHealth,
  formatAudioMixerDebugSnapshot,
  type AudioEngineDebug,
} from '../../lib/audioMixerDebug';
import { peekWhepPoolSnapshot } from '../../lib/whepStreamPool';
import { cn } from '../../lib/utils';

const STORAGE_KEY = 'cloudcast-audio-debug-open';

interface AudioMixerDebugPanelProps {
  connectionMode: ConnectionMode;
  sessionId: string | null;
  engine: AudioEngineDebug;
  bridgeConnected: boolean;
  canBridge: boolean;
  bridgeCode: string | null;
  devices: Device[];
  resolveStream: (deviceId: string) => MediaStream | null;
  storedSceneCount: number;
  operatorReadOnly: boolean;
  fatChannelEnabled: boolean;
  className?: string;
}

export function AudioMixerDebugPanel({
  connectionMode,
  sessionId,
  engine,
  bridgeConnected,
  canBridge,
  bridgeCode,
  devices,
  resolveStream,
  storedSceneCount,
  operatorReadOnly,
  fatChannelEnabled,
  className,
}: AudioMixerDebugPanelProps) {
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

  const deviceRows = useMemo(
    () =>
      devices.filter(isRealDevice).map((device) =>
        buildDeviceConnectionDebugRow(
          device,
          connectionMode,
          resolveStream(device.deviceId),
          peekWhepPoolSnapshot(device.deviceId),
        ),
      ),
    [devices, connectionMode, resolveStream],
  );

  const snapshot = useMemo(
    () => ({
      capturedAt: new Date().toISOString(),
      sessionId,
      connectionMode,
      engine,
      bridge: { canBridge, bridgeCode, bridgeConnected },
      devices: deviceRows,
      checklist: buildAudioMixerChecklist({
        engine,
        bridge: { canBridge, bridgeCode, bridgeConnected },
        deviceRows,
        hasPairedDevices: devices.some(isRealDevice),
        connectionMode,
        operatorReadOnly,
        storedSceneCount,
        fatChannelEnabled,
      }),
    }),
    [
      sessionId,
      connectionMode,
      engine,
      canBridge,
      bridgeCode,
      bridgeConnected,
      deviceRows,
      devices,
      operatorReadOnly,
      storedSceneCount,
      fatChannelEnabled,
    ],
  );

  const engineHealth = evaluateAudioEngineHealth(engine);
  const ingressHealth = evaluateAudioIngressHealth(deviceRows);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(formatAudioMixerDebugSnapshot(snapshot));
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
        <span>Audio mixer diagnostics</span>
        <span className="studiolive-debug__toggle-hint">ingress · engine · bridge</span>
        <ChevronDown className={cn('studiolive-debug__chevron', open && 'studiolive-debug__chevron--open')} />
      </button>

      {open && (
        <div className="studiolive-debug__body">
          <div className="studiolive-debug__summary">
            <span>
              <strong>Engine</strong>{' '}
              <span className={cn('handshake-debug__health', engineHealth.health === 'ok' ? 'handshake-debug__health--ok' : 'handshake-debug__health--warn')}>
                {engineHealth.health}
              </span>
            </span>
            <span>
              <strong>Ingress</strong>{' '}
              <span className={cn('handshake-debug__health', ingressHealth.health === 'ok' ? 'handshake-debug__health--ok' : ingressHealth.health === 'fail' ? 'handshake-debug__health--fail' : 'handshake-debug__health--warn')}>
                {ingressHealth.health}
              </span>
            </span>
            <span>
              <strong>Bridge</strong> {bridgeConnected ? 'publishing' : canBridge ? 'idle' : 'n/a'}
            </span>
            <span>
              <strong>Scenes</strong> {storedSceneCount}/4
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
