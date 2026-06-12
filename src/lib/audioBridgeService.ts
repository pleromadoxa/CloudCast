import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import type { MixerBridgeLink } from '../types/audioBridge';

const BRIDGE_PREFIX = 'cloudcast-bridge-';
const LOCAL_KEY = 'cloudcast_mixer_bridge';

function randomBridgeCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function generateBridgeCode(): string {
  return randomBridgeCode();
}

export function readLocalBridgeLink(): MixerBridgeLink | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MixerBridgeLink;
  } catch {
    return null;
  }
}

export function writeLocalBridgeLink(link: MixerBridgeLink | null): void {
  if (!link) {
    localStorage.removeItem(LOCAL_KEY);
    return;
  }
  localStorage.setItem(LOCAL_KEY, JSON.stringify(link));
}

/** Audio mixer publishes its bridge code on a short-lived realtime channel. */
export function createBridgePublisher(
  link: Omit<MixerBridgeLink, 'linkedAt'>,
  onStatus?: (status: string) => void,
): { channel: RealtimeChannel; stop: () => Promise<void> } {
  const supabase = getSupabase();
  const payload: MixerBridgeLink = { ...link, linkedAt: new Date().toISOString() };
  const channel = supabase.channel(`${BRIDGE_PREFIX}${link.bridgeCode}`, {
    config: { broadcast: { self: false } },
  });
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  channel.subscribe((status) => {
    onStatus?.(status);
    if (status === 'SUBSCRIBED') {
      void channel.send({
        type: 'broadcast',
        event: 'bridge-offer',
        payload,
      });
      heartbeatTimer = setInterval(() => {
        void channel.send({ type: 'broadcast', event: 'bridge-offer', payload });
      }, 8000);
      channel.on('broadcast', { event: 'bridge-ack' }, () => {
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
      });
    }
  });

  return {
    channel,
    stop: async () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      await supabase.removeChannel(channel);
    },
  };
}

/** Video mixer listens for an audio bridge offer by code. */
export async function resolveBridgeByCode(
  bridgeCode: string,
  timeoutMs = 12_000,
): Promise<MixerBridgeLink | null> {
  const normalized = bridgeCode.trim().toUpperCase();
  if (normalized.length < 4) return null;

  try {
    const { data, error } = await getSupabase().rpc('resolve_mixer_bridge', {
      p_bridge_code: normalized,
    });
    if (!error && data) {
      const row = data as Record<string, unknown>;
      return {
        bridgeCode: normalized,
        audioSessionId: String(row.audio_session_id),
        audioAccessCode: String(row.audio_access_code),
        audioRealtimeChannel: String(row.audio_realtime_channel ?? ''),
        ownerId: String(row.owner_id ?? ''),
        linkedAt: new Date().toISOString(),
      };
    }
  } catch {
    /* fall through to realtime discovery */
  }

  return new Promise((resolve) => {
    const supabase = getSupabase();
    let settled = false;
    const finish = (link: MixerBridgeLink | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void supabase.removeChannel(channel);
      resolve(link);
    };

    const channel = supabase.channel(`${BRIDGE_PREFIX}${normalized}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'bridge-offer' }, ({ payload }) => {
        const offer = payload as MixerBridgeLink;
        if (offer.bridgeCode?.toUpperCase() !== normalized) return;
        void channel.send({
          type: 'broadcast',
          event: 'bridge-ack',
          payload: { at: new Date().toISOString() },
        });
        finish(offer);
      })
      .subscribe();

    const timer = setTimeout(() => finish(null), timeoutMs);
  });
}

export async function persistBridgeLink(link: MixerBridgeLink): Promise<void> {
  writeLocalBridgeLink(link);
  try {
    await getSupabase().rpc('register_mixer_bridge', {
      p_bridge_code: link.bridgeCode,
      p_audio_session_id: link.audioSessionId,
      p_audio_access_code: link.audioAccessCode,
      p_audio_realtime_channel: link.audioRealtimeChannel,
    });
  } catch {
    /* realtime + local is enough for MVP */
  }
}
