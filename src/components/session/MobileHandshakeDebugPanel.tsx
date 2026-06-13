import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bug, ChevronDown, Copy, RefreshCw } from 'lucide-react';
import { useCloudCast } from '../../context/CloudCastContext';
import { isRealDevice } from '../../types/device';
import { cn } from '../../lib/utils';
import {
  buildDeviceConnectionDebugRow,
  type DeviceConnectionDebugRow,
} from '../../lib/audioConnectionDebug';
import { peekWhepPoolSnapshot, reconnectWhepPoolDevice } from '../../lib/whepStreamPool';
import {
  buildHandshakeDebugSnapshot,
  checklistStorageKey,
  evaluateDeviceHandshakeHealth,
  formatHandshakeDebugSnapshot,
  type HandshakeHealth,
  type LiveTestSection,
} from '../../lib/handshakeDebug';

const STORAGE_KEY = 'cloudcast-handshake-debug-open';

function shortId(id: string): string {
  if (id.length <= 10) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function statusClass(status: DeviceConnectionDebugRow['status']): string {
  if (status === 'live') return 'studiolive-debug__status--live';
  if (status === 'connecting') return 'studiolive-debug__status--connecting';
  if (status === 'error') return 'studiolive-debug__status--error';
  return 'studiolive-debug__status--offline';
}

function healthClass(health: HandshakeHealth): string {
  if (health === 'ok') return 'handshake-debug__health--ok';
  if (health === 'warn') return 'handshake-debug__health--warn';
  if (health === 'fail') return 'handshake-debug__health--fail';
  return 'handshake-debug__health--idle';
}

function ingressLabel(path: DeviceConnectionDebugRow['expectedIngress']): string {
  if (path === 'mesh') return 'Mesh P2P';
  if (path === 'whep') return 'Regal WHEP';
  if (path === 'pending') return 'WHEP pending';
  return '—';
}

function boolMark(value: boolean): string {
  return value ? 'yes' : 'no';
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

interface MobileHandshakeDebugPanelProps {
  /** When true, marks the Audio Mixer route step as satisfied in the checklist. */
  audioConsoleActive?: boolean;
  className?: string;
}

export function MobileHandshakeDebugPanel({
  audioConsoleActive = false,
  className,
}: MobileHandshakeDebugPanelProps) {
  const {
    session,
    connectionMode,
    devices,
    meshStreams,
    getMeshStream,
    isPresenceConnected,
    isSignalingConnected,
    isSignalingLeader,
    signalingEvents,
    reconnect,
  } = useCloudCast();

  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [tick, setTick] = useState(0);
  const [copied, setCopied] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const checklistKey = checklistStorageKey(session?.sessionId);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, open ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [open]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(checklistKey);
      setChecked(raw ? (JSON.parse(raw) as Record<string, boolean>) : {});
    } catch {
      setChecked({});
    }
  }, [checklistKey]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(timer);
  }, [open]);

  const liveDevices = useMemo(() => devices.filter(isRealDevice), [devices]);

  const rows = useMemo(
    () =>
      liveDevices.map((device) =>
        buildDeviceConnectionDebugRow(
          device,
          connectionMode,
          getMeshStream(device.deviceId),
          peekWhepPoolSnapshot(device.deviceId),
        ),
      ),
    [liveDevices, connectionMode, getMeshStream, meshStreams, tick],
  );

  const snapshot = useMemo(
    () =>
      buildHandshakeDebugSnapshot({
        session,
        connectionMode,
        isPresenceConnected,
        isSignalingConnected,
        isSignalingLeader,
        deviceRows: rows,
        signalingEvents,
        audioConsoleActive,
      }),
    [
      session,
      connectionMode,
      isPresenceConnected,
      isSignalingConnected,
      isSignalingLeader,
      rows,
      signalingEvents,
      audioConsoleActive,
    ],
  );

  const toggleCheck = useCallback(
    (stepId: string) => {
      setChecked((prev) => {
        const next = { ...prev, [stepId]: !prev[stepId] };
        try {
          localStorage.setItem(checklistKey, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [checklistKey],
  );

  const handleReconnectAll = useCallback(() => {
    reconnect();
    for (const device of liveDevices) {
      if (device.whepUrl) reconnectWhepPoolDevice(device.deviceId);
    }
  }, [liveDevices, reconnect]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(formatHandshakeDebugSnapshot(snapshot));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [snapshot]);

  const renderChecklistSection = (section: LiveTestSection) => (
    <div key={section.title} className="handshake-debug__checklist-section">
      <p className="handshake-debug__checklist-title">{section.title}</p>
      <ul className="handshake-debug__checklist">
        {section.steps.map((step) => {
          const done = checked[step.id] || step.autoPass;
          return (
            <li key={step.id} className="handshake-debug__checklist-item">
              <label className="handshake-debug__checklist-label">
                <input
                  type="checkbox"
                  checked={Boolean(done)}
                  onChange={() => toggleCheck(step.id)}
                />
                <span className={cn(done && 'handshake-debug__checklist-done')}>{step.label}</span>
              </label>
              <span className="handshake-debug__checklist-hint">{step.hint}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <section className={cn('studiolive-debug handshake-debug', className)}>
      <button
        type="button"
        className="studiolive-debug__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Bug className="h-3.5 w-3.5" />
        <span>Mobile handshake</span>
        <span className="studiolive-debug__toggle-hint">pairing · signaling · live test</span>
        <ChevronDown className={cn('studiolive-debug__chevron', open && 'studiolive-debug__chevron--open')} />
      </button>

      {open && (
        <div className="studiolive-debug__body">
          <div className="studiolive-debug__summary">
            <span>
              <strong>Plan path</strong> {connectionMode === 'mesh' ? 'Regal Mesh (Free)' : 'Regal Cloud (Pro+)'}
            </span>
            <span>
              <strong>Access code</strong> {session?.accessCode ?? '—'}
            </span>
            <span>
              <strong>Channel</strong> {snapshot.realtimeChannel ?? '—'}
            </span>
            <span>
              <strong>Supabase</strong> {snapshot.supabaseHost}
            </span>
            <span>
              <strong>Presence</strong> {boolMark(isPresenceConnected)}
            </span>
            <span>
              <strong>Signaling</strong> {boolMark(isSignalingConnected)}
              {isSignalingLeader ? ' · leader' : ' · follower'}
            </span>
            <span>
              <strong>Streams in map</strong> {meshStreams.size}
            </span>
          </div>

          <div className="handshake-debug__checklist-wrap">
            <p className="handshake-debug__section-heading">Live test checklist</p>
            <p className="handshake-debug__section-note">
              Steps auto-check when the dashboard detects success. Toggle manually for reload / mobile-side steps.
            </p>
            {snapshot.checklist.map(renderChecklistSection)}
          </div>

          <p className="handshake-debug__section-heading">Signaling log (recent)</p>
          {snapshot.signalingLog.length === 0 ? (
            <p className="studiolive-debug__empty">
              No offers yet — pair CloudCast Mobile and tap Go Live to start the handshake.
            </p>
          ) : (
            <div className="studiolive-debug__table-wrap">
              <table className="studiolive-debug__table handshake-debug__events-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Event</th>
                    <th>Device</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.signalingLog.map((entry, index) => (
                    <tr key={`${entry.at}-${entry.event}-${index}`}>
                      <td>{formatTime(entry.at)}</td>
                      <td><code>{entry.event}</code></td>
                      <td title={entry.deviceId}>{shortId(entry.deviceId)}</td>
                      <td>{entry.detail || entry.from}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="handshake-debug__section-heading">Paired devices</p>
          {liveDevices.length === 0 ? (
            <p className="studiolive-debug__empty">
              No paired devices — enter your access code in CloudCast Mobile (same code as this dashboard).
            </p>
          ) : (
            <div className="studiolive-debug__table-wrap">
              <table className="studiolive-debug__table">
                <thead>
                  <tr>
                    <th>Input</th>
                    <th>Health</th>
                    <th>Status</th>
                    <th>Ingress</th>
                    <th>WHEP</th>
                    <th>Peer</th>
                    <th>Stream</th>
                    <th>Audio</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const health = evaluateDeviceHandshakeHealth(row, connectionMode);
                    return (
                      <tr key={row.deviceId}>
                        <td title={row.deviceId}>
                          <span className="studiolive-debug__label">{row.label}</span>
                          <span className="studiolive-debug__meta">{shortId(row.deviceId)} · {row.platform}</span>
                        </td>
                        <td>
                          <span
                            className={cn('handshake-debug__health', healthClass(health.health))}
                            title={health.reason}
                          >
                            {health.health}
                          </span>
                        </td>
                        <td>
                          <span className={cn('studiolive-debug__status', statusClass(row.status))}>
                            {row.status}
                          </span>
                        </td>
                        <td>{ingressLabel(row.expectedIngress)}</td>
                        <td title={row.whepError ?? undefined}>
                          {row.whepConfigured ? row.whepState ?? 'not connected' : 'no URL'}
                        </td>
                        <td>{row.peerState ?? '—'}</td>
                        <td>{boolMark(row.streamInMap)} ({row.videoTracks}v)</td>
                        <td className={row.usableAudio ? 'studiolive-debug__ok' : 'studiolive-debug__warn'}>
                          {boolMark(row.usableAudio)} ({row.audioTracks}a)
                        </td>
                        <td>
                          <button
                            type="button"
                            className="studiolive-debug__row-btn"
                            title="Reconnect this device"
                            onClick={() => {
                              reconnect();
                              if (row.whepConfigured) reconnectWhepPoolDevice(row.deviceId);
                            }}
                          >
                            <RefreshCw className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="studiolive-debug__actions">
            <button type="button" className="studiolive-debug__action" onClick={handleReconnectAll}>
              <RefreshCw className="h-3 w-3" />
              Reconnect all
            </button>
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
