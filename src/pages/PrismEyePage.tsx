import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Compass, Loader2, Wifi, WifiOff } from 'lucide-react';
import {
  requestOrientationPermission,
  usePrismOrientationTracking,
} from '../hooks/usePrismOrientationTracking';
import { usePrismTrackingPublisher } from '../hooks/usePrismTrackingPublisher';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { SIGNALING_EVENTS } from '../lib/constants';
import { removeRealtimeChannel, resolveRealtimeChannelName } from '../lib/realtimeChannel';
import { cn } from '../lib/utils';

interface ResolvedSession {
  sessionId: string;
  accessCode: string;
  realtimeChannel: string | null;
}

/** Public Regal Prism Eye — phone gyro drives the desktop virtual camera (no login). */
export function PrismEyePage() {
  const [params] = useSearchParams();
  const code = (params.get('code') ?? '').trim().toUpperCase();
  const [session, setSession] = useState<ResolvedSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(code));
  const [tracking, setTracking] = useState(false);
  const [permError, setPermError] = useState<string | null>(null);
  const [revoked, setRevoked] = useState(false);

  useEffect(() => {
    if (!code) {
      setError('Missing access code. Open Regal Prism on your production laptop and copy the Prism Eye link.');
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured()) {
      setError('CloudCast is not configured for remote Prism Eye tracking.');
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
          setError('Invalid or expired access code. Ask your operator for a fresh Prism Eye link.');
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
        setTracking(false);
        setError('This Prism Eye link has expired. Ask your operator for the new link after the next production.');
        setSession(null);
      })
      .subscribe();

    return () => {
      void removeRealtimeChannel(channel);
    };
  }, [session]);

  const publishTracking = usePrismTrackingPublisher(
    session?.sessionId,
    session?.realtimeChannel,
    tracking && Boolean(session) && !revoked,
  );

  usePrismOrientationTracking({
    enabled: tracking && Boolean(session) && !revoked,
    onUpdate: publishTracking,
  });

  const statusLabel = useMemo(() => {
    if (loading) return 'Connecting…';
    if (revoked || error) return error ?? 'Link expired';
    if (!tracking) return 'Tap below to enable gyro tracking';
    return 'Move your phone to pan the virtual camera';
  }, [loading, revoked, error, tracking]);

  const enableTracking = async () => {
    const ok = await requestOrientationPermission();
    if (!ok) {
      setPermError('Motion permission denied. On iOS: Settings → Safari → Motion & Orientation Access.');
      return;
    }
    setPermError(null);
    setTracking(true);
  };

  if (loading) {
    return (
      <div className="flex h-full min-h-screen flex-col items-center justify-center bg-black text-white">
        <Loader2 className="h-10 w-10 animate-spin text-amber-400" />
        <p className="mt-4 text-sm text-white/60">Connecting to Regal Prism Eye…</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex h-full min-h-screen flex-col items-center justify-center bg-black px-6 text-center text-white">
        <p className="text-lg font-semibold text-amber-300">Regal Prism Eye</p>
        <p className="mt-3 max-w-md text-sm text-white/60">{error ?? 'Unknown error'}</p>
        <p className="mt-6 text-xs text-white/40">
          Get the Prism Eye link from Regal Prism → Mobile on your production laptop.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-screen flex-col bg-black text-white">
      <header className="flex items-center justify-between border-b border-amber-500/20 px-4 py-3">
        <span className="text-[10px] font-bold tracking-[0.2em] text-amber-400">REGAL PRISM EYE</span>
        <div className="flex items-center gap-1.5 text-[10px] text-white/50">
          {tracking ? (
            <>
              <Wifi className="h-3 w-3 text-emerald-400" />
              <span>Tracking live</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3" />
              <span>Standby</span>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div
          className={cn(
            'mb-6 flex h-24 w-24 items-center justify-center rounded-full border-2',
            tracking ? 'border-amber-400 bg-amber-500/10' : 'border-white/15 bg-white/5',
          )}
        >
          <Compass className={cn('h-12 w-12', tracking ? 'text-amber-300' : 'text-white/40')} />
        </div>

        <p className="text-sm text-white/70">{statusLabel}</p>

        {!tracking && (
          <button
            type="button"
            onClick={() => void enableTracking()}
            className="mt-8 rounded bg-amber-500 px-6 py-3 text-xs font-bold tracking-wider text-black hover:bg-amber-400"
          >
            ENABLE GYRO TRACKING
          </button>
        )}

        {tracking && (
          <button
            type="button"
            onClick={() => setTracking(false)}
            className="mt-8 rounded border border-white/20 px-4 py-2 text-[10px] font-bold tracking-wider text-white/60 hover:border-white/40"
          >
            STOP TRACKING
          </button>
        )}

        {permError && <p className="mt-4 max-w-sm text-[10px] text-mixer-red">{permError}</p>}

        <p className="mt-10 max-w-xs text-[10px] leading-relaxed text-white/35">
          Hold your phone and move it to control the virtual camera on the desktop Regal Prism studio.
          The link rotates when your operator regenerates the access code after each production.
        </p>
      </div>
    </div>
  );
}
