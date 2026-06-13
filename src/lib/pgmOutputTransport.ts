import { useCallback, useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { MESH_PC_CONFIG } from './meshConfig';
import {
  createPgmBroadcastCapture,
  type PgmBroadcastCapture,
} from './broadcast/pgmCaptureStream';
import { hasPgmOutputReady } from './broadcast/pgmProgramCapture';
import type { PgmBroadcastSources } from '../hooks/usePgmBroadcast';
import {
  PGM_OUTPUT_ANSWER_EVENT,
  PGM_OUTPUT_ICE_EVENT,
  PGM_OUTPUT_OFFER_EVENT,
  PGM_OUTPUT_REQUEST_EVENT,
  resolvePgmOutputChannelName,
} from './pgmOutputSync';

type IcePayload = { candidate: RTCIceCandidateInit | null; viewerId?: string; role?: string };
type ViewerPayload = { viewerId?: string };

function randomViewerId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `viewer-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Video mixer publishes full PGM composite to remote output viewers. */
export function usePgmOutputPublisher({
  sessionId,
  realtimeChannel,
  getSources,
  enabled,
}: {
  sessionId: string | null | undefined;
  realtimeChannel: string | null | undefined;
  getSources: () => PgmBroadcastSources;
  enabled: boolean;
}) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const captureRef = useRef<PgmBroadcastCapture | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingViewersRef = useRef<Set<string>>(new Set());
  const makingOfferRef = useRef<Set<string>>(new Set());
  const getSourcesRef = useRef(getSources);
  getSourcesRef.current = getSources;

  const stopCapture = useCallback(() => {
    captureRef.current?.stop();
    captureRef.current = null;
  }, []);

  const syncCaptureAudio = useCallback((stream: MediaStream): boolean => {
    const sources = getSourcesRef.current();
    const broadcastAudio = sources.getBroadcastAudioStream?.() ?? null;
    const audioVideo = sources.getAudioVideo();
    const audioSource =
      broadcastAudio ??
      (audioVideo?.srcObject instanceof MediaStream ? (audioVideo.srcObject as MediaStream) : null);
    const liveTracks = audioSource?.getAudioTracks().filter((track) => track.readyState === 'live') ?? [];
    if (liveTracks.length === 0 || stream.getAudioTracks().length > 0) return false;

    for (const track of liveTracks) {
      stream.addTrack(track.clone());
    }
    return true;
  }, []);

  const wireTracks = useCallback((pc: RTCPeerConnection, stream: MediaStream) => {
    const senders = pc.getSenders();
    for (const track of stream.getTracks()) {
      track.enabled = true;
      const existing = senders.find((s) => s.track?.kind === track.kind);
      if (existing) {
        void existing.replaceTrack(track);
      } else {
        pc.addTrack(track, stream);
      }
    }
  }, []);

  const refreshViewerTracks = useCallback(() => {
    const stream = captureRef.current?.stream;
    if (!stream) return;
    const audioAdded = syncCaptureAudio(stream);
    if (!audioAdded) return;
    for (const [, pc] of pcsRef.current) {
      wireTracks(pc, stream);
    }
  }, [syncCaptureAudio, wireTracks]);

  const ensureCapture = useCallback((): MediaStream | null => {
    const sources = getSourcesRef.current();
    const container = sources.getOutputContainer();
    if (!container || !hasPgmOutputReady(container)) return null;

    const fadeLevel = sources.getFadeToBlackLevel?.() ?? 0;
    const existing = captureRef.current;
    if (existing) {
      existing.setFadeToBlackLevel(fadeLevel);
      return existing.stream;
    }

    const capture = createPgmBroadcastCapture(
      container,
      sources.getAudioVideo(),
      fadeLevel,
      sources.getBroadcastAudioStream?.() ?? null,
    );
    if (!capture) return null;

    captureRef.current = capture;
    syncCaptureAudio(capture.stream);
    return capture.stream;
  }, [syncCaptureAudio]);

  const teardownViewer = useCallback((viewerId: string) => {
    pendingViewersRef.current.delete(viewerId);
    const pc = pcsRef.current.get(viewerId);
    pcsRef.current.delete(viewerId);
    if (!pc) return;
    try {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.close();
    } catch {
      /* ignore */
    }
    if (pcsRef.current.size === 0) stopCapture();
  }, [stopCapture]);

  const publishOffer = useCallback(
    async (viewerId: string) => {
      const ch = channelRef.current;
      if (!ch || !enabled) return;

      const stream = ensureCapture();
      if (!stream) {
        pendingViewersRef.current.add(viewerId);
        return;
      }

      pendingViewersRef.current.delete(viewerId);

      let pc = pcsRef.current.get(viewerId);
      if (pc && pc.connectionState === 'closed') {
        teardownViewer(viewerId);
        pc = undefined;
      }

      if (!pc) {
        pc = new RTCPeerConnection(MESH_PC_CONFIG);
        pcsRef.current.set(viewerId, pc);

        pc.onicecandidate = (ev) => {
          if (!ev.candidate || !channelRef.current) return;
          void channelRef.current.send({
            type: 'broadcast',
            event: PGM_OUTPUT_ICE_EVENT,
            payload: { candidate: ev.candidate.toJSON(), viewerId, role: 'publish' },
          });
        };

        pc.onconnectionstatechange = () => {
          if (!pc) return;
          if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
            teardownViewer(viewerId);
          }
        };
      }

      wireTracks(pc, stream);
      refreshViewerTracks();

      try {
        makingOfferRef.current.add(viewerId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await ch.send({
          type: 'broadcast',
          event: PGM_OUTPUT_OFFER_EVENT,
          payload: { sdp: pc.localDescription, viewerId },
        });
      } catch (err) {
        console.warn('[CloudCast] PGM output offer failed:', err);
      } finally {
        makingOfferRef.current.delete(viewerId);
      }
    },
    [enabled, ensureCapture, teardownViewer, wireTracks, refreshViewerTracks],
  );

  useEffect(() => {
    if (!enabled || !sessionId || !isSupabaseConfigured()) {
      for (const viewerId of pcsRef.current.keys()) teardownViewer(viewerId);
      stopCapture();
      channelRef.current?.unsubscribe();
      channelRef.current = null;
      return;
    }

    const channelName = resolvePgmOutputChannelName(sessionId, realtimeChannel);
    const channel = getSupabase().channel(channelName, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel
      .on('broadcast', { event: PGM_OUTPUT_REQUEST_EVENT }, ({ payload }) => {
        const viewerId = (payload as ViewerPayload).viewerId?.trim();
        if (!viewerId) return;
        pendingViewersRef.current.add(viewerId);
        void publishOffer(viewerId);
      })
      .on('broadcast', { event: PGM_OUTPUT_ANSWER_EVENT }, async ({ payload }) => {
        const data = payload as ViewerPayload & { sdp?: RTCSessionDescriptionInit };
        const viewerId = data.viewerId?.trim();
        if (!viewerId || makingOfferRef.current.has(viewerId)) return;
        const pc = pcsRef.current.get(viewerId);
        if (!pc || !data.sdp) return;
        try {
          await pc.setRemoteDescription(data.sdp);
        } catch (err) {
          console.warn('[CloudCast] PGM output answer failed:', err);
        }
      })
      .on('broadcast', { event: PGM_OUTPUT_ICE_EVENT }, async ({ payload }) => {
        const ice = payload as IcePayload;
        if (ice.role === 'publish' || !ice.viewerId) return;
        const pc = pcsRef.current.get(ice.viewerId);
        if (!pc || !ice.candidate) return;
        try {
          await pc.addIceCandidate(ice.candidate);
        } catch {
          /* ignore late ICE */
        }
      })
      .subscribe();

    const interval = setInterval(() => {
      refreshViewerTracks();
      const viewerIds = new Set<string>([
        ...pendingViewersRef.current,
        ...pcsRef.current.keys(),
      ]);
      for (const viewerId of viewerIds) {
        void publishOffer(viewerId);
      }
    }, 12_000);

    const pendingInterval = setInterval(() => {
      refreshViewerTracks();
      if (pendingViewersRef.current.size === 0) return;
      for (const viewerId of pendingViewersRef.current) {
        void publishOffer(viewerId);
      }
    }, 2_000);

    return () => {
      clearInterval(interval);
      clearInterval(pendingInterval);
      pendingViewersRef.current.clear();
      for (const viewerId of pcsRef.current.keys()) teardownViewer(viewerId);
      stopCapture();
      void getSupabase().removeChannel(channel);
      channelRef.current = null;
    };
  }, [enabled, sessionId, realtimeChannel, publishOffer, refreshViewerTracks, stopCapture, teardownViewer]);
}

/** Remote viewer receives live PGM from the video mixer operator. */
export function usePgmOutputSubscriber({
  sessionId,
  realtimeChannel,
  onStream,
  enabled,
}: {
  sessionId: string | null;
  realtimeChannel: string | null | undefined;
  onStream: (stream: MediaStream | null) => void;
  enabled: boolean;
}) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const viewerIdRef = useRef(randomViewerId());
  const onStreamRef = useRef(onStream);
  onStreamRef.current = onStream;

  const teardownPc = useCallback(() => {
    const pc = pcRef.current;
    pcRef.current = null;
    onStreamRef.current(null);
    if (!pc) return;
    try {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.close();
    } catch {
      /* ignore */
    }
  }, []);

  const requestOutput = useCallback(() => {
    const ch = channelRef.current;
    if (!ch) return;
    void ch.send({
      type: 'broadcast',
      event: PGM_OUTPUT_REQUEST_EVENT,
      payload: { viewerId: viewerIdRef.current, at: new Date().toISOString() },
    });
  }, []);

  useEffect(() => {
    if (!enabled || !sessionId || !isSupabaseConfigured()) {
      teardownPc();
      channelRef.current?.unsubscribe();
      channelRef.current = null;
      return;
    }

    const channelName = resolvePgmOutputChannelName(sessionId, realtimeChannel);
    const channel = getSupabase().channel(channelName, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;
    const viewerId = viewerIdRef.current;

    channel
      .on('broadcast', { event: PGM_OUTPUT_OFFER_EVENT }, async ({ payload }) => {
        const data = payload as ViewerPayload & { sdp?: RTCSessionDescriptionInit };
        if (data.viewerId && data.viewerId !== viewerId) return;
        try {
          let pc = pcRef.current;
          if (!pc || pc.connectionState === 'closed') {
            teardownPc();
            pc = new RTCPeerConnection(MESH_PC_CONFIG);
            pcRef.current = pc;

            pc.ontrack = (ev) => {
              const stream = ev.streams[0] ?? new MediaStream([ev.track]);
              onStreamRef.current(stream);
            };

            pc.onicecandidate = (ev) => {
              if (!ev.candidate || !channelRef.current) return;
              void channelRef.current.send({
                type: 'broadcast',
                event: PGM_OUTPUT_ICE_EVENT,
                payload: { candidate: ev.candidate.toJSON(), viewerId, role: 'subscribe' },
              });
            };

            pc.onconnectionstatechange = () => {
              if (pc && (pc.connectionState === 'failed' || pc.connectionState === 'closed')) {
                teardownPc();
              }
            };
          }

          const offer = data.sdp;
          if (!offer || !pc) return;

          await pc.setRemoteDescription(offer);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await channel.send({
            type: 'broadcast',
            event: PGM_OUTPUT_ANSWER_EVENT,
            payload: { sdp: pc.localDescription, viewerId },
          });
        } catch (err) {
          console.warn('[CloudCast] PGM output subscribe failed:', err);
        }
      })
      .on('broadcast', { event: PGM_OUTPUT_ICE_EVENT }, async ({ payload }) => {
        const pc = pcRef.current;
        if (!pc) return;
        const ice = payload as IcePayload;
        if (ice.role === 'subscribe' || ice.viewerId !== viewerId) return;
        try {
          if (ice.candidate) await pc.addIceCandidate(ice.candidate);
        } catch {
          /* ignore */
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          requestOutput();
          setTimeout(requestOutput, 800);
        }
      });

    const interval = setInterval(requestOutput, 10_000);

    return () => {
      clearInterval(interval);
      teardownPc();
      void getSupabase().removeChannel(channel);
      channelRef.current = null;
    };
  }, [enabled, sessionId, realtimeChannel, requestOutput, teardownPc]);
}
