import type { ConnectionMode } from '../types/plans';
import type { MixerSession } from '../types/session';
import type { DeviceConnectionDebugRow } from './audioConnectionDebug';
import type { SignalingEvent } from '../types/signaling';
import { resolveRealtimeChannelName } from './realtimeChannel';

export type HandshakeHealth = 'ok' | 'warn' | 'fail' | 'idle';

export interface SignalingLogEntry {
  at: string;
  event: string;
  from: string;
  deviceId: string;
  detail: string;
}

export interface LiveTestStep {
  id: string;
  label: string;
  hint: string;
  autoPass?: boolean;
}

export interface LiveTestSection {
  title: string;
  steps: LiveTestStep[];
}

export interface HandshakeDebugSnapshot {
  capturedAt: string;
  appUrl: string;
  supabaseHost: string;
  realtimeChannel: string | null;
  connectionMode: ConnectionMode;
  sessionId: string | null;
  accessCode: string | null;
  isPresenceConnected: boolean;
  isSignalingConnected: boolean;
  isSignalingLeader: boolean;
  devices: DeviceConnectionDebugRow[];
  signalingLog: SignalingLogEntry[];
  checklist: LiveTestSection[];
}

function supabaseHostFromEnv(): string {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL?.trim();
    if (!url) return 'not configured';
    return new URL(url).host;
  } catch {
    return 'invalid URL';
  }
}

export function appUrlFromEnv(): string {
  return (
    import.meta.env.VITE_APP_URL?.trim() ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://cloudcast.live')
  );
}

export function summarizeSignalingEvents(events: SignalingEvent[], limit = 20): SignalingLogEntry[] {
  return events.slice(0, limit).map((entry) => {
    const payload = entry.payload as {
      from?: string;
      deviceId?: string;
      timestamp?: string;
      whepUrl?: string;
      reason?: string;
    };
    const deviceId = payload.deviceId?.trim() || payload.from?.trim() || '—';
    const from = payload.from?.trim() || '—';
    let detail = '';
    if (entry.event === 'stream-ready') detail = payload.whepUrl ? 'WHEP URL set' : 'no WHEP';
    if (entry.event === 'stream-stopped') detail = payload.reason ?? 'stopped';
    if (entry.event === 'offer' || entry.event === 'answer') detail = 'SDP exchanged';
    if (entry.event === 'ice') detail = 'ICE candidate';
    return {
      at: payload.timestamp ?? new Date().toISOString(),
      event: entry.event,
      from,
      deviceId,
      detail,
    };
  });
}

export function evaluateDeviceHandshakeHealth(
  row: DeviceConnectionDebugRow,
  connectionMode: ConnectionMode,
): { health: HandshakeHealth; reason: string } {
  if (row.status === 'offline') {
    return { health: 'idle', reason: 'Not paired or app offline' };
  }

  if (connectionMode === 'mesh') {
    if (row.streamInMap && row.videoTracks > 0) {
      return { health: 'ok', reason: 'Mesh stream active with video' };
    }
    if (row.streamInMap && row.usableAudio) {
      return { health: 'ok', reason: 'Mesh stream active (audio)' };
    }
    if (row.peerState === 'connected' || row.peerState === 'connecting') {
      return { health: 'warn', reason: 'Peer linked — waiting for media tracks' };
    }
    if (row.status === 'connecting') {
      return { health: 'warn', reason: 'Paired — waiting for mobile offer' };
    }
    return { health: 'fail', reason: 'No mesh peer or stream' };
  }

  if (row.expectedIngress === 'whep') {
    if (row.whepState === 'connected' && row.videoTracks > 0) {
      return { health: 'ok', reason: 'Regal Cloud WHEP playing video' };
    }
    if (row.whepState === 'connecting' || row.whepState === 'reconnecting') {
      return { health: 'warn', reason: 'WHEP connecting' };
    }
    if (row.streamInMap && row.usableAudio) {
      return { health: 'ok', reason: 'Audio ingress active (mesh or WHEP)' };
    }
    if (row.status === 'live') {
      return { health: 'warn', reason: 'Device live — WHEP not connected yet' };
    }
    return { health: 'fail', reason: row.whepError ?? 'WHEP not connected' };
  }

  if (row.expectedIngress === 'pending') {
    return { health: 'warn', reason: 'Waiting for mobile stream-ready / WHEP URL' };
  }

  return { health: 'idle', reason: '—' };
}

export function buildLiveTestChecklist(
  session: MixerSession | null,
  options: {
    connectionMode: ConnectionMode;
    isPresenceConnected: boolean;
    isSignalingConnected: boolean;
    isSignalingLeader: boolean;
    deviceRows: DeviceConnectionDebugRow[];
    signalingLog: SignalingLogEntry[];
    audioConsoleActive?: boolean;
  },
): LiveTestSection[] {
  const code = session?.accessCode ?? '______';
  const channel = session
    ? resolveRealtimeChannelName(session.sessionId, session.realtimeChannel)
    : 'cloudcast-{session_id}';
  const appUrl = appUrlFromEnv();
  const isMesh = options.connectionMode === 'mesh';
  const hasDevice = options.deviceRows.length > 0;
  const hasOffer = options.signalingLog.some((e) => e.event === 'offer');
  const hasAnswer = options.signalingLog.some((e) => e.event === 'answer');
  const hasStreamReady = options.signalingLog.some((e) => e.event === 'stream-ready');
  const anyLive = options.deviceRows.some((d) => d.status === 'live');
  const anyStream = options.deviceRows.some((d) => d.streamInMap);
  const anyVideo = options.deviceRows.some((d) => d.videoTracks > 0);
  const anyAudio = options.deviceRows.some((d) => d.usableAudio);
  const anyWhep = options.deviceRows.some((d) => d.whepState === 'connected');

  return [
    {
      title: '1 · Session setup',
      steps: [
        {
          id: 'dashboard-open',
          label: `Video Mixer open at ${appUrl}/dashboard`,
          hint: 'Sign in and confirm your access code appears in the header.',
          autoPass: Boolean(session?.accessCode),
        },
        {
          id: 'access-code',
          label: `Access code visible: ${code}`,
          hint: 'Same code works for CloudCast Mobile, Video Mixer, and Audio Mixer.',
          autoPass: Boolean(session?.accessCode),
        },
        {
          id: 'realtime-channel',
          label: `Realtime channel: ${channel}`,
          hint: `Mobile must join this Supabase channel (${supabaseHostFromEnv()}).`,
          autoPass: Boolean(session?.sessionId),
        },
      ],
    },
    {
      title: '2 · Mobile pairing',
      steps: [
        {
          id: 'mobile-code',
          label: 'CloudCast Mobile: enter access code and pair',
          hint: 'Mobile calls get_mixer_session → pair_device → joins Realtime channel.',
        },
        {
          id: 'presence',
          label: 'Dashboard presence connected',
          hint: 'Debug panel should show Presence = yes.',
          autoPass: options.isPresenceConnected,
        },
        {
          id: 'signaling',
          label: 'Dashboard signaling connected (leader tab)',
          hint: 'Only one browser tab should be signaling leader.',
          autoPass: options.isSignalingConnected && options.isSignalingLeader,
        },
        {
          id: 'device-slot',
          label: 'Paired device appears in source list',
          hint: 'Status should move from offline → connecting when mobile joins.',
          autoPass: hasDevice,
        },
      ],
    },
    {
      title: isMesh ? '3 · Regal Mesh (Free)' : '3 · Regal Cloud video (Pro+)',
      steps: isMesh
        ? [
            {
              id: 'mesh-offer',
              label: 'Mobile sent offer (see signaling log)',
              hint: 'After Go Live, mobile broadcasts offer on the session channel.',
              autoPass: hasOffer,
            },
            {
              id: 'mesh-answer',
              label: 'Dashboard answered offer',
              hint: 'Leader tab creates answer + ICE back to mobile.',
              autoPass: hasAnswer,
            },
            {
              id: 'mesh-stream',
              label: 'Preview shows video (stream in map)',
              hint: 'Mobile receives device-ack → shows Connected.',
              autoPass: anyStream && anyVideo,
            },
          ]
        : [
            {
              id: 'cloud-provision',
              label: 'Mobile provisioned WHIP/WHEP (cloudcast-stream)',
              hint: 'paired_devices.whep_url populated in database.',
              autoPass: options.deviceRows.some((d) => d.whepConfigured),
            },
            {
              id: 'stream-ready',
              label: 'Mobile broadcast stream-ready (optional)',
              hint: 'Dashboard sends device-ack; WHEP playback starts.',
              autoPass: hasStreamReady || anyWhep,
            },
            {
              id: 'whep-video',
              label: 'Video Mixer preview via WHEP',
              hint: 'Stream column shows video tracks; status live.',
              autoPass: anyWhep && anyVideo,
            },
          ],
    },
    {
      title: '4 · Audio Mixer',
      steps: [
        {
          id: 'audio-route',
          label: `Open ${appUrl}/audio (same access code)`,
          hint: 'Audio console shares the pairing session with Video Mixer.',
          autoPass: options.audioConsoleActive,
        },
        {
          id: 'audio-mesh',
          label: isMesh
            ? 'Fader receives camera mic (mesh audio tracks)'
            : 'Fader receives audio (mesh P2P or WHEP fallback)',
          hint: 'Pro plans: mobile keeps Regal Mesh for low-latency audio.',
          autoPass: anyAudio,
        },
        {
          id: 'audio-live',
          label: 'Input status live with usable audio',
          hint: 'Debug Audio column = yes (Na/Nv tracks).',
          autoPass: anyLive && anyAudio,
        },
      ],
    },
    {
      title: '5 · Recovery',
      steps: [
        {
          id: 'reload',
          label: 'Reload Video Mixer tab — preview returns without re-pair',
          hint: isMesh
            ? 'Dashboard broadcasts request-reoffer; mobile resends offer.'
            : 'WHEP replays from cloud; mesh re-offer only if Audio Mixer active.',
        },
        {
          id: 'heartbeat',
          label: 'Mobile heartbeat updates last_seen (every ~15s)',
          hint: 'Device stays live while app is foregrounded.',
          autoPass: anyLive,
        },
      ],
    },
  ];
}

export function formatHandshakeDebugSnapshot(snapshot: HandshakeDebugSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}

export function buildHandshakeDebugSnapshot(input: {
  session: MixerSession | null;
  connectionMode: ConnectionMode;
  isPresenceConnected: boolean;
  isSignalingConnected: boolean;
  isSignalingLeader: boolean;
  deviceRows: DeviceConnectionDebugRow[];
  signalingEvents: SignalingEvent[];
  audioConsoleActive?: boolean;
}): HandshakeDebugSnapshot {
  const signalingLog = summarizeSignalingEvents(input.signalingEvents);
  return {
    capturedAt: new Date().toISOString(),
    appUrl: appUrlFromEnv(),
    supabaseHost: supabaseHostFromEnv(),
    realtimeChannel: input.session
      ? resolveRealtimeChannelName(input.session.sessionId, input.session.realtimeChannel)
      : null,
    connectionMode: input.connectionMode,
    sessionId: input.session?.sessionId ?? null,
    accessCode: input.session?.accessCode ?? null,
    isPresenceConnected: input.isPresenceConnected,
    isSignalingConnected: input.isSignalingConnected,
    isSignalingLeader: input.isSignalingLeader,
    devices: input.deviceRows,
    signalingLog,
    checklist: buildLiveTestChecklist(input.session, {
      connectionMode: input.connectionMode,
      isPresenceConnected: input.isPresenceConnected,
      isSignalingConnected: input.isSignalingConnected,
      isSignalingLeader: input.isSignalingLeader,
      deviceRows: input.deviceRows,
      signalingLog,
      audioConsoleActive: input.audioConsoleActive,
    }),
  };
}

export function checklistStorageKey(sessionId: string | undefined): string {
  return `cloudcast-handshake-checklist-${sessionId ?? 'none'}`;
}
