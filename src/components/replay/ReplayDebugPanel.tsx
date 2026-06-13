import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bug, ChevronDown, Copy } from 'lucide-react';
import type { ConnectionMode } from '../../types/plans';
import type { Device } from '../../types/device';
import { isRealDevice } from '../../types/device';
import type { ReplaySourceKind } from '../../types/replay';
import { peekWhepPoolSnapshot } from '../../lib/whepStreamPool';
import {
  buildReplayChecklist,
  evaluateReplayBufferHealth,
  evaluateReplaySourceHealth,
  formatReplayDebugSnapshot,
  type ReplayBufferDebug,
  type ReplayHealth,
  type ReplaySourceDebug,
} from '../../lib/replayDebug';
import {
  listReplayCaptureDevices,
  resolveExpectedReplayIngress,
} from '../../lib/replayIngress';
import { cn } from '../../lib/utils';

const STORAGE_KEY = 'cloudcast-replay-debug-open';

function healthClass(health: ReplayHealth): string {
  if (health === 'ok') return 'handshake-debug__health--ok';
  if (health === 'warn') return 'handshake-debug__health--warn';
  if (health === 'fail') return 'handshake-debug__health--fail';
  return 'handshake-debug__health--idle';
}

interface ReplayDebugPanelProps {
  connectionMode: ConnectionMode;
  sourceKind: ReplaySourceKind;
  selectedDeviceId: string | null;
  activeStream: MediaStream | null;
  pgmStream: MediaStream | null;
  sourceError: string | null;
  buffer: ReplayBufferDebug;
  devices: Device[];
  getMeshStream: (deviceId: string) => MediaStream | null;
  getWhepStream: (deviceId: string) => MediaStream | null;
  replayOnPgm: boolean;
  replayOnPgmLabel: string | null;
  cloudClipCount: number;
  className?: string;
}

export function ReplayDebugPanel({
  connectionMode,
  sourceKind,
  selectedDeviceId,
  activeStream,
  pgmStream,
  sourceError,
  buffer,
  devices,
  getMeshStream,
  getWhepStream,
  replayOnPgm,
  replayOnPgmLabel,
  cloudClipCount,
  className,
}: ReplayDebugPanelProps) {
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

  const sourceDebug: ReplaySourceDebug = useMemo(() => {
    const stream = activeStream;
    const ingressPath =
      sourceKind === 'pgm-program'
        ? 'pgm'
        : sourceKind === 'screen'
          ? 'screen'
          : selectedDeviceId
            ? resolveExpectedReplayIngress(
                devices.find((d) => d.deviceId === selectedDeviceId) ?? {
                  deviceId: selectedDeviceId,
                  status: 'connecting',
                  whepUrl: '',
                } as Device,
                connectionMode,
                getMeshStream,
                getWhepStream,
              )
            : 'none';

    return {
      kind: sourceKind,
      deviceId: selectedDeviceId,
      hasStream: Boolean(stream),
      videoTracks: stream?.getVideoTracks().length ?? 0,
      audioTracks: stream?.getAudioTracks().length ?? 0,
      ingressPath,
      error: sourceError,
    };
  }, [
    activeStream,
    sourceKind,
    selectedDeviceId,
    devices,
    connectionMode,
    getMeshStream,
    getWhepStream,
    sourceError,
  ]);

  const deviceRows = useMemo(
    () =>
      listReplayCaptureDevices(devices).map((device) => ({
        deviceId: device.deviceId,
        label: device.label,
        status: device.status,
        expectedIngress: resolveExpectedReplayIngress(device, connectionMode, getMeshStream, getWhepStream),
        meshActive: Boolean(getMeshStream(device.deviceId)?.getVideoTracks().some((t) => t.readyState === 'live')),
        whepActive: Boolean(getWhepStream(device.deviceId)?.getVideoTracks().some((t) => t.readyState === 'live')),
        whepState: peekWhepPoolSnapshot(device.deviceId)?.connectionState ?? null,
      })),
    [devices, connectionMode, getMeshStream, getWhepStream],
  );

  const snapshot = useMemo(
    () => ({
      capturedAt: new Date().toISOString(),
      connectionMode,
      source: sourceDebug,
      buffer,
      devices: deviceRows,
      pgmIngressConnected: Boolean(pgmStream?.getVideoTracks().some((t) => t.readyState === 'live')),
      replayOnPgm,
      replayOnPgmLabel,
      cloudClipCount,
      checklist: buildReplayChecklist({
        source: sourceDebug,
        buffer,
        replayOnPgm,
        pgmIngressConnected: Boolean(pgmStream),
        hasPairedDevices: devices.some(isRealDevice),
        connectionMode,
      }),
    }),
    [
      connectionMode,
      sourceDebug,
      buffer,
      deviceRows,
      pgmStream,
      replayOnPgm,
      replayOnPgmLabel,
      cloudClipCount,
      devices,
    ],
  );

  const bufferHealth = evaluateReplayBufferHealth(buffer);
  const sourceHealth = evaluateReplaySourceHealth(sourceDebug);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(formatReplayDebugSnapshot(snapshot));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [snapshot]);

  return (
    <section className={cn('studiolive-debug handshake-debug', className)}>
      <button
        type="button"
        className="studiolive-debug__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Bug className="h-3.5 w-3.5" />
        <span>Replay diagnostics</span>
        <span className="studiolive-debug__toggle-hint">buffer · PGM · WHEP</span>
        <ChevronDown className={cn('studiolive-debug__chevron', open && 'studiolive-debug__chevron--open')} />
      </button>

      {open && (
        <div className="studiolive-debug__body">
          <div className="studiolive-debug__summary">
            <span>
              <strong>Source</strong> {sourceKind}
            </span>
            <span>
              <strong>Source health</strong>{' '}
              <span className={cn('handshake-debug__health', healthClass(sourceHealth.health))}>
                {sourceHealth.health}
              </span>
            </span>
            <span>
              <strong>Buffer</strong>{' '}
              <span className={cn('handshake-debug__health', healthClass(bufferHealth.health))}>
                {bufferHealth.health}
              </span>{' '}
              ({buffer.bufferSeconds.toFixed(1)}s / {buffer.maxSeconds}s)
            </span>
            <span>
              <strong>House TC</strong> {buffer.houseClockSmpte}
            </span>
            {(buffer.markTimecodeIn || buffer.markTimecodeOut) && (
              <span>
                <strong>Marks</strong> {buffer.markTimecodeIn ?? '—'} → {buffer.markTimecodeOut ?? '—'}
              </span>
            )}
            <span>
              <strong>Chunks</strong> {buffer.chunkCount}
            </span>
            <span>
              <strong>PGM bus</strong> {replayOnPgm ? `live · ${replayOnPgmLabel ?? 'clip'}` : 'idle'}
            </span>
            <span>
              <strong>Cloud clips</strong> {cloudClipCount}
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

          {deviceRows.length > 0 && (
            <>
              <p className="handshake-debug__section-heading">Camera ingress</p>
              <div className="studiolive-debug__table-wrap">
                <table className="studiolive-debug__table">
                  <thead>
                    <tr>
                      <th>Input</th>
                      <th>Expected</th>
                      <th>Mesh</th>
                      <th>WHEP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deviceRows.map((row) => (
                      <tr key={row.deviceId}>
                        <td>{row.label}</td>
                        <td>{row.expectedIngress}</td>
                        <td>{row.meshActive ? 'yes' : 'no'}</td>
                        <td>{row.whepActive ? row.whepState ?? 'yes' : row.whepState ?? 'no'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

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
