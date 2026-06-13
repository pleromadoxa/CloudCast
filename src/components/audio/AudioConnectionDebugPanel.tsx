import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bug, ChevronDown, Copy, RefreshCw } from 'lucide-react';
import { useCloudCast } from '../../context/CloudCastContext';
import { isRealDevice } from '../../types/device';
import { cn } from '../../lib/utils';
import {
  buildDeviceConnectionDebugRow,
  formatConnectionDebugSnapshot,
  type DeviceConnectionDebugRow,
} from '../../lib/audioConnectionDebug';
import { peekWhepPoolSnapshot, reconnectWhepPoolDevice } from '../../lib/whepStreamPool';

const STORAGE_KEY = 'cloudcast-audio-debug-open';

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

function ingressLabel(path: DeviceConnectionDebugRow['expectedIngress']): string {
  if (path === 'mesh') return 'Mesh P2P';
  if (path === 'whep') return 'Regal WHEP';
  if (path === 'pending') return 'WHEP pending';
  return '—';
}

function boolMark(value: boolean): string {
  return value ? 'yes' : 'no';
}

function audioContextState(): string {
  if (typeof window === 'undefined') return 'n/a';
  const ctx = (window as Window & { __cloudcastPgmCtx?: AudioContext }).__cloudcastPgmCtx;
  return ctx?.state ?? 'not created';
}

export function AudioConnectionDebugPanel() {
  const {
    session,
    connectionMode,
    devices,
    meshStreams,
    getMeshStream,
    isPresenceConnected,
    isSignalingConnected,
    isSignalingLeader,
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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, open ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [open]);

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

  const snapshotText = useMemo(
    () =>
      formatConnectionDebugSnapshot({
        connectionMode,
        sessionId: session?.sessionId ?? null,
        accessCode: session?.accessCode ?? null,
        isPresenceConnected,
        isSignalingConnected,
        isSignalingLeader,
        devices: rows,
      }),
    [
      connectionMode,
      session?.sessionId,
      session?.accessCode,
      isPresenceConnected,
      isSignalingConnected,
      isSignalingLeader,
      rows,
    ],
  );

  const handleReconnectAll = useCallback(() => {
    reconnect();
    for (const device of liveDevices) {
      if (device.whepUrl) reconnectWhepPoolDevice(device.deviceId);
    }
  }, [liveDevices, reconnect]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(snapshotText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [snapshotText]);

  return (
    <section className="studiolive-debug">
      <button
        type="button"
        className="studiolive-debug__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Bug className="h-3.5 w-3.5" />
        <span>Audio connection</span>
        <span className="studiolive-debug__toggle-hint">mesh / WHEP diagnostics</span>
        <ChevronDown className={cn('studiolive-debug__chevron', open && 'studiolive-debug__chevron--open')} />
      </button>

      {open && (
        <div className="studiolive-debug__body">
          <div className="studiolive-debug__summary">
            <span>
              <strong>Plan path</strong> {connectionMode === 'mesh' ? 'Mesh P2P' : 'Regal Cloud (WHEP)'}
            </span>
            <span>
              <strong>Session</strong> {session?.accessCode ?? '—'}
            </span>
            <span>
              <strong>Presence</strong> {boolMark(isPresenceConnected)}
            </span>
            <span>
              <strong>Signaling</strong> {boolMark(isSignalingConnected)}
              {isSignalingLeader ? ' · leader' : ''}
            </span>
            <span>
              <strong>PGM AudioContext</strong> {audioContextState()}
            </span>
            <span>
              <strong>Streams in map</strong> {meshStreams.size}
            </span>
          </div>

          {liveDevices.length === 0 ? (
            <p className="studiolive-debug__empty">No paired devices — pair CloudCast Mobile with your access code (same code as Video Mixer).</p>
          ) : (
            <div className="studiolive-debug__table-wrap">
              <table className="studiolive-debug__table">
                <thead>
                  <tr>
                    <th>Input</th>
                    <th>Status</th>
                    <th>Ingress</th>
                    <th>WHEP</th>
                    <th>Peer</th>
                    <th>Stream</th>
                    <th>Audio</th>
                    <th>Tracks</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.deviceId}>
                      <td title={row.deviceId}>
                        <span className="studiolive-debug__label">{row.label}</span>
                        <span className="studiolive-debug__meta">{shortId(row.deviceId)} · {row.platform}</span>
                      </td>
                      <td>
                        <span className={cn('studiolive-debug__status', statusClass(row.status))}>
                          {row.status}
                        </span>
                      </td>
                      <td>{ingressLabel(row.expectedIngress)}</td>
                      <td title={row.whepError ?? undefined}>
                        {row.whepConfigured
                          ? row.whepState ?? 'not connected'
                          : 'no URL'}
                      </td>
                      <td>{row.peerState ?? '—'}</td>
                      <td>{boolMark(row.streamInMap)}</td>
                      <td className={row.usableAudio ? 'studiolive-debug__ok' : 'studiolive-debug__warn'}>
                        {boolMark(row.usableAudio)} ({row.audioTracks}a/{row.videoTracks}v)
                      </td>
                      <td>
                        {row.tracks.length === 0 ? (
                          '—'
                        ) : (
                          <span className="studiolive-debug__tracks" title={row.tracks.map((t) => `${t.kind}:${t.readyState}`).join(', ')}>
                            {row.tracks.map((t) => `${t.kind[0]}:${t.readyState[0]}`).join(' ')}
                          </span>
                        )}
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
                  ))}
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
              {copied ? 'Copied' : 'Copy snapshot'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
