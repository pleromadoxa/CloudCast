import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Wifi, WifiOff } from 'lucide-react';
import { DisplaySlideRenderer } from '../components/display/DisplaySlideRenderer';
import { DisplayCongregationClock } from '../components/display/DisplayCongregationClock';
import { useDisplayFeedSyncSubscriber } from '../hooks/useDisplayFeedSyncSubscriber';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { cn } from '../lib/utils';

interface ResolvedSession {
  sessionId: string;
  accessCode: string;
  realtimeChannel: string | null;
}

/** Public congregation output — full-screen live Display Feed via access code. */
export function DisplayCongregationPage() {
  const [params] = useSearchParams();
  const code = (params.get('code') ?? '').trim().toUpperCase();
  const [session, setSession] = useState<ResolvedSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(code));

  useEffect(() => {
    if (!code) {
      setError('Missing access code. Open Regal Display and copy the congregation URL.');
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured()) {
      setError('CloudCast is not configured for remote congregation output.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

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

  const sync = useDisplayFeedSyncSubscriber(
    session?.sessionId ?? null,
    session?.realtimeChannel,
    Boolean(session),
  );

  const statusLabel = useMemo(() => {
    if (loading) return 'Connecting…';
    if (error) return error;
    if (!sync.connected) return 'Waiting for operator…';
    if (sync.isLive && sync.liveSlide) return sync.liveSlide.title;
    return 'Hold screen';
  }, [loading, error, sync.connected, sync.isLive, sync.liveSlide]);

  if (loading) {
    return (
      <div className="flex h-full min-h-screen flex-col items-center justify-center bg-black text-white">
        <Loader2 className="h-10 w-10 animate-spin text-violet-400" />
        <p className="mt-4 text-sm text-white/60">Connecting to Regal Display…</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex h-full min-h-screen flex-col items-center justify-center bg-black px-6 text-center text-white">
        <p className="text-lg font-semibold text-violet-300">Regal Display — Congregation</p>
        <p className="mt-3 max-w-md text-sm text-white/60">{error ?? 'Unknown error'}</p>
        <p className="mt-6 text-xs text-white/40">
          Ask your operator for the congregation URL from Regal Display.
        </p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <DisplaySlideRenderer
        slide={sync.isLive ? sync.liveSlide : null}
        holdBackground={sync.holdBackground}
        animate={sync.isLive}
        transition={sync.transition}
        className="h-full w-full"
      />

      {sync.showCongregationClock && (
        <DisplayCongregationClock className="pointer-events-none absolute right-[32px] top-[32px] z-10" />
      )}

      {/* Minimal status bar — fades when live content is showing */}
      <div
        className={cn(
          'pointer-events-none absolute left-0 right-0 top-0 flex items-center justify-between px-4 py-2 transition-opacity duration-700',
          sync.isLive && sync.liveSlide ? 'opacity-0' : 'opacity-100',
        )}
      >
        <span className="text-[10px] font-bold tracking-[0.2em] text-violet-400/80">REGAL DISPLAY</span>
        <div className="flex items-center gap-1.5 text-[10px] text-white/40">
          {sync.connected ? (
            <>
              <Wifi className="h-3 w-3 text-emerald-400" />
              <span>Connected</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3" />
              <span>Waiting…</span>
            </>
          )}
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-3 opacity-0 transition-opacity hover:opacity-100">
        <p className="truncate text-center text-[10px] text-white/50">{statusLabel}</p>
      </div>
    </div>
  );
}
