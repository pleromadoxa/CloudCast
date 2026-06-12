import { useCallback, useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import { hasUsableAudio } from './streamAudioHub';
import { MESH_PC_CONFIG } from './meshConfig';

const BRIDGE_PREFIX = 'cloudcast-bridge-';

const EVENTS = {
  PGM_REQUEST: 'pgm-request',
  PGM_OFFER: 'pgm-offer',
  PGM_ANSWER: 'pgm-answer',
  PGM_ICE: 'pgm-ice',
} as const;

type IcePayload = { candidate: RTCIceCandidateInit | null };

function bridgeChannelName(code: string): string {
  return `${BRIDGE_PREFIX}${code.trim().toUpperCase()}`;
}

/** Audio mixer publishes processed PGM to the video mixer over WebRTC. */
export function usePgmBridgePublisher({
  bridgeCode,
  getPgmStream,
  enabled,
}: {
  bridgeCode: string | null;
  getPgmStream: () => MediaStream | null;
  enabled: boolean;
}) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);
  const getPgmStreamRef = useRef(getPgmStream);
  getPgmStreamRef.current = getPgmStream;

  const teardownPc = useCallback(async () => {
    const pc = pcRef.current;
    pcRef.current = null;
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

  const wireTracks = useCallback((pc: RTCPeerConnection) => {
    const stream = getPgmStreamRef.current();
    if (!stream || !hasUsableAudio(stream)) return;

    const senders = pc.getSenders();
    for (const track of stream.getAudioTracks()) {
      track.enabled = true;
      const existing = senders.find((s) => s.track?.id === track.id);
      if (existing) {
        void existing.replaceTrack(track);
      } else {
        pc.addTrack(track, stream);
      }
    }
  }, []);

  const ensurePc = useCallback(async (): Promise<RTCPeerConnection | null> => {
    let pc = pcRef.current;
    if (pc && pc.connectionState !== 'closed') return pc;

    await teardownPc();
    pc = new RTCPeerConnection(MESH_PC_CONFIG);
    pcRef.current = pc;

    pc.onicecandidate = (ev) => {
      const ch = channelRef.current;
      if (!ch || !ev.candidate) return;
      void ch.send({
        type: 'broadcast',
        event: EVENTS.PGM_ICE,
        payload: { candidate: ev.candidate.toJSON(), role: 'publish' },
      });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        void teardownPc();
      }
    };

    wireTracks(pc);
    return pc;
  }, [teardownPc, wireTracks]);

  const publishOffer = useCallback(async () => {
    const code = bridgeCode?.trim().toUpperCase();
    const ch = channelRef.current;
    if (!code || !ch || !enabled) return;

    const stream = getPgmStreamRef.current();
    if (!stream || !hasUsableAudio(stream)) return;

    try {
      makingOfferRef.current = true;
      const pc = await ensurePc();
      if (!pc) return;

      wireTracks(pc);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await ch.send({
        type: 'broadcast',
        event: EVENTS.PGM_OFFER,
        payload: { sdp: pc.localDescription },
      });
    } catch (err) {
      console.warn('[CloudCast] PGM bridge offer failed:', err);
    } finally {
      makingOfferRef.current = false;
    }
  }, [bridgeCode, enabled, ensurePc, wireTracks]);

  useEffect(() => {
    const code = bridgeCode?.trim().toUpperCase();
    if (!enabled || !code) {
      void teardownPc();
      if (channelRef.current) {
        void getSupabase().removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    const supabase = getSupabase();
    const channel = supabase.channel(bridgeChannelName(code), {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel
      .on('broadcast', { event: EVENTS.PGM_REQUEST }, () => {
        void publishOffer();
      })
      .on('broadcast', { event: EVENTS.PGM_ANSWER }, async ({ payload }) => {
        const pc = pcRef.current;
        if (!pc || makingOfferRef.current || ignoreOfferRef.current) return;
        try {
          const answer = (payload as { sdp?: RTCSessionDescriptionInit }).sdp;
          if (!answer) return;
          await pc.setRemoteDescription(answer);
        } catch (err) {
          console.warn('[CloudCast] PGM bridge answer failed:', err);
        }
      })
      .on('broadcast', { event: EVENTS.PGM_ICE }, async ({ payload }) => {
        const pc = pcRef.current;
        if (!pc) return;
        const ice = payload as IcePayload & { role?: string };
        if (ice.role === 'publish') return;
        try {
          if (ice.candidate) {
            await pc.addIceCandidate(ice.candidate);
          }
        } catch {
          /* ignore late ICE */
        }
      })
      .subscribe();

    const interval = setInterval(() => {
      void publishOffer();
    }, 12_000);

    return () => {
      clearInterval(interval);
      void teardownPc();
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [bridgeCode, enabled, publishOffer, teardownPc]);

  useEffect(() => {
    if (!enabled || !bridgeCode) return;
    void publishOffer();
  }, [bridgeCode, enabled, publishOffer]);
}

/** Video mixer receives processed PGM from the linked audio mixer. */
export function usePgmBridgeSubscriber({
  bridgeCode,
  onStream,
  enabled,
}: {
  bridgeCode: string | null;
  onStream: (stream: MediaStream | null) => void;
  enabled: boolean;
}) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onStreamRef = useRef(onStream);
  onStreamRef.current = onStream;

  const teardownPc = useCallback(async () => {
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

  const requestPgm = useCallback(() => {
    const ch = channelRef.current;
    if (!ch) return;
    void ch.send({
      type: 'broadcast',
      event: EVENTS.PGM_REQUEST,
      payload: { at: new Date().toISOString() },
    });
  }, []);

  useEffect(() => {
    const code = bridgeCode?.trim().toUpperCase();
    if (!enabled || !code) {
      void teardownPc();
      if (channelRef.current) {
        void getSupabase().removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    const supabase = getSupabase();
    const channel = supabase.channel(bridgeChannelName(code), {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel
      .on('broadcast', { event: EVENTS.PGM_OFFER }, async ({ payload }) => {
        try {
          let pc = pcRef.current;
          if (!pc || pc.connectionState === 'closed') {
            await teardownPc();
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
                event: EVENTS.PGM_ICE,
                payload: { candidate: ev.candidate.toJSON(), role: 'subscribe' },
              });
            };

            pc.onconnectionstatechange = () => {
              if (pc && (pc.connectionState === 'failed' || pc.connectionState === 'closed')) {
                void teardownPc();
              }
            };
          }

          const offer = (payload as { sdp?: RTCSessionDescriptionInit }).sdp;
          if (!offer || !pc) return;

          await pc.setRemoteDescription(offer);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await channel.send({
            type: 'broadcast',
            event: EVENTS.PGM_ANSWER,
            payload: { sdp: pc.localDescription },
          });
        } catch (err) {
          console.warn('[CloudCast] PGM bridge subscribe failed:', err);
        }
      })
      .on('broadcast', { event: EVENTS.PGM_ICE }, async ({ payload }) => {
        const pc = pcRef.current;
        if (!pc) return;
        const ice = payload as IcePayload & { role?: string };
        if (ice.role === 'subscribe') return;
        try {
          if (ice.candidate) {
            await pc.addIceCandidate(ice.candidate);
          }
        } catch {
          /* ignore */
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          requestPgm();
        }
      });

    const interval = setInterval(requestPgm, 10_000);

    return () => {
      clearInterval(interval);
      void teardownPc();
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [bridgeCode, enabled, requestPgm, teardownPc]);
}
