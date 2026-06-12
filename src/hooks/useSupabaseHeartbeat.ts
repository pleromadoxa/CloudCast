import { useEffect, useRef } from 'react';
import { pingSupabase } from '../lib/supabaseHeartbeat';
import { isSupabaseConfigured } from '../lib/supabase';

/** Visible tab — ping often enough to keep the project warm. */
const INTERVAL_VISIBLE_MS = 4 * 60 * 1000;

/** Hidden tab — slower cadence, still within free-tier inactivity window. */
const INTERVAL_HIDDEN_MS = 15 * 60 * 1000;

/** Retry sooner after a failed ping (project waking from pause). */
const RETRY_AFTER_FAIL_MS = 30 * 1000;

/**
 * Periodically pings Supabase so the free-tier project does not pause from inactivity.
 * Runs for the lifetime of the app while Supabase env vars are configured.
 */
export function useSupabaseHeartbeat(enabled = true) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured()) return;

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const schedule = (delayMs: number) => {
      clearTimer();
      timerRef.current = setTimeout(() => {
        void tick();
      }, delayMs);
    };

    const tick = async () => {
      if (runningRef.current) {
        schedule(INTERVAL_VISIBLE_MS);
        return;
      }
      runningRef.current = true;
      try {
        const source = document.hidden ? 'client-background' : 'client';
        const result = await pingSupabase(source);
        const nextDelay = result.ok
          ? document.hidden
            ? INTERVAL_HIDDEN_MS
            : INTERVAL_VISIBLE_MS
          : RETRY_AFTER_FAIL_MS;
        schedule(nextDelay);
      } finally {
        runningRef.current = false;
      }
    };

    void tick();

    const onVisibility = () => {
      if (!document.hidden) void tick();
      else schedule(INTERVAL_HIDDEN_MS);
    };

    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearTimer();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled]);
}
