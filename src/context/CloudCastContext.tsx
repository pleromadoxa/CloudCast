import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { SIGNALING_EVENTS } from '../lib/constants';
import { pcConfigForMode } from '../lib/meshConfig';
import { releaseAllWhepPool } from '../lib/whepStreamPool';
import { connectAudioIngressWhep, releaseAllAudioIngressWhep, useAudioIngressStreams } from '../lib/audioIngress';
import { streamHasActiveMedia, hasUsableAudio, hasUsableVideo } from '../lib/streamAudioHub';
import { releaseAllIpCameraPool } from '../lib/ipCameraStreamPool';
import { holdSignalingLeader } from '../lib/tabLeader';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import {
  clearStoredSession,
  getPairingSessionProduct,
  loadStoredSession,
  saveStoredSession,
  type SessionProduct,
} from '../lib/sessionStorage';
import {
  DEVICE_STATUS_SWEEP_MS,
  deviceHasCloudPlayback,
  isDashboardPresenceKey,
  isMeshStreamPresent,
  presenceDeviceIds,
  reconcileDeviceConnectivity,
} from '../lib/deviceConnection';
import {
  buildSessionChannelConfig,
  getDashboardPresenceKey,
  removeRealtimeChannel,
  removeSessionChannelByName,
  resolveRealtimeChannelName,
} from '../lib/realtimeChannel';
import {
  onRealtimeRecoveryNeeded,
  REALTIME_HEALTH_CHECK_MS,
  REALTIME_PUSH_TIMEOUT_MS,
  REALTIME_RECOVER_COOLDOWN_MS,
  realtimeRetryDelayMs,
} from '../lib/realtimeConfig';
import { waitForIceGathering } from '../lib/utils';
import {
  createConcurrencyQueue,
  createKeyedChain,
} from '../lib/signalingQueue';
import {
  fetchPairedDevices,
  getOrCreateOwnerSession,
  pairedRowToDevice,
  regenerateAccessCode,
  restoreMixerSession,
  syncMixerSessionPlan,
  unpairDevice as unpairDeviceRpc,
  updatePairedDeviceStatus,
} from '../lib/sessionService';
import { useAuth } from '../context/AuthContext';
import { resolveProductPlan } from '../lib/productEntitlements';
import { normalizeConnectionMode } from '../lib/branding';
import type { ConnectionMode } from '../types/plans';
import type { Device } from '../types/device';
import { createEmptyAudioSlot, createEmptySlot } from '../types/device';
import { AUDIO_MIXER_MAX_CHANNELS } from '../config/products';
import type { MixerSession, PairedDeviceRow } from '../types/session';
import type {
  AnswerPayload,
  IcePayload,
  OfferPayload,
  SignalingEvent,
  StreamReadyPayload,
  StreamStoppedPayload,
} from '../types/signaling';

const MAX_PENDING_ICE = 50;
const MAX_CONCURRENT_ANSWERS = 4;
const DEVICE_ACK_RETRY_MS = [400, 1000, 2000, 4000];
const PEER_DISCONNECT_GRACE_MS = 5000;
const PRESENCE_LEAVE_GRACE_MS = 3000;
const PRESENCE_LEAVE_FAST_MS = 1200;
const ICE_RESTART_DELAY_MS = 600;
const MESH_REOFFER_COOLDOWN_MS = 1200;
const LOAD_DEVICES_DEBOUNCE_MS = 400;
const PRESENCE_SNAPSHOT_DEBOUNCE_MS = 200;

interface CloudCastContextValue {
  session: MixerSession | null;
  sessionLoading: boolean;
  devices: Device[];
  connectionMode: ConnectionMode;
  meshStreams: Map<string, MediaStream>;
  getMeshStream: (deviceId: string) => MediaStream | null;
  isPresenceConnected: boolean;
  isSignalingConnected: boolean;
  isSignalingLeader: boolean;
  signalingEvents: SignalingEvent[];
  error: string | null;
  /** Reload paired-device list without tearing down live mesh feeds. */
  refreshDevices: () => void;
  reconnect: () => void;
  regenerateCode: () => Promise<void>;
  isRegenerating: boolean;
  unpairDevice: (deviceId: string) => Promise<void>;
}

const CloudCastContext = createContext<CloudCastContextValue | null>(null);

function buildSlotDevices(
  rows: PairedDeviceRow[],
  maxSlots: number,
  productType: SessionProduct = 'video',
): Device[] {
  const emptySlot = productType === 'audio' ? createEmptyAudioSlot : createEmptySlot;
  const bySlot = new Map(rows.map((r) => [r.slot_number, pairedRowToDevice(r)]));
  return Array.from({ length: maxSlots }, (_, i) => {
    const slot = i + 1;
    return bySlot.get(slot) ?? emptySlot(slot);
  });
}

export function CloudCastProvider({
  children,
  productType = 'video',
  audioMixerActive = false,
}: {
  children: ReactNode;
  productType?: SessionProduct;
  /** Keep audio ingress alive while the audio console runs off-route inside ProductionHost. */
  audioMixerActive?: boolean;
}) {
  const { profile, user, loading: authLoading } = useAuth();
  const audioIngressEnabled = productType === 'audio' || audioMixerActive;
  const audioIngressEnabledRef = useRef(audioIngressEnabled);
  audioIngressEnabledRef.current = audioIngressEnabled;
  const initialSlotCount = productType === 'audio' ? AUDIO_MIXER_MAX_CHANNELS : 2;
  const emptySlot = productType === 'audio' ? createEmptyAudioSlot : createEmptySlot;
  const [session, setSession] = useState<MixerSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [devices, setDevices] = useState<Device[]>(() =>
    Array.from({ length: initialSlotCount }, (_, i) => emptySlot(i + 1)),
  );
  const [meshStreams, setMeshStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isPresenceConnected, setIsPresenceConnected] = useState(false);
  const [isSignalingConnected, setIsSignalingConnected] = useState(false);
  const [isSignalingLeader, setIsSignalingLeader] = useState(true);
  const [signalingEvents, setSignalingEvents] = useState<SignalingEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const dbChannelRef = useRef<RealtimeChannel | null>(null);
  const peerConnections = useRef(new Map<string, RTCPeerConnection>());
  const pendingIce = useRef(new Map<string, RTCIceCandidateInit[]>());
  const sessionRef = useRef<MixerSession | null>(null);
  const meshStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const isSignalingLeaderRef = useRef(true);
  const ackedPeersRef = useRef(new Set<string>());
  const ackRetryTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>[]>());
  const peerDisconnectTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const presenceLeaveTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const offerInflightRef = useRef(new Map<string, Promise<void>>());
  const wasSignalingLeaderRef = useRef(true);
  const presenceSnapshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answerQueueRef = useRef(createConcurrencyQueue(MAX_CONCURRENT_ANSWERS));
  const iceChainRef = useRef(createKeyedChain());
  const dbSessionIdRef = useRef<string | null>(null);
  const dashboardPresenceKeyRef = useRef('dashboard');
  const loadDevicesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadDevicesInflightRef = useRef<Promise<void> | null>(null);
  const realtimeRetryRef = useRef(0);
  const realtimeRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signalingEpochRef = useRef(0);
  const dbChannelEpochRef = useRef(0);
  const lastRecoverAtRef = useRef(0);
  const connectRealtimeRef = useRef<(s: MixerSession) => void>(() => {});
  const subscribeDbChangesRef = useRef<(s: MixerSession) => void>(() => {});
  const signalingTeardownRef = useRef(Promise.resolve());
  const dbTeardownRef = useRef(Promise.resolve());
  const connectRealtimeChainRef = useRef(Promise.resolve());
  const subscribeDbChainRef = useRef(Promise.resolve());
  const lastMeshReofferAtRef = useRef(0);
  const initSessionInflightRef = useRef<Promise<void> | null>(null);
  const connectingSinceRef = useRef(new Map<string, number>());
  sessionRef.current = session;
  isSignalingLeaderRef.current = isSignalingLeader;

  const connectionMode: ConnectionMode =
    productType === 'audio'
      ? 'mesh'
      : normalizeConnectionMode(session?.connectionMode ?? 'mesh');

  /** Session plan connection mode — used for Regal Cloud WHEP fallback on the audio dashboard. */
  const sessionConnectionMode: ConnectionMode = normalizeConnectionMode(session?.connectionMode ?? 'mesh');

  const getMeshStream = useCallback(
    (deviceId: string) => meshStreams.get(deviceId) ?? null,
    [meshStreams],
  );

  const setMeshStream = useCallback((deviceId: string, stream: MediaStream) => {
    meshStreamsRef.current.set(deviceId, stream);
    setMeshStreams(new Map(meshStreamsRef.current));
  }, []);

  const removeMeshStream = useCallback((deviceId: string) => {
    const existing = meshStreamsRef.current.get(deviceId);
    existing?.getTracks().forEach((t) => t.stop());
    meshStreamsRef.current.delete(deviceId);
    setMeshStreams(new Map(meshStreamsRef.current));
  }, []);

  const appendEvent = useCallback((event: SignalingEvent) => {
    setSignalingEvents((prev) => [event, ...prev].slice(0, 100));
  }, []);

  const resolvePeerState = useCallback((deviceId: string) => {
    return peerConnections.current.get(deviceId)?.connectionState;
  }, []);

  const buildDeviceReconcileContext = useCallback(
    (device: Device, online: Set<string>, nowMs: number) => {
      const meshStream = meshStreamsRef.current.get(device.deviceId);
      return {
        presenceOnline: online.has(device.deviceId),
        hasMeshStream: isMeshStreamPresent(meshStream),
        hasMeshVideo: hasUsableVideo(meshStream),
        peerState: resolvePeerState(device.deviceId),
        connectingSinceMs: connectingSinceRef.current.get(device.deviceId) ?? null,
        nowMs,
        videoTransport:
          sessionRef.current?.connectionMode === 'regal'
            ? ('cloud' as const)
            : ('mesh' as const),
      };
    },
    [resolvePeerState],
  );

  const loadDevicesImmediate = useCallback(async (s: MixerSession) => {
    if (loadDevicesInflightRef.current) return loadDevicesInflightRef.current;

    const promise = (async () => {
      const rows = await fetchPairedDevices(s.sessionId, s.accessCode);
      const online = channelRef.current ? presenceDeviceIds(channelRef.current) : new Set<string>();
      const nowMs = Date.now();
      const slotCount =
        productType === 'audio' ? AUDIO_MIXER_MAX_CHANNELS : s.maxDevices;
      const merged = buildSlotDevices(rows, slotCount, productType).map((d) => {
        const reconciled = reconcileDeviceConnectivity(
          d,
          buildDeviceReconcileContext(d, online, nowMs),
        );
        if (
          reconciled.status === 'connecting' &&
          !connectingSinceRef.current.has(reconciled.deviceId)
        ) {
          connectingSinceRef.current.set(reconciled.deviceId, nowMs);
        }
        return reconciled;
      });
      setDevices(merged);
      setSession((prev) => {
        if (!prev || prev.deviceCount === rows.length) return prev;
        return { ...prev, deviceCount: rows.length };
      });
    })();

    loadDevicesInflightRef.current = promise;
    try {
      await promise;
    } finally {
      if (loadDevicesInflightRef.current === promise) {
        loadDevicesInflightRef.current = null;
      }
    }
  }, [productType, buildDeviceReconcileContext]);

  const scheduleLoadDevices = useCallback(
    (s: MixerSession) => {
      if (loadDevicesTimerRef.current) {
        clearTimeout(loadDevicesTimerRef.current);
      }
      loadDevicesTimerRef.current = setTimeout(() => {
        loadDevicesTimerRef.current = null;
        void loadDevicesImmediate(s);
      }, LOAD_DEVICES_DEBOUNCE_MS);
    },
    [loadDevicesImmediate],
  );

  const patchDevice = useCallback(
    (deviceId: string, patch: Partial<Device>) => {
      setDevices((prev) =>
        prev.map((d) =>
          d.deviceId === deviceId
            ? { ...d, ...patch, updatedAt: new Date().toISOString() }
            : d,
        ),
      );
    },
    [],
  );

  const syncDeviceStatusToDb = useCallback(
    (deviceId: string, status: Device['status']) => {
      const s = sessionRef.current;
      if (!s) return;
      void updatePairedDeviceStatus(s.accessCode, deviceId, status).catch(() => {
        /* local UI already updated — DB catch-up is best-effort */
      });
    },
    [],
  );

  const markDeviceOffline = useCallback(
    (deviceId: string) => {
      connectingSinceRef.current.delete(deviceId);
      removeMeshStream(deviceId);
      patchDevice(deviceId, {
        status: 'offline',
        isOnline: false,
        connectionState: 'disconnected',
        lastSeenAt: new Date().toISOString(),
      });
      syncDeviceStatusToDb(deviceId, 'offline');
    },
    [patchDevice, syncDeviceStatusToDb, removeMeshStream],
  );

  const markDeviceConnecting = useCallback(
    (deviceId: string) => {
      if (!connectingSinceRef.current.has(deviceId)) {
        connectingSinceRef.current.set(deviceId, Date.now());
      }
      setDevices((prev) =>
        prev.map((d) => {
          if (d.deviceId !== deviceId) return d;
          const keepConnected = d.connectionState === 'connected';
          return {
            ...d,
            status: 'connecting',
            isOnline: true,
            connectionState: keepConnected ? 'connected' : 'connecting',
            lastSeenAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }),
      );
      syncDeviceStatusToDb(deviceId, 'connecting');
    },
    [syncDeviceStatusToDb],
  );

  const markDeviceLinked = useCallback(
    (deviceId: string) => {
      patchDevice(deviceId, {
        status: 'connecting',
        isOnline: true,
        connectionState: 'connected',
        lastSeenAt: new Date().toISOString(),
      });
      syncDeviceStatusToDb(deviceId, 'connecting');
    },
    [patchDevice, syncDeviceStatusToDb],
  );

  const markDeviceLive = useCallback(
    (deviceId: string) => {
      connectingSinceRef.current.delete(deviceId);
      patchDevice(deviceId, {
        status: 'live',
        isOnline: true,
        connectionState: 'connected',
        lastSeenAt: new Date().toISOString(),
      });
      syncDeviceStatusToDb(deviceId, 'live');
    },
    [patchDevice, syncDeviceStatusToDb],
  );

  const attachStreamWatchers = useCallback(
    (deviceId: string, stream: MediaStream) => {
      const checkEnded = () => {
        if (stream.getTracks().length === 0 || stream.getTracks().every((t) => t.readyState === 'ended')) {
          markDeviceOffline(deviceId);
        }
      };
      stream.getTracks().forEach((track) => {
        track.onended = checkEnded;
      });
    },
    [markDeviceOffline],
  );

  const publishDeviceStream = useCallback(
    (deviceId: string, stream: MediaStream) => {
      setMeshStream(deviceId, stream);
      attachStreamWatchers(deviceId, stream);

      const syncStatus = () => {
        const mode = sessionRef.current?.connectionMode ?? 'mesh';
        const isRegal = mode === 'regal';
        const hasVideo = hasUsableVideo(stream);
        const hasAudio = hasUsableAudio(stream);

        if (isRegal) {
          if (hasVideo) {
            markDeviceLive(deviceId);
            return;
          }
          if (hasAudio) {
            markDeviceLinked(deviceId);
            return;
          }
          markDeviceConnecting(deviceId);
          return;
        }

        const requireAudio = audioIngressEnabledRef.current;
        if (!streamHasActiveMedia(stream, { requireAudio })) {
          markDeviceConnecting(deviceId);
          return;
        }
        markDeviceLive(deviceId);
      };

      syncStatus();
      stream.addEventListener('addtrack', syncStatus);
      stream.addEventListener('removetrack', syncStatus);
    },
    [setMeshStream, attachStreamWatchers, markDeviceLive, markDeviceConnecting, markDeviceLinked],
  );

  const broadcast = useCallback((event: string, payload: unknown) => {
    channelRef.current?.send({ type: 'broadcast', event, payload });
  }, []);

  const requestMeshReoffer = useCallback(
    (reason = 'dashboard-reconnect', options?: { bypassCooldown?: boolean; deviceId?: string }) => {
      if (!isSignalingLeaderRef.current || !channelRef.current) return;

      const now = Date.now();
      if (
        !options?.bypassCooldown &&
        now - lastMeshReofferAtRef.current < MESH_REOFFER_COOLDOWN_MS
      ) {
        return;
      }
      lastMeshReofferAtRef.current = now;

      broadcast(SIGNALING_EVENTS.REQUEST_REOFFER, {
        from: dashboardPresenceKeyRef.current,
        deviceId: options?.deviceId,
        timestamp: new Date().toISOString(),
        reason,
      });
    },
    [broadcast],
  );

  const pruneDeadMeshStreams = useCallback(() => {
    let pruned = false;
    meshStreamsRef.current.forEach((stream, deviceId) => {
      const tracks = stream.getTracks();
      if (tracks.length === 0 || tracks.every((track) => track.readyState === 'ended')) {
        tracks.forEach((track) => track.stop());
        meshStreamsRef.current.delete(deviceId);
        pruned = true;
      }
    });
    if (pruned) {
      setMeshStreams(new Map(meshStreamsRef.current));
    }
    return pruned;
  }, []);

  const applyPresenceSnapshot = useCallback(
    (channel?: RealtimeChannel | null) => {
      pruneDeadMeshStreams();
      const online = channel ? presenceDeviceIds(channel) : new Set<string>();
      const nowMs = Date.now();

      let missingLiveStream = false;

      setDevices((prev) => {
        const next = prev.map((d) =>
          reconcileDeviceConnectivity(d, buildDeviceReconcileContext(d, online, nowMs)),
        );

        next.forEach((d, index) => {
          const before = prev[index];
          if (d.status === 'connecting' && !connectingSinceRef.current.has(d.deviceId)) {
            connectingSinceRef.current.set(d.deviceId, nowMs);
          }
          if (
            before.deviceId === d.deviceId &&
            !d.deviceId.startsWith('slot-') &&
            before.status !== d.status
          ) {
            syncDeviceStatusToDb(d.deviceId, d.status);
          }
        });

        if (channel && sessionRef.current) {
          const videoTransport =
            sessionRef.current.connectionMode === 'regal' ? 'cloud' : 'mesh';
          missingLiveStream = next.some((d) => {
            if (d.deviceId.startsWith('slot-') || !online.has(d.deviceId)) return false;
            const meshStream = meshStreamsRef.current.get(d.deviceId);
            if (isMeshStreamPresent(meshStream)) {
              if (videoTransport === 'mesh' || hasUsableVideo(meshStream)) return false;
            }
            if (deviceHasCloudPlayback(d, videoTransport) && d.status === 'live' && d.whepUrl) {
              return false;
            }
            const peerState = resolvePeerState(d.deviceId);
            if (d.status === 'live') return true;
            return (
              d.status === 'connecting' &&
              (!peerState || peerState === 'failed' || peerState === 'closed')
            );
          });
        }

        return next;
      });

      if (missingLiveStream) {
        requestMeshReoffer('missing-mesh-stream', { bypassCooldown: true });
      }
    },
    [pruneDeadMeshStreams, syncDeviceStatusToDb, requestMeshReoffer, buildDeviceReconcileContext, resolvePeerState, productType],
  );

  const schedulePresenceSnapshot = useCallback(
    (channel?: RealtimeChannel | null) => {
      if (presenceSnapshotTimerRef.current) {
        clearTimeout(presenceSnapshotTimerRef.current);
      }
      presenceSnapshotTimerRef.current = setTimeout(() => {
        presenceSnapshotTimerRef.current = null;
        applyPresenceSnapshot(channel);
      }, PRESENCE_SNAPSHOT_DEBOUNCE_MS);
    },
    [applyPresenceSnapshot],
  );

  const scheduleRealtimeReconnect = useCallback((delayMs: number) => {
    if (realtimeRetryTimerRef.current) {
      clearTimeout(realtimeRetryTimerRef.current);
    }
    realtimeRetryTimerRef.current = setTimeout(() => {
      realtimeRetryTimerRef.current = null;
      if (sessionRef.current) connectRealtimeRef.current(sessionRef.current);
    }, delayMs);
  }, []);

  const isSessionChannelHealthy = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return false;
    try {
      const state = channel.state;
      if (state === 'joining') return true;
      return getSupabase().realtime.isConnected() && state === 'joined';
    } catch {
      return false;
    }
  }, []);

  const isDbChannelHealthy = useCallback(() => {
    const channel = dbChannelRef.current;
    if (!channel) return false;
    const state = channel.state;
    return state === 'joining' || state === 'joined';
  }, []);

  const teardownSignalingChannel = useCallback((options?: { preservePeers?: boolean }) => {
    signalingEpochRef.current += 1;

    if (realtimeRetryTimerRef.current) {
      clearTimeout(realtimeRetryTimerRef.current);
      realtimeRetryTimerRef.current = null;
    }

    const previousChannel = channelRef.current;
    channelRef.current = null;
    signalingTeardownRef.current = signalingTeardownRef.current
      .then(() => removeRealtimeChannel(previousChannel))
      .catch((err) => {
        console.warn('[CloudCast] Signaling channel teardown failed:', err);
      });

    if (!options?.preservePeers) {
      if (loadDevicesTimerRef.current) {
        clearTimeout(loadDevicesTimerRef.current);
        loadDevicesTimerRef.current = null;
      }
      if (presenceSnapshotTimerRef.current) {
        clearTimeout(presenceSnapshotTimerRef.current);
        presenceSnapshotTimerRef.current = null;
      }
      ackRetryTimersRef.current.forEach((timers) => timers.forEach((timer) => clearTimeout(timer)));
      ackRetryTimersRef.current.clear();
      peerDisconnectTimersRef.current.forEach((timer) => clearTimeout(timer));
      peerDisconnectTimersRef.current.clear();
      presenceLeaveTimersRef.current.forEach((timer) => clearTimeout(timer));
      presenceLeaveTimersRef.current.clear();
      offerInflightRef.current.clear();

      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();
      pendingIce.current.clear();
      ackedPeersRef.current.clear();

      meshStreamsRef.current.forEach((stream) => stream.getTracks().forEach((t) => t.stop()));
      meshStreamsRef.current.clear();
      setMeshStreams(new Map());
    } else {
      pendingIce.current.clear();
    }

    setIsPresenceConnected(false);
    setIsSignalingConnected(false);
  }, []);

  const teardownRealtime = useCallback((options?: { releaseStreams?: boolean; preservePeers?: boolean }) => {
    teardownSignalingChannel(options);

    if (loadDevicesTimerRef.current) {
      clearTimeout(loadDevicesTimerRef.current);
      loadDevicesTimerRef.current = null;
    }
    if (presenceSnapshotTimerRef.current) {
      clearTimeout(presenceSnapshotTimerRef.current);
      presenceSnapshotTimerRef.current = null;
    }

    if (dbChannelRef.current) {
      dbChannelEpochRef.current += 1;
      const previousDbChannel = dbChannelRef.current;
      dbChannelRef.current = null;
      dbTeardownRef.current = dbTeardownRef.current
        .then(() => removeRealtimeChannel(previousDbChannel))
        .catch((err) => {
          console.warn('[CloudCast] DB channel teardown failed:', err);
        });
    }
    dbSessionIdRef.current = null;

    if (options?.releaseStreams !== false) {
      releaseAllWhepPool();
      releaseAllAudioIngressWhep();
      releaseAllIpCameraPool();
    }
  }, [teardownSignalingChannel]);

  const initSession = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setSessionLoading(false);
      return;
    }
    if (!user) {
      setSession(null);
      setSessionLoading(false);
      return;
    }

    if (initSessionInflightRef.current) {
      await initSessionInflightRef.current;
      return;
    }

    const run = (async () => {
      setSessionLoading(true);
      setError(null);

      try {
        const pairingProduct = getPairingSessionProduct();
        let stored = loadStoredSession(pairingProduct);
        if (!stored) {
          const legacyAudio = loadStoredSession('audio');
          if (legacyAudio) stored = legacyAudio;
        }

        let active: MixerSession;

        if (stored) {
          if (profile?.id && stored.ownerId && stored.ownerId !== profile.id) {
            clearStoredSession(pairingProduct);
            clearStoredSession('audio');
            active = await getOrCreateOwnerSession();
          } else {
            try {
              active = await restoreMixerSession(stored.sessionId, stored.accessCode);
              active = await syncMixerSessionPlan(active.sessionId, active.accessCode);
            } catch {
              clearStoredSession(pairingProduct);
              clearStoredSession('audio');
              active = await getOrCreateOwnerSession();
            }
          }
        } else {
          active = await getOrCreateOwnerSession();
        }

        saveStoredSession(
          {
            sessionId: active.sessionId,
            accessCode: active.accessCode,
            ownerId: profile?.id ?? user.id,
          },
          pairingProduct,
        );
        clearStoredSession('audio');
        setSession(active);
        void loadDevicesImmediate(active);
      } catch (err) {
        setSession(null);
        setError(err instanceof Error ? err.message : 'Failed to initialize session');
      } finally {
        setSessionLoading(false);
      }
    })();

    initSessionInflightRef.current = run;
    try {
      await run;
    } finally {
      if (initSessionInflightRef.current === run) {
        initSessionInflightRef.current = null;
      }
    }
  }, [loadDevicesImmediate, profile?.id, user]);

  const resolveSignalingPeerKey = useCallback(
    (payload: { from?: string; deviceId?: string }) =>
      payload.from?.trim() || payload.deviceId?.trim() || '',
    [],
  );

  const resolvePeerConnection = useCallback((peerKey: string, deviceId?: string) => {
    const direct = peerConnections.current.get(peerKey);
    if (direct) return direct;
    if (deviceId) return peerConnections.current.get(deviceId);
    return undefined;
  }, []);

  const registerPeerConnection = useCallback(
    (peerKey: string, deviceId: string, pc: RTCPeerConnection) => {
      peerConnections.current.set(peerKey, pc);
      if (deviceId && deviceId !== peerKey) {
        peerConnections.current.set(deviceId, pc);
      }
    },
    [],
  );

  const clearAckRetries = useCallback((ackId: string) => {
    const timers = ackRetryTimersRef.current.get(ackId);
    if (!timers) return;
    timers.forEach((timer) => clearTimeout(timer));
    ackRetryTimersRef.current.delete(ackId);
  }, []);

  const clearPeerDisconnectTimer = useCallback((deviceId: string) => {
    const timer = peerDisconnectTimersRef.current.get(deviceId);
    if (!timer) return;
    clearTimeout(timer);
    peerDisconnectTimersRef.current.delete(deviceId);
  }, []);

  const clearPresenceLeaveTimer = useCallback((deviceId: string) => {
    const timer = presenceLeaveTimersRef.current.get(deviceId);
    if (!timer) return;
    clearTimeout(timer);
    presenceLeaveTimersRef.current.delete(deviceId);
  }, []);

  const schedulePresenceOffline = useCallback(
    (deviceId: string) => {
      if (!deviceId) return;
      clearPresenceLeaveTimer(deviceId);

      const hasMesh = isMeshStreamPresent(meshStreamsRef.current.get(deviceId));
      const pc = resolvePeerConnection(deviceId, deviceId);
      const pcNegotiating =
        pc?.connectionState === 'connecting' || pc?.connectionState === 'new';
      const graceMs = hasMesh
        ? PRESENCE_LEAVE_GRACE_MS
        : pcNegotiating
          ? PRESENCE_LEAVE_FAST_MS
          : 0;

      if (graceMs === 0) {
        markDeviceOffline(deviceId);
        return;
      }

      const timer = setTimeout(() => {
        presenceLeaveTimersRef.current.delete(deviceId);
        if (isMeshStreamPresent(meshStreamsRef.current.get(deviceId))) return;
        const livePc = resolvePeerConnection(deviceId, deviceId);
        if (livePc?.connectionState === 'connected') return;
        markDeviceOffline(deviceId);
      }, graceMs);

      presenceLeaveTimersRef.current.set(deviceId, timer);
    },
    [markDeviceOffline, resolvePeerConnection, clearPresenceLeaveTimer],
  );

  const removePeerConnection = useCallback(
    (peerKey: string, deviceId: string) => {
      clearAckRetries(deviceId || peerKey);
      clearPeerDisconnectTimer(deviceId || peerKey);
      peerConnections.current.get(peerKey)?.close();
      peerConnections.current.delete(peerKey);
      if (deviceId && deviceId !== peerKey) {
        peerConnections.current.delete(deviceId);
      }
      pendingIce.current.delete(peerKey);
      if (deviceId && deviceId !== peerKey) {
        pendingIce.current.delete(deviceId);
      }
    },
    [clearAckRetries, clearPeerDisconnectTimer],
  );

  const queueIceCandidate = useCallback((peerKey: string, candidate: RTCIceCandidateInit) => {
    const queue = pendingIce.current.get(peerKey) ?? [];
    if (queue.length >= MAX_PENDING_ICE) queue.shift();
    queue.push(candidate);
    pendingIce.current.set(peerKey, queue);
  }, []);

  const emitDeviceAck = useCallback(
    (peerKey: string, deviceId: string) => {
      const ackId = deviceId || peerKey;
      const timestamp = new Date().toISOString();
      const connectionMode = sessionRef.current?.connectionMode ?? 'mesh';
      const planId = sessionRef.current?.planId;

      const ackPayload = {
        from: dashboardPresenceKeyRef.current,
        to: peerKey,
        deviceId: ackId,
        status: 'connected' as const,
        connectionMode,
        timestamp,
      };
      broadcast(SIGNALING_EVENTS.DEVICE_ACK, ackPayload);
      if (deviceId && deviceId !== peerKey) {
        broadcast(SIGNALING_EVENTS.DEVICE_ACK, { ...ackPayload, to: deviceId });
      }
      broadcast(SIGNALING_EVENTS.DEVICE_CONNECTED, {
        from: dashboardPresenceKeyRef.current,
        to: peerKey,
        deviceId: ackId,
        timestamp,
      });
      broadcast(SIGNALING_EVENTS.PAIRING_STATUS, {
        from: dashboardPresenceKeyRef.current,
        to: peerKey,
        deviceId: ackId,
        status: 'acknowledged',
        planId,
        connectionMode,
        timestamp,
      });
      broadcast(SIGNALING_EVENTS.PAIRING_STATUS, {
        from: dashboardPresenceKeyRef.current,
        to: peerKey,
        deviceId: ackId,
        status: 'connected',
        planId,
        connectionMode,
        timestamp,
      });
    },
    [broadcast],
  );

  const sendDeviceAck = useCallback(
    (peerKey: string, deviceId: string, options?: { force?: boolean }) => {
      if (!isSignalingLeaderRef.current || !peerKey) return;

      const ackId = deviceId || peerKey;
      if (!options?.force && ackedPeersRef.current.has(ackId)) return;

      ackedPeersRef.current.add(ackId);
      clearAckRetries(ackId);
      emitDeviceAck(peerKey, deviceId);

      if (!options?.force) {
        const timers = DEVICE_ACK_RETRY_MS.map((delay) =>
          setTimeout(() => emitDeviceAck(peerKey, deviceId), delay),
        );
        ackRetryTimersRef.current.set(ackId, timers);
        markDeviceLinked(deviceId || peerKey);
      }
    },
    [emitDeviceAck, clearAckRetries, markDeviceLinked],
  );

  const absorbPeerMedia = useCallback(
    (pc: RTCPeerConnection, deviceId: string) => {
      const tracks = pc
        .getReceivers()
        .map((receiver) => receiver.track)
        .filter((track): track is MediaStreamTrack => Boolean(track && track.readyState !== 'ended'));

      if (tracks.length === 0) return;

      const stream = new MediaStream(tracks);
      publishDeviceStream(deviceId, stream);
    },
    [publishDeviceStream],
  );

  const handleMeshTrack = useCallback(
    (deviceId: string, stream: MediaStream) => {
      publishDeviceStream(deviceId, stream);
    },
    [publishDeviceStream],
  );

  const bindIngressStream = useCallback(
    (deviceId: string, stream: MediaStream) => {
      publishDeviceStream(deviceId, stream);
    },
    [publishDeviceStream],
  );

  const createPeerConnection = useCallback(
    (peerKey: string, deviceId: string) => {
      const streamDeviceId = deviceId || peerKey;

      if (peerConnections.current.has(peerKey) || peerConnections.current.has(streamDeviceId)) {
        removePeerConnection(peerKey, streamDeviceId);
        ackedPeersRef.current.delete(streamDeviceId);
        removeMeshStream(streamDeviceId);
      }

      // Mobile mesh signaling always uses P2P ICE — independent of Regal Cloud video ingest.
      const pc = new RTCPeerConnection(pcConfigForMode('mesh'));

      try {
        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });
      } catch {
        /* browser may negotiate from remote offer */
      }

      const cleanupPeer = () => {
        ackedPeersRef.current.delete(streamDeviceId);
        removeMeshStream(streamDeviceId);
        removePeerConnection(peerKey, streamDeviceId);
        markDeviceOffline(streamDeviceId);
      };

      pc.ontrack = () => {
        absorbPeerMedia(pc, streamDeviceId);
        sendDeviceAck(peerKey, streamDeviceId);
      };

      pc.onicecandidate = (ev) => {
        if (!ev.candidate || !isSignalingLeaderRef.current) return;
        broadcast(SIGNALING_EVENTS.ICE, {
          from: dashboardPresenceKeyRef.current,
          to: peerKey,
          deviceId: streamDeviceId,
          streamId: '',
          timestamp: new Date().toISOString(),
          candidate: ev.candidate.toJSON(),
        });
      };

      pc.onconnectionstatechange = () => {
        patchDevice(streamDeviceId, { connectionState: pc.connectionState });

        if (pc.connectionState === 'connected') {
          clearPeerDisconnectTimer(streamDeviceId);
          sendDeviceAck(peerKey, streamDeviceId);
          markDeviceLinked(streamDeviceId);
          if (!isMeshStreamPresent(meshStreamsRef.current.get(streamDeviceId))) {
            absorbPeerMedia(pc, streamDeviceId);
          }
          if (!isMeshStreamPresent(meshStreamsRef.current.get(streamDeviceId))) {
            let attempts = 0;
            const retryAbsorb = () => {
              if (pc.connectionState !== 'connected') return;
              if (isMeshStreamPresent(meshStreamsRef.current.get(streamDeviceId))) return;
              if (attempts >= 12) return;
              attempts += 1;
              absorbPeerMedia(pc, streamDeviceId);
              setTimeout(retryAbsorb, 400);
            };
            setTimeout(retryAbsorb, 400);
            window.setTimeout(() => {
              if (pc.connectionState !== 'connected') return;
              if (isMeshStreamPresent(meshStreamsRef.current.get(streamDeviceId))) return;
              requestMeshReoffer('connected-no-media', {
                deviceId: streamDeviceId,
                bypassCooldown: true,
              });
            }, 2500);
          }
        } else if (pc.connectionState === 'connecting') {
          clearPeerDisconnectTimer(streamDeviceId);
          markDeviceConnecting(streamDeviceId);
        } else if (pc.connectionState === 'disconnected') {
          if (!peerDisconnectTimersRef.current.has(streamDeviceId)) {
            window.setTimeout(() => {
              if (pc.connectionState === 'disconnected' && pc.restartIce) {
                try {
                  pc.restartIce();
                } catch {
                  /* ignore */
                }
              }
            }, ICE_RESTART_DELAY_MS);

            const timer = setTimeout(() => {
              peerDisconnectTimersRef.current.delete(streamDeviceId);
              if (
                pc.connectionState === 'disconnected' ||
                pc.connectionState === 'failed'
              ) {
                cleanupPeer();
              }
            }, PEER_DISCONNECT_GRACE_MS);
            peerDisconnectTimersRef.current.set(streamDeviceId, timer);
          }
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          clearPeerDisconnectTimer(streamDeviceId);
          cleanupPeer();
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed') {
          pc.restartIce?.();
        } else if (pc.iceConnectionState === 'disconnected') {
          window.setTimeout(() => {
            if (pc.iceConnectionState === 'disconnected') {
              pc.restartIce?.();
            }
          }, ICE_RESTART_DELAY_MS);
        }
      };

      registerPeerConnection(peerKey, streamDeviceId, pc);
      return pc;
    },
    [
      broadcast,
      handleMeshTrack,
      removeMeshStream,
      sendDeviceAck,
      patchDevice,
      markDeviceOffline,
      markDeviceConnecting,
      markDeviceLinked,
      removePeerConnection,
      registerPeerConnection,
      clearPeerDisconnectTimer,
      absorbPeerMedia,
      requestMeshReoffer,
    ],
  );

  const drainPendingIce = useCallback(async (pc: RTCPeerConnection, ...keys: string[]) => {
    const seen = new Set<string>();
    for (const key of keys) {
      if (!key) continue;
      const queued = pendingIce.current.get(key) ?? [];
      for (const candidate of queued) {
        const sig = JSON.stringify(candidate);
        if (seen.has(sig)) continue;
        seen.add(sig);
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingIce.current.delete(key);
    }
  }, []);

  const createAnswerForOffer = useCallback(
    async (offer: OfferPayload) => {
      if (!isSignalingLeaderRef.current) return;

      const peerKey = resolveSignalingPeerKey(offer);
      const deviceId = offer.deviceId?.trim() || offer.from?.trim() || peerKey;
      if (!peerKey) return;

      const inflightKey = deviceId || peerKey;
      const answerOffer = async () => {
        const existingPc = resolvePeerConnection(peerKey, deviceId);
        if (
          existingPc?.connectionState === 'connected' &&
          isMeshStreamPresent(meshStreamsRef.current.get(deviceId))
        ) {
          sendDeviceAck(peerKey, deviceId, { force: true });
          return;
        }

        try {
          const pc = createPeerConnection(peerKey, deviceId);
          await pc.setRemoteDescription({ type: offer.type, sdp: offer.sdp });

          await drainPendingIce(pc, peerKey, deviceId);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await waitForIceGathering(pc, 800);

          const local = pc.localDescription ?? answer;
          broadcast(SIGNALING_EVENTS.ANSWER, {
            from: dashboardPresenceKeyRef.current,
            to: peerKey,
            deviceId,
            streamId: offer.streamId,
            timestamp: new Date().toISOString(),
            sdp: local.sdp!,
            type: local.type,
          });
        } catch (err) {
          console.error('[CloudCast] Failed to answer offer:', err);
          ackedPeersRef.current.delete(deviceId);
          removeMeshStream(deviceId);
          removePeerConnection(peerKey, deviceId);
        }
      };

      const prev = offerInflightRef.current.get(inflightKey);
      const chained = prev ? prev.then(() => answerOffer()) : answerOffer();
      offerInflightRef.current.set(
        inflightKey,
        chained.finally(() => {
          if (offerInflightRef.current.get(inflightKey) === chained) {
            offerInflightRef.current.delete(inflightKey);
          }
        }),
      );
      await answerQueueRef.current(() => chained);
    },
    [
      createPeerConnection,
      broadcast,
      removeMeshStream,
      resolveSignalingPeerKey,
      resolvePeerConnection,
      sendDeviceAck,
      removePeerConnection,
      drainPendingIce,
    ],
  );

  const connectRealtime = useCallback(
    (s: MixerSession) => {
      connectRealtimeChainRef.current = connectRealtimeChainRef.current
        .then(async () => {
          const hadActivePeers =
            peerConnections.current.size > 0 || meshStreamsRef.current.size > 0;

          teardownSignalingChannel({ preservePeers: true });
          await signalingTeardownRef.current;
          await removeSessionChannelByName(s.sessionId, s.realtimeChannel);

          const subscribeEpoch = signalingEpochRef.current;
          if (sessionRef.current?.sessionId !== s.sessionId) return;

          const channelName = resolveRealtimeChannelName(s.sessionId, s.realtimeChannel);
          const dashboardPresenceKey = getDashboardPresenceKey(s.sessionId);
          dashboardPresenceKeyRef.current = dashboardPresenceKey;
          const supabase = getSupabase();

          const channel = supabase.channel(channelName, buildSessionChannelConfig(dashboardPresenceKey));

          channel
        .on('broadcast', { event: SIGNALING_EVENTS.OFFER }, ({ payload }) => {
          const p = payload as OfferPayload;
          appendEvent({ event: 'offer', payload: p });
          if (sessionRef.current) scheduleLoadDevices(sessionRef.current);
          void createAnswerForOffer(p);
        })
        .on('broadcast', { event: SIGNALING_EVENTS.ANSWER }, ({ payload }) => {
          appendEvent({ event: 'answer', payload: payload as AnswerPayload });
        })
        .on('broadcast', { event: SIGNALING_EVENTS.ICE }, ({ payload }) => {
          const p = payload as IcePayload;
          appendEvent({ event: 'ice', payload: p });
          if (!isSignalingLeaderRef.current) return;

          const peerKey = resolveSignalingPeerKey(p);
          if (!peerKey) return;

          const deviceId = p.deviceId?.trim();
          const chainKey = deviceId || peerKey;

          void iceChainRef.current(chainKey, async () => {
            try {
              const pc = resolvePeerConnection(peerKey, deviceId);
              if (!pc || !pc.remoteDescription) {
                queueIceCandidate(peerKey, p.candidate);
                if (deviceId && deviceId !== peerKey) {
                  queueIceCandidate(deviceId, p.candidate);
                }
                return;
              }
              await pc.addIceCandidate(new RTCIceCandidate(p.candidate));
            } catch (err) {
              console.error('[CloudCast] ICE candidate failed:', err);
            }
          });
        })
        .on('broadcast', { event: SIGNALING_EVENTS.STREAM_READY }, ({ payload }) => {
          const p = payload as StreamReadyPayload;
          appendEvent({ event: 'stream-ready', payload: p });
          const peerKey = p.from?.trim() || p.deviceId?.trim();
          if (isSignalingLeaderRef.current && peerKey && p.deviceId) {
            sendDeviceAck(peerKey, p.deviceId, { force: true });
          }

          const deviceId = p.deviceId?.trim();
          const whepUrl = p.whepUrl?.trim();
          const sessionMode = sessionRef.current?.connectionMode ?? 'mesh';
          const isRegal = sessionMode === 'regal';

          if (deviceId && whepUrl) {
            patchDevice(deviceId, {
              whepUrl,
              streamId: p.streamId?.trim() || undefined,
              status: 'connecting',
              isOnline: true,
              connectionState: 'connected',
              lastSeenAt: new Date().toISOString(),
            });

            if (isRegal) {
              connectAudioIngressWhep(deviceId, whepUrl, {
                onStream: (id, stream) => {
                  bindIngressStream(id, stream);
                  if (isSignalingLeaderRef.current) {
                    sendDeviceAck(id, id, { force: true });
                  }
                },
                onConnecting: markDeviceConnecting,
                onStreamLost: (id) => {
                  if (!isMeshStreamPresent(meshStreamsRef.current.get(id))) {
                    markDeviceConnecting(id);
                  }
                },
              });
            }
          }

          if (sessionRef.current) void loadDevicesImmediate(sessionRef.current);
        })
        .on('broadcast', { event: SIGNALING_EVENTS.ACCESS_CODE_REVOKED }, ({ payload }) => {
          const revoked = payload as { accessCode?: string; sessionId?: string };
          if (
            revoked.sessionId &&
            sessionRef.current?.sessionId &&
            revoked.sessionId !== sessionRef.current.sessionId
          ) {
            return;
          }
          peerConnections.current.forEach((pc) => pc.close());
          peerConnections.current.clear();
          pendingIce.current.clear();
          ackedPeersRef.current.clear();
          meshStreamsRef.current.forEach((stream) => stream.getTracks().forEach((t) => t.stop()));
          meshStreamsRef.current.clear();
          setMeshStreams(new Map());
          if (sessionRef.current) void loadDevicesImmediate(sessionRef.current);
        })
        .on('broadcast', { event: SIGNALING_EVENTS.STREAM_STOPPED }, ({ payload }) => {
          appendEvent({ event: 'stream-stopped', payload: payload as StreamStoppedPayload });
          const p = payload as StreamStoppedPayload;
          const peerKey = resolveSignalingPeerKey(p);
          const deviceId = p.deviceId || peerKey;
          ackedPeersRef.current.delete(deviceId);
          removeMeshStream(deviceId);
          if (peerKey) {
            removePeerConnection(peerKey, deviceId);
          }
          markDeviceOffline(deviceId);
        })
        .on('presence', { event: 'sync' }, () => {
          if (channelRef.current) schedulePresenceSnapshot(channelRef.current);
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          if (isDashboardPresenceKey(key)) return;
          const joinedId =
            (newPresences as { deviceId?: string }[])?.[0]?.deviceId?.trim() || key;
          if (joinedId) {
            clearPresenceLeaveTimer(joinedId);
            const hasStream = isMeshStreamPresent(meshStreamsRef.current.get(joinedId));
            if (!hasStream) {
              markDeviceConnecting(joinedId);
            }
            if (isSignalingLeaderRef.current) {
              const pc = resolvePeerConnection(joinedId, joinedId);
              if (pc?.connectionState === 'connected') {
                sendDeviceAck(joinedId, joinedId, { force: hasStream });
              } else if (
                !hasStream &&
                (!pc ||
                  pc.connectionState === 'failed' ||
                  pc.connectionState === 'closed')
              ) {
                requestMeshReoffer('device-presence-join', {
                  deviceId: joinedId,
                  bypassCooldown: true,
                });
              }
            }
          }
          if (sessionRef.current) scheduleLoadDevices(sessionRef.current);
          if (channelRef.current) applyPresenceSnapshot(channelRef.current);
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          if (isDashboardPresenceKey(key)) return;
          const leftId =
            (leftPresences as { deviceId?: string }[])?.[0]?.deviceId?.trim() || key;
          if (leftId) schedulePresenceOffline(leftId);
          if (channelRef.current) applyPresenceSnapshot(channelRef.current);
        })
        .subscribe(async (status) => {
          if (channelRef.current !== channel || signalingEpochRef.current !== subscribeEpoch) {
            return;
          }

          if (status === 'SUBSCRIBED') {
            realtimeRetryRef.current = 0;
            setIsPresenceConnected(true);
            setIsSignalingConnected(true);
            setError(null);
            if (realtimeRetryTimerRef.current) {
              clearTimeout(realtimeRetryTimerRef.current);
              realtimeRetryTimerRef.current = null;
            }
            try {
              await channel.track({
                role: 'dashboard',
                clientType: 'web',
                sessionId: s.sessionId,
                accessCode: s.accessCode,
                planId: s.planId,
                connectionMode: s.connectionMode,
                joinedAt: new Date().toISOString(),
              });
            } catch (trackErr) {
              console.warn('[CloudCast] Presence track failed, will retry:', trackErr);
              scheduleRealtimeReconnect(1_500);
              return;
            }
            applyPresenceSnapshot(channel);
            if (isSignalingLeaderRef.current) {
              requestMeshReoffer(
                hadActivePeers ? 'channel-resubscribe' : 'dashboard-join',
              );
            }
          } else if (
            status === 'CHANNEL_ERROR' ||
            status === 'TIMED_OUT' ||
            status === 'CLOSED'
          ) {
            setIsPresenceConnected(false);
            setIsSignalingConnected(false);
            const browserOffline = typeof navigator !== 'undefined' && !navigator.onLine;
            if (status !== 'CLOSED' && !browserOffline) {
              setError(`Realtime connection ${status.toLowerCase().replace('_', ' ')} — reconnecting…`);
            } else if (browserOffline) {
              setError(null);
            }

            if (sessionRef.current) {
              const attempt = realtimeRetryRef.current + 1;
              realtimeRetryRef.current = attempt;
              scheduleRealtimeReconnect(realtimeRetryDelayMs(attempt, browserOffline));
            }
          }
        }, REALTIME_PUSH_TIMEOUT_MS);

          if (
            signalingEpochRef.current !== subscribeEpoch ||
            sessionRef.current?.sessionId !== s.sessionId
          ) {
            await removeRealtimeChannel(channel);
            return;
          }

          channelRef.current = channel;
        })
        .catch((err) => {
          console.error('[CloudCast] Realtime connect failed:', err);
          setError(err instanceof Error ? err.message : 'Realtime connection failed');
        });
    },
    [
      appendEvent,
      createAnswerForOffer,
      scheduleLoadDevices,
      removeMeshStream,
      queueIceCandidate,
      resolveSignalingPeerKey,
      resolvePeerConnection,
      sendDeviceAck,
      requestMeshReoffer,
      removePeerConnection,
      applyPresenceSnapshot,
      markDeviceOffline,
      markDeviceConnecting,
      clearPresenceLeaveTimer,
      schedulePresenceOffline,
      schedulePresenceSnapshot,
      scheduleRealtimeReconnect,
      teardownSignalingChannel,
      broadcast,
      loadDevicesImmediate,
      bindIngressStream,
      patchDevice,
    ],
  );

  connectRealtimeRef.current = connectRealtime;

  const subscribeDbChanges = useCallback(
    (s: MixerSession) => {
      if (
        dbSessionIdRef.current === s.sessionId &&
        dbChannelRef.current &&
        isDbChannelHealthy()
      ) {
        return;
      }

      subscribeDbChainRef.current = subscribeDbChainRef.current
        .then(async () => {
          dbChannelEpochRef.current += 1;
          const subscribeEpoch = dbChannelEpochRef.current;

          const previousDbChannel = dbChannelRef.current;
          dbChannelRef.current = null;
          dbTeardownRef.current = dbTeardownRef.current
            .then(() => removeRealtimeChannel(previousDbChannel))
            .catch((err) => {
              console.warn('[CloudCast] DB channel teardown failed:', err);
            });
          await dbTeardownRef.current;

          if (dbChannelEpochRef.current !== subscribeEpoch) return;
          if (sessionRef.current?.sessionId !== s.sessionId) return;

          dbSessionIdRef.current = s.sessionId;

          const channel = getSupabase()
            .channel(`db-paired-${s.sessionId}`)
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'paired_devices',
                filter: `session_id=eq.${s.sessionId}`,
              },
              () => {
                if (sessionRef.current) scheduleLoadDevices(sessionRef.current);
              },
            )
            .subscribe((status) => {
              if (dbChannelRef.current !== channel || dbChannelEpochRef.current !== subscribeEpoch) {
                return;
              }
              if (status === 'SUBSCRIBED') return;
              if (
                status !== 'CHANNEL_ERROR' &&
                status !== 'TIMED_OUT' &&
                status !== 'CLOSED'
              ) {
                return;
              }
              if (!sessionRef.current) return;
              dbSessionIdRef.current = null;
              window.setTimeout(() => {
                if (sessionRef.current) subscribeDbChangesRef.current(sessionRef.current);
              }, realtimeRetryDelayMs(1, true));
            }, REALTIME_PUSH_TIMEOUT_MS);

          if (
            dbChannelEpochRef.current !== subscribeEpoch ||
            sessionRef.current?.sessionId !== s.sessionId
          ) {
            await removeRealtimeChannel(channel);
            return;
          }

          dbChannelRef.current = channel;
        })
        .catch((err) => {
          console.error('[CloudCast] DB realtime subscribe failed:', err);
        });
    },
    [scheduleLoadDevices, isDbChannelHealthy],
  );

  subscribeDbChangesRef.current = subscribeDbChanges;

  const refreshDevices = useCallback(() => {
    if (session) void loadDevicesImmediate(session);
  }, [session, loadDevicesImmediate]);

  const reconnect = useCallback(() => {
    realtimeRetryRef.current = 0;
    dbSessionIdRef.current = null;
    if (session) {
      connectRealtime(session);
      subscribeDbChanges(session);
      void loadDevicesImmediate(session);
    } else {
      void initSession();
    }
  }, [session, connectRealtime, subscribeDbChanges, loadDevicesImmediate, initSession]);

  const regenerateCode = useCallback(async () => {
    if (!session) return;
    setIsRegenerating(true);
    try {
      broadcast(SIGNALING_EVENTS.ACCESS_CODE_REVOKED, {
        accessCode: session.accessCode,
        sessionId: session.sessionId,
        timestamp: new Date().toISOString(),
      });
      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();
      pendingIce.current.clear();
      ackedPeersRef.current.clear();
      meshStreamsRef.current.forEach((stream) => stream.getTracks().forEach((t) => t.stop()));
      meshStreamsRef.current.clear();
      setMeshStreams(new Map());

      const updated = await regenerateAccessCode(session.sessionId, session.accessCode);
      saveStoredSession(
        {
          sessionId: updated.sessionId,
          accessCode: updated.accessCode,
          ownerId: profile?.id,
        },
        getPairingSessionProduct(),
      );
      setSession(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate code');
    } finally {
      setIsRegenerating(false);
    }
  }, [session, profile?.id, broadcast]);

  const unpairDevice = useCallback(
    async (deviceId: string) => {
      if (!session) return;
      try {
        await unpairDeviceRpc(session.accessCode, deviceId);
        removeMeshStream(deviceId);
        removePeerConnection(deviceId, deviceId);
        await loadDevicesImmediate(session);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to unpair device');
      }
    },
    [session, loadDevicesImmediate, removeMeshStream, removePeerConnection],
  );

  useEffect(() => {
    const onOffline = () => setError(null);
    window.addEventListener('offline', onOffline);
    return () => window.removeEventListener('offline', onOffline);
  }, []);

  useEffect(() => {
    if (authLoading && !user) return;
    if (!user) {
      setSession(null);
      setSessionLoading(false);
      return;
    }
    void initSession();
  }, [initSession, authLoading, user]);

  useEffect(() => {
    if (!session || !profile?.id) return;
    const pairingProduct = getPairingSessionProduct();
    const stored = loadStoredSession(pairingProduct);
    if (!stored) return;
    if (stored.ownerId && stored.ownerId !== profile.id) {
      clearStoredSession(pairingProduct);
      teardownRealtime();
      void initSession();
      return;
    }
    if (!stored.ownerId) {
      saveStoredSession(
        {
          sessionId: stored.sessionId,
          accessCode: stored.accessCode,
          ownerId: profile.id,
        },
        pairingProduct,
      );
    }
  }, [session, profile?.id, initSession, teardownRealtime]);

  useEffect(() => {
    let releaseLeader = () => {};
    void holdSignalingLeader((leader) => setIsSignalingLeader(leader)).then((release) => {
      releaseLeader = release;
    });
    return () => releaseLeader();
  }, []);

  useEffect(() => {
    if (isSignalingLeader && !wasSignalingLeaderRef.current && channelRef.current) {
      requestMeshReoffer('signaling-leader');
    }
    wasSignalingLeaderRef.current = isSignalingLeader;
  }, [isSignalingLeader, requestMeshReoffer]);

  const bindIngressStreamWithAck = useCallback(
    (deviceId: string, stream: MediaStream) => {
      bindIngressStream(deviceId, stream);
      if (isSignalingLeaderRef.current) {
        sendDeviceAck(deviceId, deviceId, { force: true });
      }
    },
    [bindIngressStream, sendDeviceAck],
  );

  useAudioIngressStreams({
    enabled: sessionConnectionMode !== 'mesh',
    connectionMode: sessionConnectionMode,
    devices,
    onStream: bindIngressStreamWithAck,
    onConnecting: markDeviceConnecting,
    onStreamLost: (deviceId) => {
      if (!isMeshStreamPresent(meshStreamsRef.current.get(deviceId))) {
        markDeviceConnecting(deviceId);
        if (sessionRef.current?.connectionMode === 'regal') {
          requestMeshReoffer('whep-stream-lost', { bypassCooldown: true, deviceId });
        }
      }
    },
  });

  useEffect(() => {
    const onMeshReoffer = (event: Event) => {
      const detail = (event as CustomEvent<{ deviceId?: string; reason?: string }>).detail;
      if (sessionRef.current?.connectionMode !== 'regal') return;
      requestMeshReoffer(detail?.reason ?? 'whep-fallback', {
        bypassCooldown: true,
        deviceId: detail?.deviceId,
      });
    };

    const onWhepPool = (event: Event) => {
      const detail = (event as CustomEvent<{ deviceId?: string; connectionState?: string }>).detail;
      if (sessionRef.current?.connectionMode !== 'regal') return;
      if (detail?.connectionState === 'failed' || detail?.connectionState === 'disconnected') {
        requestMeshReoffer('whep-failed', { bypassCooldown: true, deviceId: detail?.deviceId });
      }
    };

    window.addEventListener('cloudcast:request-mesh-reoffer', onMeshReoffer);
    window.addEventListener('cloudcast:whep-pool', onWhepPool);
    return () => {
      window.removeEventListener('cloudcast:request-mesh-reoffer', onMeshReoffer);
      window.removeEventListener('cloudcast:whep-pool', onWhepPool);
    };
  }, [requestMeshReoffer]);

  useEffect(() => {
    if (!session || !profile) return;
    // Audio mixer shares the video pairing session — plan sync runs from the video dashboard.
    if (productType === 'audio') return;

    const productPlanId = resolveProductPlan(profile, 'video_mixer');
    const expectedMaxDevices = profile.plan.max_total_channels;

    if (session.maxDevices === expectedMaxDevices && session.planId === productPlanId) {
      return;
    }

    syncMixerSessionPlan(session.sessionId, session.accessCode)
      .then(async (updated) => {
        setSession(updated);
        await loadDevicesImmediate(updated);
      })
      .catch(() => {
        /* ignore — init path handles hard failures */
      });
  }, [
    profile,
    productType,
    session?.sessionId,
    session?.accessCode,
    session?.maxDevices,
    session?.planId,
    loadDevicesImmediate,
  ]);

  useEffect(() => {
    if (!session?.sessionId || !session?.accessCode) return;
    connectRealtime(session);
    subscribeDbChanges(session);
    return teardownRealtime;
  }, [session?.sessionId, session?.accessCode, connectRealtime, subscribeDbChanges, teardownRealtime]);

  useEffect(() => {
    if (!session) return;
    const timer = setInterval(() => {
      applyPresenceSnapshot(channelRef.current);
    }, DEVICE_STATUS_SWEEP_MS);
    return () => clearInterval(timer);
  }, [session, applyPresenceSnapshot]);

  useEffect(() => {
    if (!session) return;

    const recover = () => {
      if (!sessionRef.current || realtimeRetryTimerRef.current) return;

      const now = Date.now();
      if (now - lastRecoverAtRef.current < REALTIME_RECOVER_COOLDOWN_MS) return;
      lastRecoverAtRef.current = now;

      const sessionHealthy = isSessionChannelHealthy();
      if (!sessionHealthy) {
        scheduleRealtimeReconnect(500);
        return;
      }

      if (!isDbChannelHealthy()) {
        subscribeDbChangesRef.current(sessionRef.current);
      }

      applyPresenceSnapshot(channelRef.current);
      if (isSignalingLeaderRef.current && channelRef.current) {
        const online = presenceDeviceIds(channelRef.current);
        const needsReoffer = [...online].some((deviceId) => {
          if (isMeshStreamPresent(meshStreamsRef.current.get(deviceId))) return false;
          const peerState = peerConnections.current.get(deviceId)?.connectionState;
          return !peerState || peerState === 'failed' || peerState === 'closed';
        });
        if (needsReoffer) requestMeshReoffer('session-recover');
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') recover();
    };

    const unsubscribeRecovery = onRealtimeRecoveryNeeded(recover);
    const healthTimer = window.setInterval(recover, REALTIME_HEALTH_CHECK_MS);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      unsubscribeRecovery();
      window.clearInterval(healthTimer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [session, isSessionChannelHealthy, isDbChannelHealthy, scheduleRealtimeReconnect, applyPresenceSnapshot, requestMeshReoffer]);

  const contextValue = useMemo<CloudCastContextValue>(
    () => ({
      session,
      sessionLoading,
      devices,
      connectionMode,
      meshStreams,
      getMeshStream,
      isPresenceConnected,
      isSignalingConnected,
      isSignalingLeader,
      signalingEvents,
      error,
      refreshDevices,
      reconnect,
      regenerateCode,
      isRegenerating,
      unpairDevice,
    }),
    [
      session,
      sessionLoading,
      devices,
      connectionMode,
      meshStreams,
      getMeshStream,
      isPresenceConnected,
      isSignalingConnected,
      isSignalingLeader,
      signalingEvents,
      error,
      refreshDevices,
      reconnect,
      regenerateCode,
      isRegenerating,
      unpairDevice,
    ],
  );

  return (
    <CloudCastContext.Provider value={contextValue}>
      {children}
    </CloudCastContext.Provider>
  );
}

export function useCloudCast() {
  const ctx = useContext(CloudCastContext);
  if (!ctx) throw new Error('useCloudCast must be used within CloudCastProvider');
  return ctx;
}

export function useCloudCastOptional() {
  return useContext(CloudCastContext);
}
