import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Volume2, Wifi, WifiOff } from 'lucide-react';
import { usePgmOutputSubscriber } from '../lib/pgmOutputTransport';
import { ensureAudioOutputReady } from '../lib/audioOutput';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { SIGNALING_EVENTS } from '../lib/constants';
import { removeRealtimeChannel, resolveRealtimeChannelName } from '../lib/realtimeChannel';
import { cn } from '../lib/utils';

interface ResolvedSession {
  sessionId: string;
  accessCode: string;
  realtimeChannel: string | null;
}

/** Public program output — full-screen live PGM from the Video Mixer via access code. */
export function MixerOutputPage() {
  const [params] = useSearchParams();
  const code = (params.get('code') ?? '').trim().toUpperCase();
  const [session, setSession] = useState<ResolvedSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(code));
  const [revoked, setRevoked] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connected, setConnected] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!code) {
      setError('Missing access code. Open the Video Mixer and copy the program output URL.');
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured()) {
      setError('CloudCast is not configured for remote program output.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setRevoked(false);

    void (async () => {
      try {
        const { data, error: rpcError } = await getSupabase().rpc('get_mixer_session', {
          p_access_code: code,
        });
        if (cancelled) return;
        if (rpcError || !data) {
          setError('Invalid or expired access code.');
          setSession(null);
          return;
        }
        const row = data as Record<string, unknown>;
        const sessionId = String(row.session_id ?? row.id ?? '');
        if (!sessionId) {
          setError('Session not found.');
          return;
        }
        setSession({
          sessionId,
          accessCode: code,
          realtimeChannel: (row.realtime_channel as string | null) ?? null,
        });
      } catch {
        if (!cancelled) setError('Could not connect. Check your network and try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code]);

  useEffect(() => {
    if (!session || !isSupabaseConfigured()) return;

    const channelName = resolveRealtimeChannelName(session.sessionId, session.realtimeChannel);
    const channel = getSupabase().channel(channelName, {
      config: { broadcast: { ack: false, self: false } },
    });

    channel
      .on('broadcast', { event: SIGNALING_EVENTS.ACCESS_CODE_REVOKED }, () => {
        setRevoked(true);
        setError('This program output link has expired. Ask your operator for the new link after the next production.');
        setSession(null);
        setRemoteStream(null);
      })
      .subscribe();

    return () => {
      void removeRealtimeChannel(channel);
    };
  }, [session]);

  usePgmOutputSubscriber({
    sessionId: session?.sessionId ?? null,
    realtimeChannel: session?.realtimeChannel,
    onStream: (stream) => {
      setRemoteStream(stream);
      setConnected(Boolean(stream));
    },
    enabled: Boolean(session) && !revoked,
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (remoteStream) {
      video.srcObject = remoteStream;
      void ensureAudioOutputReady()
        .then(() => video.play())
        .catch(() => setAudioBlocked(true));
    } else {
      video.srcObject = null;
    }
  }, [remoteStream]);

  const enableAudio = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    await ensureAudioOutputReady();
    try {
      video.muted = false;
      await video.play();
      setAudioBlocked(false);
    } catch {
      setAudioBlocked(true);
    }
  }, []);

  const statusLabel = useMemo(() => {
    if (loading) return 'Connecting…';
    if (revoked || error) return error ?? 'Link expired';
    if (!connected) return 'Waiting for Video Mixer program output…';
    return 'Live program output';
  }, [loading, revoked, error, connected]);

  if (loading) {
    return (
      <div className="flex h-full min-h-screen flex-col items-center justify-center bg-black text-white">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-400" />
        <p className="mt-4 text-sm text-white/60">Connecting to Video Mixer output…</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex h-full min-h-screen flex-col items-center justify-center bg-black px-6 text-center text-white">
        <p className="text-lg font-semibold text-emerald-300">Video Mixer — Program Output</p>
        <p className="mt-3 max-w-md text-sm text-white/60">{error ?? 'Unknown error'}</p>
        <p className="mt-6 text-xs text-white/40">
          Get the program output URL from Video Mixer → Settings → Output on your production laptop.
        </p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        playsInline
        autoPlay
        muted={audioBlocked}
      />

      {!connected && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 px-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          <p className="mt-4 text-sm text-white/60">{statusLabel}</p>
        </div>
      )}

      <div
        className={cn(
          'pointer-events-none absolute left-0 right-0 top-0 flex items-center justify-between px-4 py-2 transition-opacity duration-700',
          connected ? 'opacity-0 hover:opacity-100' : 'opacity-100',
        )}
      >
        <span className="text-[10px] font-bold tracking-[0.2em] text-emerald-400/80">VIDEO MIXER · PGM</span>
        <div className="flex items-center gap-1.5 text-[10px] text-white/40">
          {connected ? (
            <>
              <Wifi className="h-3 w-3 text-emerald-400" />
              <span>Live</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3" />
              <span>Waiting…</span>
            </>
          )}
        </div>
      </div>

      {audioBlocked && connected && (
        <div className="absolute bottom-6 left-0 right-0 flex justify-center px-4">
          <button
            type="button"
            onClick={() => void enableAudio()}
            className="pointer-events-auto inline-flex items-center gap-2 rounded bg-emerald-600 px-4 py-2 text-[10px] font-bold tracking-wider text-black hover:bg-emerald-500"
          >
            <Volume2 className="h-3.5 w-3.5" />
            TAP TO ENABLE AUDIO
          </button>
        </div>
      )}
    </div>
  );
}
